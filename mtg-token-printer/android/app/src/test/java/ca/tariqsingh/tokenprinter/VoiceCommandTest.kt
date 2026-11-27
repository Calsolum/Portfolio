package ca.tariqsingh.tokenprinter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VoiceCommandTest {
    private fun parse(s: String) = VoiceCommand.parse(s)

    @Test
    fun plainTokens() {
        assertEquals(VoiceCommand(1, "treasure"), parse("Treasure"))
        assertEquals(VoiceCommand(2, "goblin"), parse("two goblins"))
        assertEquals(VoiceCommand(3, "zombie"), parse("3 zombie tokens"))
        assertEquals(VoiceCommand(1, "elf warrior"), parse("an elf warrior"))
        assertEquals(VoiceCommand(4, "wolf"), parse("Print four wolves."))
        assertEquals(VoiceCommand(2, "clue"), parse("make me 2 copies of clues"))
    }

    @Test
    fun countIsClamped() {
        assertEquals(VoiceCommand(10, "soldier"), parse("40 soldiers"))
        assertEquals(VoiceCommand(1, "soldier"), parse("0 soldiers"))
    }

    @Test
    fun balloonCopies() {
        assertEquals(VoiceCommand(1, "llanowar elves", CopyRule.BALLOON), parse("balloon llanowar elves"))
        assertEquals(VoiceCommand(1, "llanowar elves", CopyRule.BALLOON), parse("Balloon copy of Llanowar Elves"))
        assertEquals(VoiceCommand(2, "grizzly bears", CopyRule.BALLOON), parse("two balloon copies of grizzly bears"))
        assertEquals(VoiceCommand(2, "grizzly bears", CopyRule.BALLOON), parse("jolly balloon man two grizzly bears"))
    }

    @Test
    fun brenardCopies() {
        assertEquals(VoiceCommand(1, "grizzly bears", CopyRule.BRENARD), parse("Brenard grizzly bears"))
        assertEquals(VoiceCommand(3, "grizzly bears", CopyRule.BRENARD), parse("print three food copies of grizzly bears"))
        assertEquals(VoiceCommand(1, "sol ring", CopyRule.BRENARD), parse("food golem copy of sol ring"))
    }

    @Test
    fun bareTokenNamesStayTokenSearches() {
        assertEquals(VoiceCommand(2, "food"), parse("two food"))
        assertEquals(VoiceCommand(1, "food golem"), parse("food golem"))
        assertEquals(VoiceCommand(1, "balloon"), parse("balloon tokens"))
    }

    @Test
    fun nothingToSearch() {
        assertNull(parse(""))
        assertNull(parse("print"))
        assertNull(parse("tokens"))
    }

    @Test
    fun singular() {
        assertEquals("goblin", VoiceCommand.singular("goblins"))
        assertEquals("elf", VoiceCommand.singular("elves"))
        assertEquals("dwarf", VoiceCommand.singular("dwarves"))
        assertEquals("glass", VoiceCommand.singular("glass"))
        assertEquals("ox", VoiceCommand.singular("ox"))
    }
}
