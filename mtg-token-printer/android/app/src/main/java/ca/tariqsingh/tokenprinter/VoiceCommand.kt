package ca.tariqsingh.tokenprinter

/**
 * What was said to the bubble: how many copies, which token, and whether it's a
 * Balloon or Brenard copy of a creature ([rule]) rather than a plain token.
 *
 * "two goblins" -> 2 x token search "goblin"
 * "balloon copy of llanowar elves" -> 1 x Balloon copy of the creature "llanowar elves"
 * "print three food copies of grizzly bears" -> 3 x Brenard copy of "grizzly bears"
 */
data class VoiceCommand(val copies: Int, val query: String, val rule: CopyRule? = null) {
    companion object {
        const val MAX_COPIES = 10

        private val FILLER = Regex("^(please |can you |could you )*(print|make|create|give me|i need|i want)( me)? ")
        private val COUNT_WORDS = mapOf(
            "a" to 1, "an" to 1, "one" to 1, "two" to 2, "to" to 2, "too" to 2, "three" to 3, "four" to 4,
            "for" to 4, "five" to 5, "six" to 6, "seven" to 7, "eight" to 8, "nine" to 9, "ten" to 10,
        )
        private val COPY_PREFIXES = listOf(
            Regex("^(the )?(jolly )?balloon( man)?( copy| copies)?( of)? ") to CopyRule.BALLOON,
            Regex("^(brenard( copy| copies)?|food golem( copy| copies)?|(food|golem) (copy|copies))( of)? ") to CopyRule.BRENARD,
        )

        /** Parse recognised speech; null when nothing is left to search for. */
        fun parse(spoken: String): VoiceCommand? {
            var s = spoken.lowercase().replace(Regex("[.!?,]"), " ").replace(Regex("\\s+"), " ").trim() + " "
            s = s.replace(FILLER, "").replace(Regex("\\btokens? "), "")

            var copies = 1
            fun takeCount() {
                val word = s.substringBefore(" ")
                val n = word.toIntOrNull() ?: COUNT_WORDS[word]
                // "to"/"for" only count when more follows ("two goblins", not "for" alone).
                if (n != null && s.length > word.length + 1) {
                    copies = n
                    s = s.substringAfter(" ").replace(Regex("^(x |times |copies of |copy of )"), "")
                }
            }

            takeCount()
            var rule: CopyRule? = null
            for ((prefix, r) in COPY_PREFIXES) {
                val match = prefix.find(s) ?: continue
                // "balloon" or "food golem" on its own is a token search, not a copy of nothing.
                if (s.substring(match.range.last + 1).isBlank()) break
                rule = r
                s = s.substring(match.range.last + 1)
                break
            }
            if (rule != null) takeCount()

            val words = s.trim().split(" ").filter { it.isNotEmpty() }
            // Card names are searched as said; token searches match Scryfall's singular names.
            val query = (if (rule == null) words.map(::singular) else words).joinToString(" ")
            if (query.isBlank()) return null
            return VoiceCommand(copies.coerceIn(1, MAX_COPIES), query, rule)
        }

        /** "goblins" -> "goblin", "elves" -> "elf", "zombies" -> "zombie"; leaves "glass" and short words alone. */
        fun singular(word: String): String = when {
            word.length <= 3 || !word.endsWith("s") || word.endsWith("ss") -> word
            word.endsWith("lves") || word.endsWith("rves") -> word.dropLast(3) + "f"
            else -> word.dropLast(1)
        }
    }
}
