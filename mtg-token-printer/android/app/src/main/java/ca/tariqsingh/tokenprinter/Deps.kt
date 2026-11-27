package ca.tariqsingh.tokenprinter

import android.content.Context
import android.graphics.Bitmap

/**
 * One printer, Scryfall client and set of prefs for the whole app, so the
 * screens and the voice bubble never open two Bluetooth links at once.
 */
class Deps private constructor(context: Context) {
    val prefs = Prefs(context)
    val scryfall = Scryfall(context.cacheDir)
    val printer = B1Printer(context, prefs)

    companion object {
        @Volatile private var instance: Deps? = null

        fun get(context: Context): Deps = instance ?: synchronized(this) {
            instance ?: Deps(context.applicationContext).also { instance = it }
        }
    }
}

/** The label as print dots: black = true, placed on the printer's 640-wide bitmap. */
fun toPrintBits(label: Bitmap): BooleanArray {
    val w = label.width
    val h = label.height
    val pixels = IntArray(w * h)
    label.getPixels(pixels, 0, w, 0, 0, w, h)
    val black = BooleanArray(pixels.size) { Dither.luma(pixels[it]) < 128 }
    return Niimbot.onPrintCanvas(black, w, h)
}
