package ca.tariqsingh.tokenprinter

/**
 * The Jolly Balloon Man: "{1}, {T}: Create a token that's a copy of another
 * target creature you control, except it's a 1/1 red Balloon creature in
 * addition to its other colors and types and it has flying and haste.
 * Sacrifice it at the beginning of the next end step."
 *
 * [copy] turns any creature into that token: same name, art and abilities,
 * but 1/1, Balloon added to its creature types, and flying and haste added.
 */
object Balloon {
    /** Scryfall query for the creatures the ability can target. */
    const val TARGETS = "t:creature"

    private val keywordOnly = Regex("^(flying|haste)(\\s*,\\s*(flying|haste))*$", RegexOption.IGNORE_CASE)

    fun copy(card: Token): Token {
        // Keep the card's own abilities, minus a bare "Flying"/"Haste" line the copy now has anyway.
        val abilities = card.text.lines().map { it.trim() }.filter { it.isNotEmpty() && !keywordOnly.matches(it) }
        val text = (listOf("Flying, haste") + abilities + REMINDER).joinToString("\n")
        return card.copy(
            id = card.id?.let { "balloon:$it" },
            typeLine = typeLine(card.typeLine),
            text = text,
            power = "1",
            toughness = "1",
        )
    }

    /** "Legendary Creature — Human Clown" becomes "Legendary Token Creature — Human Clown Balloon". */
    fun typeLine(original: String): String {
        // Double-faced cards list both faces ("A // B"); the copy is the front face.
        val front = original.substringBefore(" // ").trim()
        val types = front.substringBefore("—").trim()
        val subtypes = front.substringAfter("—", "").trim()
            .split(" ").filter { it.isNotEmpty() && !it.equals("Balloon", ignoreCase = true) }
        val withToken = if (Regex("\\bToken\\b").containsMatchIn(types)) {
            types
        } else {
            types.replace(Regex("\\b(Artifact |Enchantment )?Creature\\b")) { "Token ${it.value}" }
        }
        return "$withToken — ${(subtypes + "Balloon").joinToString(" ")}"
    }

    private const val REMINDER = "(Red in addition to its other colors. Sacrifice it at the beginning of the next end step.)"
}
