package ca.tariqsingh.tokenprinter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** A token from Scryfall, or one typed in on the Custom tab (id is null). */
data class Token(
    val id: String?,
    val name: String,
    val typeLine: String,
    val text: String = "",
    val power: String? = null,
    val toughness: String? = null,
    val setName: String = "",
    val thumbUrl: String? = null,
) {
    val pt: String? get() = if (!power.isNullOrBlank() && !toughness.isNullOrBlank()) "$power/$toughness" else null

    /** The request body that tells the Pi which token to draw. */
    fun requestJson(): JSONObject = if (id != null) {
        JSONObject().put("id", id)
    } else {
        JSONObject().put(
            "custom",
            JSONObject()
                .put("name", name)
                .put("type_line", typeLine)
                .put("text", text)
                .put("power", power ?: "")
                .put("toughness", toughness ?: ""),
        )
    }

    fun toJson(): JSONObject = JSONObject()
        .put("id", id ?: JSONObject.NULL)
        .put("name", name)
        .put("type_line", typeLine)
        .put("text", text)
        .put("power", power ?: JSONObject.NULL)
        .put("toughness", toughness ?: JSONObject.NULL)
        .put("set_name", setName)
        .put("thumb_url", thumbUrl ?: JSONObject.NULL)

    companion object {
        fun fromJson(o: JSONObject) = Token(
            id = o.optStringOrNull("id"),
            name = o.optString("name"),
            typeLine = o.optString("type_line"),
            text = o.optString("text"),
            power = o.optStringOrNull("power"),
            toughness = o.optStringOrNull("toughness"),
            setName = o.optString("set_name"),
            thumbUrl = o.optStringOrNull("thumb_url"),
        )
    }
}

private fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else optString(key).ifEmpty { null }

/** A failure the user should see as-is, e.g. "Print failed: printer not connected". */
class ApiException(message: String) : Exception(message)

enum class JobState { QUEUED, PRINTING, DONE, FAILED }

data class JobStatus(val state: JobState, val error: String?)

/** Talks to the token routes on the Kitchen Hub label server. */
class Api(baseUrl: String) {
    private val base = baseUrl.trim().trimEnd('/')

    suspend fun health(): String = withContext(Dispatchers.IO) {
        val o = JSONObject(request("GET", "/tokens/health").decodeToString())
        val label = o.getJSONObject("label")
        if (o.optBoolean("ready")) {
            "Connected. 50×80 mm labels are selected."
        } else {
            "Connected, but the printer is set to ${label.getInt("width")}×${label.getInt("height")} px. " +
                "Pick the 50×80 mm size on the Kitchen Hub."
        }
    }

    suspend fun search(query: String): List<Token> = withContext(Dispatchers.IO) {
        val q = URLEncoder.encode(query, "UTF-8")
        val results = JSONObject(request("GET", "/tokens/search?q=$q").decodeToString()).getJSONArray("results")
        List(results.length()) { Token.fromJson(results.getJSONObject(it)) }
    }

    suspend fun preview(token: Token): Bitmap = withContext(Dispatchers.IO) {
        val bytes = request("POST", "/preview/token", token.requestJson())
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: throw ApiException("The preview didn't load.")
    }

    suspend fun print(token: Token, copies: Int): String = withContext(Dispatchers.IO) {
        val body = token.requestJson().put("copies", copies)
        JSONObject(request("POST", "/print/token", body).decodeToString()).getString("job")
    }

    suspend fun status(job: String): JobStatus = withContext(Dispatchers.IO) {
        val o = JSONObject(request("GET", "/print/token/$job").decodeToString())
        val state = when (o.optString("state")) {
            "queued" -> JobState.QUEUED
            "done" -> JobState.DONE
            "failed" -> JobState.FAILED
            else -> JobState.PRINTING
        }
        JobStatus(state, o.optStringOrNull("error"))
    }

    private fun request(method: String, path: String, body: JSONObject? = null): ByteArray {
        if (base.isEmpty()) throw ApiException("Set the Pi's address in Settings first.")
        val conn = try {
            URL(base + path).openConnection() as HttpURLConnection
        } catch (e: Exception) {
            throw ApiException("That Pi address doesn't look right.")
        }
        try {
            conn.requestMethod = method
            conn.connectTimeout = 5_000
            conn.readTimeout = 30_000
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val code = conn.responseCode
            if (code !in 200..299) {
                val message = conn.errorStream?.use { it.readBytes().decodeToString() }
                    ?.let { runCatching { JSONObject(it).optString("error") }.getOrNull() }
                    ?.ifEmpty { null }
                throw ApiException(message ?: "The Pi answered with an error ($code).")
            }
            return conn.inputStream.use { it.readBytes() }
        } catch (e: IOException) {
            throw ApiException("Couldn't reach the Pi. Check the address and that you're on home Wi-Fi.")
        } finally {
            conn.disconnect()
        }
    }
}
