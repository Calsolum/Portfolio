package ca.tariqsingh.tokenprinter

import org.json.JSONObject

/**
 * The token The Jolly Balloon Man makes: a copy of another creature you control,
 * except it's a 1/1 red Balloon in addition to its other colours and types, with
 * flying and haste, sacrificed at the beginning of the next end step.
 */
object Balloon {
    const val REMINDER = "At the beginning of the next end step, sacrifice this token."

    /** The Balloon copy of a Scryfall creature card. */
    fun copyOf(card: JSONObject): Token {
        val base = Scryfall.summarize(card)
        val keywords = card.optJSONArray("keywords")
        val has = List(keywords?.length() ?: 0) { keywords!!.optString(it).lowercase() }.toSet()
        return copyOf(base, has)
    }

    /** `keywords` are the card's keywords in lower case, so flying or haste isn't listed twice. */
    fun copyOf(card: Token, keywords: Set<String>): Token {
        val gained = listOf("Flying", "haste").filter { it.lowercase() !in keywords }
        val gainedLine = when (gained.size) {
            2 -> "Flying, haste"
            1 -> gained[0].replaceFirstChar { it.uppercase() }
            else -> null
        }
        val text = listOfNotNull(gainedLine, card.text.trim().ifEmpty { null }, REMINDER).joinToString("\n")
        return card.copy(
            id = card.id?.let { "balloon-$it" },
            typeLine = withBalloon(card.typeLine),
            text = text,
            power = "1",
            toughness = "1",
        )
    }

    /** "Creature — Elf Druid" becomes "Creature — Elf Druid Balloon". */
    fun withBalloon(typeLine: String): String {
        val parts = typeLine.split(" — ", limit = 2)
        val types = parts[0].trim()
        val subtypes = parts.getOrNull(1)?.trim().orEmpty()
        if (subtypes.split(" ").any { it == "Balloon" }) return typeLine
        return if (subtypes.isEmpty()) "$types — Balloon" else "$types — $subtypes Balloon"
    }
}
