package ca.tariqsingh.tokenprinter

/**
 * A card that makes a token copy of a creature "except" for some changes.
 * [copy] applies those changes to the creature: same name, art and abilities,
 * the card's power/toughness, its extra types and abilities, and a reminder
 * line for whatever isn't printed on the token itself.
 */
data class CopyRule(
    val key: String,
    val power: String,
    val toughness: String,
    /** Card types the copy gains, e.g. "Artifact". */
    val addTypes: List<String> = emptyList(),
    /** Subtypes the copy gains, e.g. "Food", "Golem". */
    val addSubtypes: List<String> = emptyList(),
    /** Keywords the copy gains; printed first, and bare lines of them are dropped from the original. */
    val keywords: List<String> = emptyList(),
    /** Other abilities the copy gains, printed after the original's. */
    val abilities: List<String> = emptyList(),
    val reminder: String? = null,
) {
    fun copy(card: Token): Token {
        val kept = card.text.lines().map { it.trim() }.filter { it.isNotEmpty() && !isOnlyKeywords(it) }
        val keywordLine = keywords.joinToString(", ").replaceFirstChar { it.uppercase() }.ifEmpty { null }
        val text = listOfNotNull(keywordLine) + kept + abilities + listOfNotNull(reminder?.let { "($it)" })
        return card.copy(
            id = card.id?.let { "$key:$it" },
            typeLine = typeLine(card.typeLine),
            text = text.joinToString("\n"),
            power = power,
            toughness = toughness,
        )
    }

    /** "Legendary Creature — Human Clown" plus Artifact and Food Golem is "Legendary Token Artifact Creature — Human Clown Food Golem". */
    fun typeLine(original: String): String {
        // Double-faced cards list both faces ("A // B"); the copy is the front face.
        val front = original.substringBefore(" // ").trim()
        val words = front.substringBefore("—").trim().split(" ").filter { it.isNotEmpty() && it != "Token" }
        val (supertypes, types) = words.partition { it in SUPERTYPES }
        val cardTypes = (addTypes.filterNot { it in types } + types).sortedBy { TYPE_ORDER.indexOf(it) }
        val subtypes = front.substringAfter("—", "").trim().split(" ").filter { it.isNotEmpty() }
        val allSubtypes = subtypes + addSubtypes.filterNot { add -> subtypes.any { it.equals(add, ignoreCase = true) } }
        return (supertypes + "Token" + cardTypes).joinToString(" ") + " — " + allSubtypes.joinToString(" ")
    }

    private fun isOnlyKeywords(line: String): Boolean =
        keywords.isNotEmpty() && line.split(",").all { part -> keywords.any { it.equals(part.trim(), ignoreCase = true) } }

    companion object {
        /** Scryfall query for the creatures these cards copy. */
        const val TARGETS = "t:creature"

        private val SUPERTYPES = setOf("Legendary", "Snow", "Basic", "World")

        // Unknown types sort first (indexOf = -1), so "Kindred" etc. keep their place ahead.
        private val TYPE_ORDER = listOf("Enchantment", "Artifact", "Creature")

        /**
         * The Jolly Balloon Man: "Create a token that's a copy of another target creature
         * you control, except it's a 1/1 red Balloon creature in addition to its other
         * colors and types and it has flying and haste. Sacrifice it at the beginning of
         * the next end step."
         */
        val BALLOON = CopyRule(
            key = "balloon",
            power = "1",
            toughness = "1",
            addSubtypes = listOf("Balloon"),
            keywords = listOf("flying", "haste"),
            reminder = "Red in addition to its other colors. Sacrifice it at the beginning of the next end step.",
        )

        /**
         * Brenard, Ginger Sculptor: "Whenever another nontoken creature you control dies,
         * you may exile it. If you do, create a token that's a copy of that creature, except
         * it's a 1/1 Food Golem artifact creature in addition to its other types and it has
         * "{2}, {T}, Sacrifice this token: You gain 3 life."" Brenard also gives each Food
         * or Golem you control +2/+2 and trample, which the reminder notes.
         */
        val BRENARD = CopyRule(
            key = "brenard",
            power = "1",
            toughness = "1",
            addTypes = listOf("Artifact"),
            addSubtypes = listOf("Food", "Golem"),
            abilities = listOf("{2}, {T}, Sacrifice this token: You gain 3 life."),
            reminder = "Gets +2/+2 and has trample while you control Brenard, Ginger Sculptor.",
        )
    }
}
