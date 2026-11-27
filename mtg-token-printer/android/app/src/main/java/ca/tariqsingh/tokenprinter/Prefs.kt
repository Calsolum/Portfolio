package ca.tariqsingh.tokenprinter

import android.content.Context
import org.json.JSONArray

/** The printer's Bluetooth address, the last few tokens printed and the voice bubble's settings, kept on the phone. */
class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("token_printer", Context.MODE_PRIVATE)

    /** Remembered after the first scan, so later prints connect without searching. */
    var printerAddress: String?
        get() = prefs.getString("printer_address", null)
        set(value) = prefs.edit().putString("printer_address", value).apply()

    /** The voice bubble is on; it comes back when the app is next opened. */
    var bubbleEnabled: Boolean
        get() = prefs.getBoolean("bubble_enabled", false)
        set(value) = prefs.edit().putBoolean("bubble_enabled", value).apply()

    /** Which result a spoken search last printed, so "goblin" keeps finding the same Goblin. */
    fun voiceChoice(key: String): String? = prefs.getString("voice_choice:$key", null)

    fun setVoiceChoice(key: String, id: String) = prefs.edit().putString("voice_choice:$key", id).apply()

    fun recent(): List<Token> {
        val array = JSONArray(prefs.getString("recent", "[]"))
        return List(array.length()) { Token.fromJson(array.getJSONObject(it)) }
    }

    fun addRecent(token: Token) {
        val list = listOf(token) + recent().filterNot { it.sameAs(token) }
        val array = JSONArray()
        list.take(MAX_RECENT).forEach { array.put(it.toJson()) }
        prefs.edit().putString("recent", array.toString()).apply()
    }

    private fun Token.sameAs(other: Token) =
        if (id != null) id == other.id else other.id == null && name == other.name && typeLine == other.typeLine

    companion object {
        const val MAX_RECENT = 12
    }
}
