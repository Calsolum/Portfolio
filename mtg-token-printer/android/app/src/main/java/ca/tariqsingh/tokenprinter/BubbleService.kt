package ca.tariqsingh.tokenprinter

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.abs

/**
 * The voice bubble: a mic button that floats over other apps (LifeTap during a
 * game). Tap it, say a token ("two goblins", "balloon llanowar elves"), and a
 * small card shows the best match with a Print button. Printing runs here, so
 * it carries on while another app is in front.
 *
 * It runs as a foreground service (microphone + connected device) started from
 * the app, which is what lets it listen and print while the app isn't visible.
 */
class BubbleService : Service() {
    private lateinit var deps: Deps
    private lateinit var wm: WindowManager
    private val scope = MainScope()
    private var bubble: TextView? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var card: Card? = null
    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var work: Job? = null
    private var printing = false

    override fun onBind(intent: Intent?) = null

    override fun onCreate() {
        super.onCreate()
        deps = Deps.get(this)
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP || !canRun(this)) {
            if (intent?.action == ACTION_STOP) deps.prefs.bubbleEnabled = false
            stopSelf()
            return START_NOT_STICKY
        }
        startInForeground()
        if (bubble == null) showBubble()
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        recognizer?.destroy()
        card?.remove()
        bubble?.let { wm.removeView(it) }
        super.onDestroy()
    }

    private fun startInForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Voice bubble", NotificationManager.IMPORTANCE_LOW),
        )
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, BubbleService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Token Printer voice bubble is on")
            .setContentText("Tap the bubble and say a token to print.")
            .setContentIntent(open)
            .addAction(0, "Turn off", stop)
            .setOngoing(true)
            .build()

        var types = 0
        if (Build.VERSION.SDK_INT >= 30 && granted(Manifest.permission.RECORD_AUDIO)) {
            types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        }
        if (Build.VERSION.SDK_INT >= 29 && (Build.VERSION.SDK_INT < 31 || granted(Manifest.permission.BLUETOOTH_CONNECT))) {
            types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, types)
    }

    private fun granted(permission: String) =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // --- The bubble ---------------------------------------------------------

    private fun showBubble() {
        val size = dp(56)
        val view = TextView(this).apply {
            text = "🎤"
            textSize = 24f
            gravity = Gravity.CENTER
            elevation = dp(6).toFloat()
            contentDescription = "Speak a token to print"
        }
        val params = overlayParams(size, size).apply {
            gravity = Gravity.TOP or Gravity.START
            x = resources.displayMetrics.widthPixels - size - dp(8)
            y = resources.displayMetrics.heightPixels / 3
        }
        view.setOnTouchListener(BubbleDrag(params, size))
        wm.addView(view, params)
        bubble = view
        bubbleParams = params
        setListening(false)
    }

    private fun setListening(on: Boolean) {
        listening = on
        bubble?.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(if (on) LISTENING else IDLE)
        }
    }

    /** Drags the bubble; a touch that doesn't move is a tap. Lets go at the nearest side. */
    private inner class BubbleDrag(private val params: WindowManager.LayoutParams, private val size: Int) :
        View.OnTouchListener {
        private val slop = ViewConfiguration.get(this@BubbleService).scaledTouchSlop
        private var downX = 0f
        private var downY = 0f
        private var startX = 0
        private var startY = 0
        private var dragging = false

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = e.rawX; downY = e.rawY
                    startX = params.x; startY = params.y
                    dragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX
                    val dy = e.rawY - downY
                    if (!dragging && (abs(dx) > slop || abs(dy) > slop)) dragging = true
                    if (dragging) {
                        params.x = startX + dx.toInt()
                        params.y = startY + dy.toInt()
                        wm.updateViewLayout(v, params)
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) {
                        val width = resources.displayMetrics.widthPixels
                        params.x = if (params.x + size / 2 < width / 2) dp(8) else width - size - dp(8)
                        wm.updateViewLayout(v, params)
                    } else {
                        v.performClick()
                        onBubbleTap()
                    }
                }
            }
            return true
        }
    }

    private fun overlayParams(width: Int, height: Int) = WindowManager.LayoutParams(
        width,
        height,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        PixelFormat.TRANSLUCENT,
    )

    // --- Listening ----------------------------------------------------------

    private fun onBubbleTap() {
        if (listening) {
            recognizer?.cancel()
            setListening(false)
            card().message("Stopped listening.")
            return
        }
        if (printing) {
            card().show()
            return
        }
        work?.cancel()
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            card().message("Speech recognition isn't available on this phone.", failed = true)
            return
        }
        if (!granted(Manifest.permission.RECORD_AUDIO)) {
            card().message("Token Printer needs the microphone. Turn the bubble off and on in the app.", failed = true)
            return
        }
        val r = recognizer ?: SpeechRecognizer.createSpeechRecognizer(this).also { recognizer = it }
        r.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle) {
                setListening(false)
                val heard = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
                val command = heard.firstNotNullOfOrNull { VoiceCommand.parse(it) }
                if (command == null) {
                    val said = heard.firstOrNull()
                    card().message(
                        if (said.isNullOrBlank()) "Didn't hear a token. Tap the bubble and try again."
                        else "Didn't catch a token in \"$said\". Tap the bubble and try again.",
                        failed = true,
                    )
                } else {
                    find(command)
                }
            }

            override fun onError(error: Int) {
                setListening(false)
                card().message(speechError(error), failed = true)
            }

            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: Bundle?) = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            .putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
        setListening(true)
        card().message("Listening… say a token, like \"two goblins\" or \"balloon llanowar elves\".")
        r.startListening(intent)
    }

    private fun speechError(code: Int) = when (code) {
        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
            "Didn't hear a token. Tap the bubble and try again."
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
            "Token Printer needs the microphone. Turn the bubble off and on in the app."
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
            "Speech recognition needs the internet (or Google's offline speech pack)."
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognition is busy. Try again."
        else -> "Speech recognition failed ($code). Try again."
    }

    // --- Finding and printing -----------------------------------------------

    private fun find(command: VoiceCommand) {
        work?.cancel()
        work = scope.launch {
            val what = if (command.rule == null) "tokens" else "creatures"
            card().message("Looking up \"${command.query}\"…")
            val found = try {
                if (command.rule == null) deps.scryfall.search(command.query) else deps.scryfall.searchCreatures(command.query)
            } catch (e: ApiException) {
                card().message(e.message ?: "Search failed.", failed = true)
                return@launch
            }
            if (found.isEmpty()) {
                card().message("No $what match \"${command.query}\".", failed = true)
                return@launch
            }
            val key = (command.rule?.key ?: "token") + ":" + command.query
            val remembered = deps.prefs.voiceChoice(key)
            val ordered = found.sortedByDescending { it.id == remembered }
            show(command, key, ordered, 0)
        }
    }

    private suspend fun show(command: VoiceCommand, key: String, matches: List<Token>, index: Int) {
        val match = matches[index]
        val token = command.rule?.copy(match) ?: match
        card().message("Drawing ${token.name}…")
        val art = deps.scryfall.art(token.artUrl)
        val label = withContext(Dispatchers.Default) { LabelRenderer.render(token, art) }
        val title = (if (command.copies > 1) "${command.copies} × " else "") + token.name
        val next = if (matches.size > 1) {
            { work = scope.launch { show(command, key, matches, (index + 1) % matches.size) } }
        } else {
            null
        }
        val print = { print(token, label, command.copies, key, match.id) }
        card().candidate(title, listOfNotNull(token.typeLine, token.pt).joinToString("  ·  "), label, print, next)
    }

    private fun print(token: Token, label: Bitmap, copies: Int, key: String, matchId: String?) {
        if (printing) return
        printing = true
        work = scope.launch {
            val c = card()
            c.printing("Sending to the printer…")
            try {
                val black = withContext(Dispatchers.Default) { toPrintBits(label) }
                deps.printer.print(black, label.height, copies) { message, fraction ->
                    c.printing("$message ${(fraction * 100).toInt()}%")
                }
                deps.prefs.addRecent(token)
                matchId?.let { deps.prefs.setVoiceChoice(key, it) }
                c.message(if (copies == 1) "Printed ${token.name}." else "Printed $copies × ${token.name}.")
                printing = false
                delay(3_000)
                c.remove()
            } catch (e: ApiException) {
                c.message(e.message?.let { if (it.startsWith("Print failed")) it else "Print failed: $it" } ?: "Print failed.", failed = true)
            } catch (e: SecurityException) {
                c.message("Print failed: Bluetooth permission was refused.", failed = true)
            } finally {
                printing = false
            }
        }
    }

    // --- The card -----------------------------------------------------------

    private fun card(): Card = card ?: Card().also { card = it }

    /** The small panel under the bubble: a message, or a match with Print / Next / Cancel. */
    private inner class Card {
        private val ctx = ContextThemeWrapper(this@BubbleService, android.R.style.Theme_Material_Light)
        private val title = TextView(ctx).apply { textSize = 16f; setTypeface(typeface, Typeface.BOLD); setTextColor(Color.BLACK) }
        private val subtitle = TextView(ctx).apply { textSize = 13f; setTextColor(Color.DKGRAY) }
        private val image = ImageView(ctx).apply { adjustViewBounds = true; scaleType = ImageView.ScaleType.FIT_CENTER }
        private val status = TextView(ctx).apply { textSize = 14f; setPadding(0, dp(8), 0, 0) }
        private val printButton = Button(ctx).apply { text = "Print" }
        private val nextButton = Button(ctx).apply { text = "Next" }
        private val closeButton = Button(ctx).apply { text = "Cancel" }
        private val root = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(8))
            elevation = dp(8).toFloat()
            background = GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = dp(20).toFloat() }
            addView(title)
            addView(subtitle)
            addView(image, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(220)).apply { topMargin = dp(8) })
            addView(status)
            addView(LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.END
                addView(closeButton)
                addView(nextButton)
                addView(printButton)
            })
        }
        private var shown = false

        init {
            closeButton.setOnClickListener {
                if (!printing) work?.cancel()
                remove()
            }
        }

        fun show() {
            if (shown) return
            val width = minOf(resources.displayMetrics.widthPixels - dp(32), dp(360))
            val params = overlayParams(width, WindowManager.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                y = dp(72)
            }
            wm.addView(root, params)
            shown = true
        }

        fun remove() {
            if (shown) wm.removeView(root)
            shown = false
            if (card === this) card = null
        }

        fun message(text: String, failed: Boolean = false) {
            title.visibility = View.GONE
            subtitle.visibility = View.GONE
            image.visibility = View.GONE
            status.text = text
            status.setTextColor(if (failed) ERROR else Color.BLACK)
            printButton.visibility = View.GONE
            nextButton.visibility = View.GONE
            closeButton.text = if (failed) "Close" else "Cancel"
            closeButton.visibility = View.VISIBLE
            show()
        }

        fun candidate(name: String, details: String, label: Bitmap, onPrint: () -> Unit, onNext: (() -> Unit)?) {
            title.text = name
            title.visibility = View.VISIBLE
            subtitle.text = details
            subtitle.visibility = View.VISIBLE
            image.setImageBitmap(label)
            image.visibility = View.VISIBLE
            status.text = ""
            printButton.visibility = View.VISIBLE
            printButton.isEnabled = true
            printButton.setOnClickListener { onPrint() }
            nextButton.visibility = if (onNext != null) View.VISIBLE else View.GONE
            nextButton.isEnabled = true
            nextButton.setOnClickListener { onNext?.invoke() }
            closeButton.text = "Cancel"
            closeButton.visibility = View.VISIBLE
            show()
        }

        fun printing(text: String) {
            status.text = text
            status.setTextColor(Color.BLACK)
            printButton.isEnabled = false
            nextButton.isEnabled = false
            closeButton.visibility = View.GONE
            show()
        }
    }

    companion object {
        private const val CHANNEL = "voice_bubble"
        private const val NOTIFICATION_ID = 1
        private const val ACTION_STOP = "ca.tariqsingh.tokenprinter.STOP_BUBBLE"
        private const val IDLE = 0xFF6750A4.toInt()
        private const val LISTENING = 0xFFD32F2F.toInt()
        private const val ERROR = 0xFFB3261E.toInt()

        /** The bubble needs "Display over other apps" and the microphone; printing also needs Bluetooth. */
        fun canRun(context: Context): Boolean =
            Settings.canDrawOverlays(context) &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, BubbleService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BubbleService::class.java))
        }
    }
}
