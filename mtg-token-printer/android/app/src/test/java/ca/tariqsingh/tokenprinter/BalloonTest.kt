package ca.tariqsingh.tokenprinter

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class BalloonTest {
    private val elf = JSONObject(
        """
        {"id": "abc", "name": "Llanowar Elves", "type_line": "Creature — Elf Druid",
         "oracle_text": "{T}: Add {G}.", "power": "1", "toughness": "1",
         "artist": "Someone", "set_name": "Dominaria", "keywords": [],
         "image_uris": {"small": "s.jpg", "art_crop": "a.jpg"}}
        """,
    )

    @Test
    fun copyBecomesOneOneBalloonWithFlyingAndHaste() {
        val t = Balloon.copyOf(elf)
        assertEquals("balloon-abc", t.id)
        assertEquals("Llanowar Elves", t.name)
        assertEquals("Creature — Elf Druid Balloon", t.typeLine)
        assertEquals("Flying, haste\n{T}: Add {G}.\n" + Balloon.REMINDER, t.text)
        assertEquals("1/1", t.pt)
        assertEquals("a.jpg", t.artUrl)
        assertEquals("Someone", t.artist)
    }

    @Test
    fun keepsOtherStatsOutAndDoesNotRepeatKeywords() {
        val dragon = Token(id = "d", name = "Shivan Dragon", typeLine = "Creature — Dragon",
            text = "Flying\n{R}: Shivan Dragon gets +1/+0 until end of turn.", power = "5", toughness = "5")
        val t = Balloon.copyOf(dragon, setOf("flying"))
        assertEquals("Haste\nFlying\n{R}: Shivan Dragon gets +1/+0 until end of turn.\n" + Balloon.REMINDER, t.text)
        assertEquals("1/1", t.pt)
        assertEquals("Flying, haste\n" + Balloon.REMINDER, Balloon.copyOf(dragon.copy(text = ""), emptySet()).text)
        assertEquals(Balloon.REMINDER, Balloon.copyOf(dragon.copy(text = ""), setOf("flying", "haste")).text)
    }

    @Test
    fun typeLineGainsBalloon() {
        assertEquals("Legendary Creature — Human Clown Balloon", Balloon.withBalloon("Legendary Creature — Human Clown"))
        assertEquals("Artifact Creature — Balloon", Balloon.withBalloon("Artifact Creature"))
        assertEquals("Creature — Balloon", Balloon.withBalloon("Creature — Balloon"))
    }
}
