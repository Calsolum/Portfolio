package ca.tariqsingh.tokenprinter

/**
 * The NIIMBOT B1 wire protocol, ported from the patched NiimPrintX that the
 * Kitchen Hub Pi prints with. Plain Kotlin, so it can be unit tested.
 *
 * Every packet is `55 55 | type | len | data | xor(type, len, data) | AA AA`.
 */
object Niimbot {
    const val SET_LABEL_DENSITY = 0x21
    const val SET_LABEL_TYPE = 0x23
    const val START_PRINT = 0x01
    const val START_PAGE_PRINT = 0x03
    const val SET_DIMENSION = 0x13
    const val SET_QUANTITY = 0x15
    const val IMAGE_ROW = 0x85
    const val END_PAGE_PRINT = 0xE3
    const val GET_PRINT_STATUS = 0xA3
    const val END_PRINT = 0xF3

    /** The printed bitmap is this wide; the token sits in the first 577 columns. */
    const val PRINT_WIDTH = 640
    const val DENSITY = 3
    const val LABEL_TYPE = 1

    class Packet(val type: Int, val data: ByteArray) {
        fun toBytes(): ByteArray {
            require(data.size <= 255) { "packet data too long" }
            var checksum = type xor data.size
            data.forEach { checksum = checksum xor (it.toInt() and 0xFF) }
            return byteArrayOf(0x55, 0x55, type.toByte(), data.size.toByte()) + data +
                byteArrayOf(checksum.toByte(), 0xAA.toByte(), 0xAA.toByte())
        }

        /** A reply's first data byte is non-zero when the printer accepted the command. */
        val ok: Boolean get() = data.isNotEmpty() && data[0].toInt() != 0
    }

    /** Collects notification bytes and pulls out whole packets as they complete. */
    class Parser {
        private var buf = ByteArray(0)

        fun feed(bytes: ByteArray): List<Packet> {
            buf += bytes
            val out = mutableListOf<Packet>()
            while (true) {
                val start = indexOfHeader()
                if (start < 0) {
                    // Keep a trailing 0x55 in case the header is split across notifications.
                    buf = if (buf.isNotEmpty() && buf.last() == 0x55.toByte()) byteArrayOf(0x55) else ByteArray(0)
                    return out
                }
                if (start > 0) buf = buf.copyOfRange(start, buf.size)
                if (buf.size < 4) return out
                val len = buf[3].toInt() and 0xFF
                val total = len + 7
                if (buf.size < total) return out
                val type = buf[2].toInt() and 0xFF
                val data = buf.copyOfRange(4, 4 + len)
                var checksum = type xor len
                data.forEach { checksum = checksum xor (it.toInt() and 0xFF) }
                val valid = (buf[4 + len].toInt() and 0xFF) == checksum &&
                    buf[5 + len] == 0xAA.toByte() && buf[6 + len] == 0xAA.toByte()
                if (valid) {
                    out += Packet(type, data)
                    buf = buf.copyOfRange(total, buf.size)
                } else {
                    buf = buf.copyOfRange(1, buf.size) // resync past a bad header
                }
            }
        }

        private fun indexOfHeader(): Int {
            for (i in 0 until buf.size - 1) {
                if (buf[i] == 0x55.toByte() && buf[i + 1] == 0x55.toByte()) return i
            }
            return -1
        }
    }

    private fun u16(v: Int) = byteArrayOf((v shr 8).toByte(), v.toByte())

    fun setLabelDensity(n: Int = DENSITY) = Packet(SET_LABEL_DENSITY, byteArrayOf(n.toByte()))
    fun setLabelType(n: Int = LABEL_TYPE) = Packet(SET_LABEL_TYPE, byteArrayOf(n.toByte()))

    /** The B1 needs the 7-byte form (pages, four zeros, page colour); the 1-byte form drops the job. */
    fun startPrint(totalPages: Int) = Packet(START_PRINT, u16(totalPages) + byteArrayOf(0, 0, 0, 0, 0))
    fun startPagePrint() = Packet(START_PAGE_PRINT, byteArrayOf(1))

    /** The B1 needs the 6-byte form (rows, cols, quantity); the 4-byte form prints nothing. */
    fun setDimension(rows: Int, cols: Int, quantity: Int) = Packet(SET_DIMENSION, u16(rows) + u16(cols) + u16(quantity))
    fun setQuantity(n: Int) = Packet(SET_QUANTITY, u16(n))
    fun endPagePrint() = Packet(END_PAGE_PRINT, byteArrayOf(1))
    fun getPrintStatus() = Packet(GET_PRINT_STATUS, byteArrayOf(1))
    fun endPrint() = Packet(END_PRINT, byteArrayOf(1))

    /** Page number from a GET_PRINT_STATUS reply (`>HBB`: page, progress1, progress2). */
    fun statusPage(reply: Packet): Int? =
        if (reply.data.size >= 2) ((reply.data[0].toInt() and 0xFF) shl 8) or (reply.data[1].toInt() and 0xFF) else null

    /**
     * One image row: `y (u16) | black dots (3 bytes) | 01 | row bits`, MSB first,
     * 1 = black. The black count must be real; zeros print only part of the image.
     */
    fun imageRow(y: Int, black: BooleanArray, width: Int, offset: Int = y * width): Packet {
        val bytesPerRow = (width + 7) / 8
        val bits = ByteArray(bytesPerRow)
        var count = 0
        for (x in 0 until width) {
            if (black[offset + x]) {
                count++
                bits[x / 8] = (bits[x / 8].toInt() or (0x80 ushr (x % 8))).toByte()
            }
        }
        val header = u16(y) + byteArrayOf((count shr 16).toByte(), (count shr 8).toByte(), count.toByte(), 1)
        return Packet(IMAGE_ROW, header + bits)
    }

    /** Milliseconds the Pi waits after each row so the printer's buffer keeps up (40 ms at 640 px). */
    fun rowDelayMs(width: Int): Long = maxOf(10L, ((width + 7) / 8) * 1000L / 2000L)

    /**
     * Place a token (black = true, `w` x `h`) at the left of the 640-wide print
     * bitmap, white elsewhere, as the label server does for the 50x80 preset.
     */
    fun onPrintCanvas(black: BooleanArray, w: Int, h: Int): BooleanArray {
        val out = BooleanArray(PRINT_WIDTH * h)
        for (y in 0 until h) {
            System.arraycopy(black, y * w, out, y * PRINT_WIDTH, minOf(w, PRINT_WIDTH))
        }
        return out
    }
}
