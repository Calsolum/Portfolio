package ca.tariqsingh.tokenprinter

import android.content.Context
import org.json.JSONArray

/** The Pi's address and the last few tokens printed, kept on the phone. */
class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("token_printer", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "") ?: ""
        set(value) = prefs.edit().putString("server_url", value.trim()).apply()

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
