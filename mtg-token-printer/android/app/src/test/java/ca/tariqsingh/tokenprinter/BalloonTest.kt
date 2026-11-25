package ca.tariqsingh.tokenprinter

import org.junit.Assert.assertEquals
import org.junit.Test

class BalloonTest {
    private val elves = Token(
        id = "abc",
        name = "Llanowar Elves",
        typeLine = "Creature — Elf Druid",
        text = "{T}: Add {G}.",
        power = "1",
        toughness = "1",
        artist = "Someone",
    )

    @Test
    fun copyIsAOneOneBalloonWithFlyingAndHaste() {
        val copy = Balloon.copy(elves.copy(power = "4", toughness = "5"))
        assertEquals("Llanowar Elves", copy.name)
        assertEquals("Token Creature — Elf Druid Balloon", copy.typeLine)
        assertEquals("1/1", copy.pt)
        assertEquals(
            "Flying, haste\n{T}: Add {G}.\n" +
                "(Red in addition to its other colors. Sacrifice it at the beginning of the next end step.)",
            copy.text,
        )
        assertEquals("balloon:abc", copy.id)
        assertEquals("Someone", copy.artist)
    }

    @Test
    fun keywordLinesTheCopyAlreadyHasAreDropped() {
        val copy = Balloon.copy(elves.copy(text = "Flying\nHaste\nFlying, vigilance"))
        assertEquals(listOf("Flying, haste", "Flying, vigilance"), copy.text.lines().dropLast(1))
    }

    @Test
    fun typeLines() {
        assertEquals("Legendary Token Creature — Human Clown Balloon", Balloon.typeLine("Legendary Creature — Human Clown"))
        assertEquals("Token Artifact Creature — Construct Balloon", Balloon.typeLine("Artifact Creature — Construct"))
        assertEquals("Token Creature — Balloon", Balloon.typeLine("Creature"))
        assertEquals("Token Creature — Goblin Balloon", Balloon.typeLine("Token Creature — Goblin"))
        assertEquals("Token Creature — Human Werewolf Balloon", Balloon.typeLine("Creature — Human Werewolf // Creature — Werewolf"))
    }
}
