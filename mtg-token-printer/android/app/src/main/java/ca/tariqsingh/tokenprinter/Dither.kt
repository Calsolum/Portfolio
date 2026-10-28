package ca.tariqsingh.tokenprinter

/** Plain-Kotlin image helpers, kept free of Android classes so they can be unit tested. */
object Dither {
    /** Grey level (0-255) of an ARGB colour, using the same weights as Pillow's "L" mode. */
    fun luma(argb: Int): Int {
        val r = (argb shr 16) and 0xFF
        val g = (argb shr 8) and 0xFF
        val b = argb and 0xFF
        return (r * 299 + g * 587 + b * 114) / 1000
    }

    /** Stretch grey levels so the darkest and lightest `cutoff` share become pure black and white. */
    fun autocontrast(gray: IntArray, cutoff: Double): IntArray {
        if (gray.isEmpty()) return gray
        val hist = IntArray(256)
        gray.forEach { hist[it.coerceIn(0, 255)]++ }
        val cut = (gray.size * cutoff).toInt()
        var lo = 0
        var seen = 0
        while (lo < 255 && seen + hist[lo] <= cut) seen += hist[lo++]
        var hi = 255
        seen = 0
        while (hi > 0 && seen + hist[hi] <= cut) seen += hist[hi--]
        if (hi <= lo) return gray.copyOf()
        val range = (hi - lo).toDouble()
        return IntArray(gray.size) { (((gray[it] - lo) * 255.0 / range).toInt()).coerceIn(0, 255) }
    }

    /** Floyd-Steinberg dithering; returns true for each pixel that prints black. */
    fun floydSteinberg(gray: IntArray, w: Int, h: Int): BooleanArray {
        val err = FloatArray(gray.size) { gray[it].toFloat() }
        val black = BooleanArray(gray.size)
        for (y in 0 until h) {
            for (x in 0 until w) {
                val i = y * w + x
                val old = err[i]
                val isBlack = old < 128f
                black[i] = isBlack
                val e = old - (if (isBlack) 0f else 255f)
                if (x + 1 < w) err[i + 1] += e * 7 / 16
                if (y + 1 < h) {
                    if (x > 0) err[i + w - 1] += e * 3 / 16
                    err[i + w] += e * 5 / 16
                    if (x + 1 < w) err[i + w + 1] += e * 1 / 16
                }
            }
        }
        return black
    }
}
