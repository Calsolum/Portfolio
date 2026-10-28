package ca.tariqsingh.tokenprinter

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID
import kotlin.coroutines.resume

/**
 * Prints to a NIIMBOT B1 over Bluetooth LE, following the same steps as the
 * Kitchen Hub Pi: find a device named "B1…", connect, then send the print
 * sequence with one image row per packet, paced so the printer keeps up.
 *
 * The caller must already hold the Bluetooth permissions (see MainActivity).
 */
@SuppressLint("MissingPermission")
class B1Printer(private val context: Context, private val prefs: Prefs) {
    private val adapter: BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
    private val lock = Mutex()

    private var gatt: BluetoothGatt? = null
    private var char: BluetoothGattCharacteristic? = null
    private val parser = Niimbot.Parser()
    private val replies = Channel<Niimbot.Packet>(Channel.UNLIMITED)

    // One GATT operation at a time; each completes its own deferred from the callback.
    private var connected = CompletableDeferred<Boolean>()
    private var servicesFound = CompletableDeferred<Boolean>()
    private var mtuChanged = CompletableDeferred<Int>()
    private var descriptorWritten = CompletableDeferred<Boolean>()
    private var charWritten = CompletableDeferred<Boolean>()

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                connected.complete(true)
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                connected.complete(false)
                // Anything waiting on this link fails now rather than timing out.
                servicesFound.complete(false)
                descriptorWritten.complete(false)
                charWritten.complete(false)
                if (gatt == g) {
                    gatt = null
                    char = null
                }
                g.close()
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            servicesFound.complete(status == BluetoothGatt.GATT_SUCCESS)
        }

        override fun onMtuChanged(g: BluetoothGatt, mtu: Int, status: Int) {
            mtuChanged.complete(if (status == BluetoothGatt.GATT_SUCCESS) mtu else 23)
        }

        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) {
            descriptorWritten.complete(status == BluetoothGatt.GATT_SUCCESS)
        }

        override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            charWritten.complete(status == BluetoothGatt.GATT_SUCCESS)
        }

        @Deprecated("Used on Android 12 and older")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            @Suppress("DEPRECATION")
            onNotify(c.value ?: return)
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
            onNotify(value)
        }
    }

    private fun onNotify(value: ByteArray) {
        synchronized(parser) { parser.feed(value) }.forEach { replies.trySend(it) }
    }

    /** Print `black` (`Niimbot.PRINT_WIDTH` wide) as `copies` labels; `progress` gets 0..1. */
    suspend fun print(black: BooleanArray, height: Int, copies: Int, progress: (String, Float) -> Unit) = lock.withLock {
        val width = Niimbot.PRINT_WIDTH
        progress("Connecting to the printer…", 0f)
        try {
            ensureConnected()
        } catch (e: ApiException) {
            disconnect()
            throw e
        }
        try {
            command(Niimbot.setLabelDensity())
            command(Niimbot.setLabelType())
            command(Niimbot.startPrint(copies))
            command(Niimbot.startPagePrint())
            command(Niimbot.setDimension(height, width, copies))
            command(Niimbot.setQuantity(copies))

            val pause = Niimbot.rowDelayMs(width)
            for (y in 0 until height) {
                write(Niimbot.imageRow(y, black, width).toBytes())
                delay(pause)
                if (y % 20 == 0) progress("Printing…", y.toFloat() / height)
            }
        } catch (e: ApiException) {
            disconnect()
            throw e
        }

        // Finishing is best effort: by now the label has printed, as on the Pi.
        progress("Finishing…", 1f)
        runCatching {
            repeat(20) {
                if (command(Niimbot.endPagePrint(), required = false)?.ok == true) return@runCatching
                delay(50)
            }
        }
        runCatching {
            repeat(50) {
                val reply = command(Niimbot.getPrintStatus(), required = false)
                if (reply != null && Niimbot.statusPage(reply) == copies) return@runCatching
                delay(100)
            }
        }
        runCatching { command(Niimbot.endPrint(), required = false) }
        // Let go of the printer so the Kitchen Hub (or the phone, next time) can connect.
        disconnect()
    }

    fun disconnect() {
        gatt?.let {
            it.disconnect()
            it.close()
        }
        gatt = null
        char = null
    }

    private suspend fun ensureConnected() {
        if (gatt != null && char != null) return
        val a = adapter ?: throw ApiException("This phone has no Bluetooth.")
        if (!a.isEnabled) throw ApiException("Turn on Bluetooth first.")

        val device = prefs.printerAddress
            ?.takeIf { BluetoothAdapter.checkBluetoothAddress(it) }
            ?.let { a.getRemoteDevice(it) }
            ?.takeIf { tryConnect(it) }
        if (device == null) {
            val found = scan(a) ?: throw ApiException(
                "Couldn't find the printer. Make sure it's on, and not connected to the Kitchen Hub or the NIIMBOT app.",
            )
            if (!tryConnect(found)) throw ApiException("Found the printer but couldn't connect. Try again.")
            prefs.printerAddress = found.address
        }
    }

    /** Look for a device whose name starts with "B1", for up to 10 seconds. */
    private suspend fun scan(a: BluetoothAdapter): BluetoothDevice? {
        val scanner = a.bluetoothLeScanner ?: return null
        return withTimeoutOrNull(10_000) {
            suspendCancellableCoroutine { cont ->
                val cb = object : ScanCallback() {
                    override fun onScanResult(type: Int, result: ScanResult) {
                        val name = result.scanRecord?.deviceName ?: result.device.name ?: return
                        if (name.startsWith("B1", ignoreCase = true) && cont.isActive) {
                            scanner.stopScan(this)
                            cont.resume(result.device)
                        }
                    }

                    override fun onScanFailed(errorCode: Int) {
                        if (cont.isActive) cont.resume(null)
                    }
                }
                val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
                scanner.startScan(null, settings, cb)
                cont.invokeOnCancellation { runCatching { scanner.stopScan(cb) } }
            }
        }
    }

    private suspend fun tryConnect(device: BluetoothDevice): Boolean {
        connected = CompletableDeferred()
        servicesFound = CompletableDeferred()
        mtuChanged = CompletableDeferred()
        descriptorWritten = CompletableDeferred()
        val g = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
        gatt = g
        if (withTimeoutOrNull(10_000) { connected.await() } != true) {
            g.close()
            gatt = null
            return false
        }
        g.discoverServices()
        if (withTimeoutOrNull(10_000) { servicesFound.await() } != true) return fail(g)

        val c = findCharacteristic(g) ?: return fail(g)

        // A 640-px row packet is 93 bytes, far over the default 20-byte payload.
        g.requestMtu(MTU)
        val mtu = withTimeoutOrNull(5_000) { mtuChanged.await() } ?: 23
        if (mtu - 3 < ROW_PACKET_BYTES) {
            fail(g)
            throw ApiException("The printer's Bluetooth link is too small for label rows (MTU $mtu).")
        }

        g.setCharacteristicNotification(c, true)
        val cccd = c.getDescriptor(CCCD) ?: return fail(g)
        val enable = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        if (Build.VERSION.SDK_INT >= 33) {
            g.writeDescriptor(cccd, enable)
        } else {
            @Suppress("DEPRECATION")
            cccd.value = enable
            @Suppress("DEPRECATION")
            g.writeDescriptor(cccd)
        }
        if (withTimeoutOrNull(5_000) { descriptorWritten.await() } != true) return fail(g)

        char = c
        while (replies.tryReceive().isSuccess) Unit // drop anything stale
        return true
    }

    private fun fail(g: BluetoothGatt): Boolean {
        g.disconnect()
        g.close()
        if (gatt == g) gatt = null
        return false
    }

    /**
     * The known NIIMBOT characteristic, or else (as NiimPrintX does) the only
     * characteristic of a service that can read, write without response and notify.
     */
    private fun findCharacteristic(g: BluetoothGatt): BluetoothGattCharacteristic? {
        g.getService(SERVICE)?.getCharacteristic(CHARACTERISTIC)?.let { return it }
        val wanted = BluetoothGattCharacteristic.PROPERTY_READ or
            BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE or
            BluetoothGattCharacteristic.PROPERTY_NOTIFY
        return g.services.firstOrNull { s ->
            s.characteristics.size == 1 && (s.characteristics[0].properties and wanted) == wanted
        }?.characteristics?.get(0)
    }

    private suspend fun write(bytes: ByteArray) {
        val g = gatt ?: throw ApiException("Lost the connection to the printer.")
        val c = char ?: throw ApiException("Lost the connection to the printer.")
        charWritten = CompletableDeferred()
        val type = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        val started = if (Build.VERSION.SDK_INT >= 33) {
            g.writeCharacteristic(c, bytes, type) == BluetoothGatt.GATT_SUCCESS
        } else {
            @Suppress("DEPRECATION")
            c.writeType = type
            @Suppress("DEPRECATION")
            c.value = bytes
            @Suppress("DEPRECATION")
            g.writeCharacteristic(c)
        }
        // A dropped row would print a broken label, so fail the job instead.
        if (!started || withTimeoutOrNull(5_000) { charWritten.await() } != true) {
            throw ApiException("Print failed: the printer stopped answering.")
        }
    }

    /** Send one command and wait up to 10 s for its reply, as the Pi does. */
    private suspend fun command(packet: Niimbot.Packet, required: Boolean = true): Niimbot.Packet? {
        while (replies.tryReceive().isSuccess) Unit
        write(packet.toBytes())
        val reply = withTimeoutOrNull(10_000) { replies.receive() }
        if (required && reply?.ok != true) {
            throw ApiException("Print failed: the printer refused the job (command 0x%02X).".format(packet.type))
        }
        return reply
    }

    companion object {
        private val SERVICE = UUID.fromString("e7810a71-73ae-499d-8c15-faa9aef0c3f2")
        private val CHARACTERISTIC = UUID.fromString("bef8d6c9-9c21-4c9e-b632-bd58c1009f9f")
        private val CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val MTU = 247
        private const val ROW_PACKET_BYTES = 7 + 6 + Niimbot.PRINT_WIDTH / 8
    }
}
