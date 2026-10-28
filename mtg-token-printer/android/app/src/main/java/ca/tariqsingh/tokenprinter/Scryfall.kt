package ca.tariqsingh.tokenprinter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest

/**
 * Token search and art straight from Scryfall's free API. Scryfall asks for a
 * User-Agent, about 10 requests a second at most, and caching; art is cached
 * on the phone so a token printed before needs no download.
 */
class Scryfall(private val cacheDir: File) {
    private val gate = Mutex()
    private var last = 0L

    suspend fun search(query: String): List<Token> = withContext(Dispatchers.IO) {
        val q = URLEncoder.encode("is:token ($query)", "UTF-8")
        val (code, body) = get("$API/cards/search?q=$q&unique=art&order=released&dir=desc")
        when (code) {
            200 -> {
                val data = JSONObject(body.decodeToString()).getJSONArray("data")
                List(minOf(data.length(), 40)) { summarize(data.getJSONObject(it)) }
            }
            404 -> emptyList() // Scryfall's answer for "no matches"
            else -> throw ApiException("Scryfall search failed ($code).")
        }
    }

    /** The token's art crop, or null when it has none or the download fails. */
    suspend fun art(url: String?): Bitmap? = withContext(Dispatchers.IO) {
        if (url == null) return@withContext null
        val file = File(cacheDir, "art-" + sha1(url) + ".jpg")
        if (!file.exists()) {
            val (code, body) = try {
                get(url)
            } catch (e: ApiException) {
                return@withContext null
            }
            if (code != 200) return@withContext null
            file.writeBytes(body)
        }
        BitmapFactory.decodeFile(file.path)
    }

    private suspend fun get(url: String): Pair<Int, ByteArray> {
        gate.withLock {
            val wait = MIN_INTERVAL_MS - (System.currentTimeMillis() - last)
            if (wait > 0) delay(wait)
            last = System.currentTimeMillis()
        }
        val conn = URL(url).openConnection() as HttpURLConnection
        return try {
            conn.setRequestProperty("User-Agent", USER_AGENT)
            conn.setRequestProperty("Accept", "application/json;q=0.9,*/*;q=0.8")
            conn.connectTimeout = 10_000
            conn.readTimeout = 20_000
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            code to (stream?.use { it.readBytes() } ?: ByteArray(0))
        } catch (e: IOException) {
            throw ApiException("Couldn't reach Scryfall. Is the phone online?")
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        private const val API = "https://api.scryfall.com"
        private const val USER_AGENT = "TokenPrinter/2.0 (Android)"
        private const val MIN_INTERVAL_MS = 100L

        /**
         * Reduce a Scryfall card to what the label needs. Double-faced tokens keep
         * their text and art on the first face, so it fills in anything missing.
         */
        fun summarize(card: JSONObject): Token {
            val face = card.optJSONArray("card_faces")?.optJSONObject(0) ?: JSONObject()
            fun pick(key: String): String? = listOf(card, face)
                .firstOrNull { it.has(key) && !it.isNull(key) }?.optString(key)?.ifEmpty { null }
            val images = card.optJSONObject("image_uris") ?: face.optJSONObject("image_uris")
            return Token(
                id = card.getString("id"),
                name = face.optString("name").ifEmpty { card.optString("name") },
                typeLine = face.optString("type_line").ifEmpty { card.optString("type_line") },
                text = pick("oracle_text") ?: "",
                power = pick("power"),
                toughness = pick("toughness"),
                artist = pick("artist") ?: "",
                setName = card.optString("set_name"),
                thumbUrl = images?.optString("small")?.ifEmpty { null },
                artUrl = images?.optString("art_crop")?.ifEmpty { null },
            )
        }

        private fun sha1(s: String) = MessageDigest.getInstance("SHA-1")
            .digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
