package com.senoriales.app.network

import com.senoriales.app.BuildConfig
import com.senoriales.app.data.ConversationTokenRequest
import com.senoriales.app.data.SignedUrlResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Lightweight HTTP client for the Señoriales backend.
 * Handles signed URL fetching with in-memory TTL cache.
 */
object ApiClient {

    private val json = Json { ignoreUnknownKeys = true }

    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    private val baseUrl = BuildConfig.API_BASE_URL

    // ── Signed URL cache ────────────────────────────────────────────────
    private data class CachedUrl(val url: String, val expiresAt: Long)

    private val urlCache = mutableMapOf<String, CachedUrl>()
    private const val CACHE_TTL_MS = 4 * 60 * 1000L // 4 minutes

    @Volatile
    var authToken: String? = null

    // ── Public API ──────────────────────────────────────────────────────

    /**
     * Returns a signed URL for ElevenLabs conversation.
     * Uses in-memory cache (4 min TTL) to avoid redundant network calls.
     */
    suspend fun getSignedUrl(
        scenarioId: String? = null,
        agentSecretName: String? = null,
    ): String {
        val cacheKey = agentSecretName ?: "_default"

        // Check cache
        urlCache[cacheKey]?.let { cached ->
            if (System.currentTimeMillis() < cached.expiresAt) {
                return cached.url
            }
            urlCache.remove(cacheKey)
        }

        // Fetch from server
        val body = json.encodeToString(
            ConversationTokenRequest.serializer(),
            ConversationTokenRequest(scenarioId, agentSecretName),
        )

        val request = Request.Builder()
            .url("$baseUrl/api/elevenlabs/conversation-token")
            .post(body.toRequestBody(JSON_MEDIA))
            .apply { authToken?.let { header("Authorization", "Bearer $it") } }
            .build()

        val response = withContext(Dispatchers.IO) {
            http.newCall(request).execute()
        }

        if (!response.isSuccessful) {
            throw RuntimeException("Failed to get signed URL: ${response.code}")
        }

        val responseBody = response.body?.string()
            ?: throw RuntimeException("Empty response body")

        val signedUrl = json.decodeFromString(SignedUrlResponse.serializer(), responseBody).signedUrl

        // Cache it
        urlCache[cacheKey] = CachedUrl(signedUrl, System.currentTimeMillis() + CACHE_TTL_MS)

        return signedUrl
    }

    /** Invalidate a cached URL (e.g. after it's been consumed). */
    fun invalidateCache(agentSecretName: String? = null) {
        urlCache.remove(agentSecretName ?: "_default")
    }
}
