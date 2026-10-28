package ca.tariqsingh.tokenprinter

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DitherTest {
    @Test fun lumaMatchesPillowWeights() {
        assertEquals(255, Dither.luma(0xFFFFFFFF.toInt()))
        assertEquals(0, Dither.luma(0xFF000000.toInt()))
        assertEquals(76, Dither.luma(0xFFFF0000.toInt()))
    }

    @Test fun autocontrastStretchesToFullRange() {
        val out = Dither.autocontrast(IntArray(100) { 100 + it }, 0.0)
        assertEquals(0, out.first())
        assertEquals(255, out.last())
    }

    @Test fun ditheredMidGreyIsAboutHalfBlack() {
        val black = Dither.floydSteinberg(IntArray(64 * 64) { 128 }, 64, 64)
        val share = black.count { it }.toDouble() / black.size
        assertTrue("share was $share", share in 0.4..0.6)
    }

    @Test fun summarizeTakesFrontFaceOfDoubleFacedToken() {
        val card = JSONObject(
            """{"id":"1a2b","name":"Incubator // Phyrexian","card_faces":[
               {"name":"Incubator","type_line":"Token Artifact","oracle_text":"{2}: Transform this artifact.",
                "artist":"Ryan Pancoast","image_uris":{"art_crop":"https://x/inc.jpg"}},
               {"name":"Phyrexian","power":"0","toughness":"0"}]}""",
        )
        val t = Scryfall.summarize(card)
        assertEquals("Incubator", t.name)
        assertEquals("Token Artifact", t.typeLine)
        assertEquals("Ryan Pancoast", t.artist)
        assertEquals("https://x/inc.jpg", t.artUrl)
    }

    @Test fun summarizeReadsTopLevelToken() {
        val card = JSONObject(
            """{"id":"0f8b","name":"Goblin","type_line":"Token Creature — Goblin","oracle_text":"",
               "power":"1","toughness":"1","artist":"Kev Walker","set_name":"MKM Tokens",
               "image_uris":{"art_crop":"https://x/g.jpg","small":"https://x/gs.jpg"}}""",
        )
        val t = Scryfall.summarize(card)
        assertEquals("1/1", t.pt)
        assertEquals("https://x/gs.jpg", t.thumbUrl)
    }
}
