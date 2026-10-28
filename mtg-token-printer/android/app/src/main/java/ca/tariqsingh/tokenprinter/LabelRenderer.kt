package ca.tariqsingh.tokenprinter

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface

/**
 * Draws a token as a black-and-white label, the same layout the Pi used:
 * name, dithered art, type line on a black bar, rules text, artist credit and
 * a big power/toughness box. The size is the 50x80 mm label's printable area.
 */
object LabelRenderer {
    const val WIDTH = 577
    const val HEIGHT = 927
    private const val MARGIN = 20

    fun render(token: Token, art: Bitmap?): Bitmap {
        val bmp = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        canvas.drawColor(Color.WHITE)

        val left = MARGIN.toFloat()
        val right = (WIDTH - MARGIN).toFloat()
        val top = MARGIN.toFloat()
        val bottom = (HEIGHT - MARGIN).toFloat()
        val inner = right - left - 32

        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            color = Color.BLACK
            strokeWidth = 4f
        }
        canvas.drawRoundRect(RectF(left + 2, top + 2, right - 2, bottom - 2), 24f, 24f, stroke)

        // Name, centred, shrunk to fit one line.
        val bold = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        val name = token.name.ifBlank { "Token" }
        val namePaint = fit(name, bold, inner, 56f, 26f).apply { textAlign = Paint.Align.CENTER }
        var y = top + 20
        canvas.drawText(name, (left + right) / 2, y - namePaint.ascent(), namePaint)
        y += namePaint.textSize + 20

        // Art, if any. Without art the rules text gets the room.
        val pt = token.pt
        val footer = if (pt != null) 104f else 56f
        if (art != null) {
            val artH = ((bottom - top) * 0.44f).toInt()
            val box = Rect((left + 16).toInt(), y.toInt(), (right - 16).toInt(), y.toInt() + artH)
            canvas.drawBitmap(ditherArt(art, box.width(), box.height()), null, box, null)
            canvas.drawRect(RectF(box), Paint(stroke).apply { strokeWidth = 3f })
            y = box.bottom + 16f
        }

        // Type line on a black bar.
        val typeLine = token.typeLine.ifBlank { "Token" }
        val typePaint = fit(typeLine, bold, inner - 8, 30f, 18f).apply { color = Color.WHITE }
        val barH = typePaint.textSize + 20
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK }
        canvas.drawRoundRect(RectF(left + 16, y, right - 16, y + barH), 10f, 10f, fill)
        canvas.drawText(typeLine, left + 28, y + barH / 2 - (typePaint.ascent() + typePaint.descent()) / 2, typePaint)
        y += barH + 18

        // Rules text fills what's left above the footer.
        val text = token.text.trim()
        if (text.isNotEmpty()) {
            val largest = if (art != null) 34 else 44
            val (paint, lines, lineH) = fitParagraphs(text, inner, bottom - footer - y, largest)
            for (line in lines) {
                canvas.drawText(line, left + 16, y - paint.ascent(), paint)
                y += lineH
            }
        }

        // Footer: artist credit on the left, power/toughness box on the right.
        if (token.artist.isNotBlank()) {
            val credit = "Illus. ${token.artist}"
            val creditPaint = fit(credit, Typeface.DEFAULT, inner - (if (pt != null) 200 else 0), 20f, 14f)
            canvas.drawText(credit, left + 16, bottom - 22, creditPaint)
        }
        if (pt != null) {
            val ptPaint = fit(pt, bold, 150f, 60f, 30f).apply {
                color = Color.WHITE
                textAlign = Paint.Align.CENTER
            }
            val boxW = maxOf(150f, ptPaint.measureText(pt) + 40)
            val box = RectF(right - 16 - boxW, bottom - 16 - 84, right - 16, bottom - 16)
            canvas.drawRoundRect(box, 14f, 14f, fill)
            canvas.drawText(pt, box.centerX(), box.centerY() - (ptPaint.ascent() + ptPaint.descent()) / 2, ptPaint)
        }

        // Text is anti-aliased; snap everything to pure black or white.
        val pixels = IntArray(WIDTH * HEIGHT)
        bmp.getPixels(pixels, 0, WIDTH, 0, 0, WIDTH, HEIGHT)
        for (i in pixels.indices) {
            pixels[i] = if (Dither.luma(pixels[i]) >= 128) Color.WHITE else Color.BLACK
        }
        bmp.setPixels(pixels, 0, WIDTH, 0, 0, WIDTH, HEIGHT)
        return bmp
    }

    private fun paint(typeface: Typeface, size: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.typeface = typeface
        textSize = size
        color = Color.BLACK
    }

    /** The largest size (down to `smallest`) that fits `text` on one line. */
    private fun fit(text: String, typeface: Typeface, maxWidth: Float, start: Float, smallest: Float): Paint {
        var size = start
        var p = paint(typeface, size)
        while (size > smallest && p.measureText(text) > maxWidth) {
            size -= 2
            p = paint(typeface, size)
        }
        return p
    }

    private fun wrap(text: String, p: Paint, maxWidth: Float): List<String> {
        val lines = mutableListOf<String>()
        for (paragraph in text.split("\n")) {
            val words = paragraph.split(" ").filter { it.isNotEmpty() }
            if (words.isEmpty()) {
                lines += ""
                continue
            }
            var line = words[0]
            for (word in words.drop(1)) {
                val trial = "$line $word"
                if (p.measureText(trial) <= maxWidth) line = trial else {
                    lines += line
                    line = word
                }
            }
            lines += line
        }
        return lines
    }

    /** Wrap rules text at the largest size (down to 16 px) that fits the box. */
    private fun fitParagraphs(text: String, maxWidth: Float, maxHeight: Float, largest: Int): Triple<Paint, List<String>, Float> {
        var size = largest
        while (true) {
            val p = paint(Typeface.DEFAULT, size.toFloat())
            val lines = wrap(text, p, maxWidth)
            val lineH = (size * 1.25f).toInt().toFloat()
            if (lines.size * lineH <= maxHeight || size <= 16) {
                return Triple(p, lines.take((maxHeight / lineH).toInt().coerceAtLeast(0)), lineH)
            }
            size -= 2
        }
    }

    /** Crop the art to fill the box, boost contrast and dither it to 1-bit. */
    private fun ditherArt(art: Bitmap, w: Int, h: Int): Bitmap {
        val scale = maxOf(w.toFloat() / art.width, h.toFloat() / art.height)
        val cropW = (w / scale).toInt().coerceAtMost(art.width)
        val cropH = (h / scale).toInt().coerceAtMost(art.height)
        val cropped = Bitmap.createBitmap(art, (art.width - cropW) / 2, (art.height - cropH) / 2, cropW, cropH)
        val scaled = Bitmap.createScaledBitmap(cropped, w, h, true)
        val pixels = IntArray(w * h)
        scaled.getPixels(pixels, 0, w, 0, 0, w, h)
        val gray = IntArray(pixels.size) { Dither.luma(pixels[it]) }
        val bw = Dither.floydSteinberg(Dither.autocontrast(gray, 0.02), w, h)
        val out = IntArray(bw.size) { if (bw[it]) Color.BLACK else Color.WHITE }
        return Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888)
    }
}
