package ca.tariqsingh.tokenprinter

import org.json.JSONObject

/** A token from Scryfall, or one typed in on the "Make your own" tab (id is null). */
data class Token(
    val id: String?,
    val name: String,
    val typeLine: String,
    val text: String = "",
    val power: String? = null,
    val toughness: String? = null,
    val artist: String = "",
    val setName: String = "",
    val thumbUrl: String? = null,
    val artUrl: String? = null,
) {
    val pt: String? get() = if (!power.isNullOrBlank() && !toughness.isNullOrBlank()) "$power/$toughness" else null

    fun toJson(): JSONObject = JSONObject()
        .put("id", id ?: JSONObject.NULL)
        .put("name", name)
        .put("type_line", typeLine)
        .put("text", text)
        .put("power", power ?: JSONObject.NULL)
        .put("toughness", toughness ?: JSONObject.NULL)
        .put("artist", artist)
        .put("set_name", setName)
        .put("thumb_url", thumbUrl ?: JSONObject.NULL)
        .put("art_url", artUrl ?: JSONObject.NULL)

    companion object {
        fun fromJson(o: JSONObject) = Token(
            id = o.optStringOrNull("id"),
            name = o.optString("name"),
            typeLine = o.optString("type_line"),
            text = o.optString("text"),
            power = o.optStringOrNull("power"),
            toughness = o.optStringOrNull("toughness"),
            artist = o.optString("artist"),
            setName = o.optString("set_name"),
            thumbUrl = o.optStringOrNull("thumb_url"),
            artUrl = o.optStringOrNull("art_url"),
        )
    }
}

private fun JSONObject.optStringOrNull(key: String): String? =
    if (!has(key) || isNull(key)) null else optString(key).ifEmpty { null }

/** A failure the user should see as-is, e.g. "Turn on Bluetooth first." */
class ApiException(message: String) : Exception(message)
