package ca.tariqsingh.tokenprinter

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Expected bytes come from the Pi's working NiimPrintX code (packet.py, printer.py). */
class NiimbotTest {
    private fun hex(s: String) = s.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

    @Test fun startPrintUsesTheSevenByteB1Form() =
        assertArrayEquals(hex("555501070002000000000004aaaa"), Niimbot.startPrint(2).toBytes())

    @Test fun setDimensionUsesTheSixByteB1Form() =
        assertArrayEquals(hex("55551306039f0280000209aaaa"), Niimbot.setDimension(927, 640, 2).toBytes())

    @Test fun setQuantity() = assertArrayEquals(hex("55551502000215aaaa"), Niimbot.setQuantity(2).toBytes())

    @Test fun setDensity() = assertArrayEquals(hex("555521010323aaaa"), Niimbot.setLabelDensity(3).toBytes())

    @Test fun imageRowCarriesRealBlackCountAndMsbFirstBits() {
        val row = BooleanArray(16 * 6)
        for (x in listOf(0, 1, 9, 15)) row[5 * 16 + x] = true
        assertArrayEquals(hex("55558508000500000401c0410caaaa"), Niimbot.imageRow(5, row, 16).toBytes())
    }

    @Test fun fullWidthRowFitsTheRequestedMtu() {
        val bytes = Niimbot.imageRow(0, BooleanArray(Niimbot.PRINT_WIDTH), Niimbot.PRINT_WIDTH).toBytes()
        assertEquals(93, bytes.size)
    }

    @Test fun rowDelayMatchesThePi() = assertEquals(40L, Niimbot.rowDelayMs(640))

    @Test fun parserHandlesSplitAndBackToBackReplies() {
        val parser = Niimbot.Parser()
        val a = Niimbot.Packet(0x22, byteArrayOf(1)).toBytes()
        val b = Niimbot.Packet(0xB3, byteArrayOf(0, 2, 50, 50)).toBytes()
        val all = byteArrayOf(0x01, 0x02) + a + b // leading noise
        assertTrue(parser.feed(all.copyOfRange(0, 5)).isEmpty())
        val packets = parser.feed(all.copyOfRange(5, all.size))
        assertEquals(listOf(0x22, 0xB3), packets.map { it.type })
        assertTrue(packets[0].ok)
        assertEquals(2, Niimbot.statusPage(packets[1]))
    }

    @Test fun parserSkipsBadChecksum() {
        val bad = Niimbot.Packet(0x22, byteArrayOf(1)).toBytes().also { it[5] = 0x7F }
        val good = Niimbot.Packet(0x24, byteArrayOf(1)).toBytes()
        assertEquals(listOf(0x24), Niimbot.Parser().feed(bad + good).map { it.type })
    }

    @Test fun tokenSitsAtTheLeftOfThePrintBitmap() {
        val token = BooleanArray(3 * 2) { true }
        val out = Niimbot.onPrintCanvas(token, 3, 2)
        assertEquals(Niimbot.PRINT_WIDTH * 2, out.size)
        assertTrue(out[0] && out[2] && !out[3])
        assertTrue(out[Niimbot.PRINT_WIDTH] && !out[Niimbot.PRINT_WIDTH + 3])
    }
}
