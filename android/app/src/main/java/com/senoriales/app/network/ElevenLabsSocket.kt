package com.senoriales.app.network

import android.util.Log
import com.senoriales.app.data.AgentMessage
import com.senoriales.app.data.EvaluationBreakdown
import com.senoriales.app.data.EvaluationResult
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import java.util.concurrent.TimeUnit

/**
 * Low-latency WebSocket connection to ElevenLabs Conversational AI.
 *
 * Key design decisions for latency:
 * - Pre-connects the WebSocket before the user taps "Start"
 * - Sends raw PCM audio bytes directly (no JSON wrapping for audio frames)
 * - Parses incoming messages on the OkHttp callback thread (no extra dispatch)
 */
class ElevenLabsSocket {

    companion object {
        private const val TAG = "ElevenLabsSocket"
    }

    private val json = Json { ignoreUnknownKeys = true }

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS) // keep-alive
        .pingInterval(15, TimeUnit.SECONDS)
        .build()

    private var socket: WebSocket? = null
    private val _messages = Channel<AgentMessage>(Channel.BUFFERED)

    /** Observe agent messages as a cold Flow. */
    val messages: Flow<AgentMessage> = _messages.receiveAsFlow()

    val isConnected: Boolean get() = socket != null

    // ── Lifecycle ───────────────────────────────────────────────────────

    /**
     * Pre-connect to the ElevenLabs WebSocket using a signed URL.
     * Call this as early as possible (e.g., when the Practice screen loads).
     */
    fun connect(signedUrl: String) {
        if (socket != null) {
            Log.w(TAG, "Already connected, ignoring")
            return
        }

        val request = Request.Builder().url(signedUrl).build()

        socket = client.newWebSocket(request, object : WebSocketListener() {

            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connected")
                _messages.trySend(AgentMessage.Connected)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                parseTextMessage(text)
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                // ElevenLabs sends TTS audio as binary frames — forward to playback
                // Handled externally via a separate audio player reading from a queue
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closing: $code $reason")
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: $code $reason")
                socket = null
                _messages.trySend(AgentMessage.Disconnected)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure", t)
                socket = null
                _messages.trySend(AgentMessage.Error(t.message ?: "WebSocket failure"))
                _messages.trySend(AgentMessage.Disconnected)
            }
        })
    }

    /** Send raw PCM audio bytes to ElevenLabs. */
    fun sendAudio(data: ByteArray) {
        socket?.send(okio.ByteString.of(*data))
    }

    /** Send a JSON text message (e.g., user_audio_chunk metadata). */
    fun sendText(text: String) {
        socket?.send(text)
    }

    fun disconnect() {
        socket?.close(1000, "User ended session")
        socket = null
    }

    // ── Message parsing ─────────────────────────────────────────────────

    private fun parseTextMessage(text: String) {
        try {
            val obj = json.parseToJsonElement(text).jsonObject

            // User transcription
            obj["user_transcription_event"]?.jsonObject?.let { event ->
                val transcript = event["user_transcript"]?.jsonPrimitive?.content ?: return@let
                _messages.trySend(AgentMessage.UserTranscript(transcript))
            }

            // Agent response
            obj["agent_response_event"]?.jsonObject?.let { event ->
                val response = event["agent_response"]?.jsonPrimitive?.content ?: return@let
                _messages.trySend(AgentMessage.AgentResponse(response))
            }

            // Agent correction (interruption)
            obj["agent_response_correction_event"]?.jsonObject?.let { event ->
                val corrected = event["corrected_agent_response"]?.jsonPrimitive?.content ?: return@let
                _messages.trySend(AgentMessage.AgentCorrection(corrected))
            }

            // Client tool call (evaluation)
            obj["client_tool_call"]?.jsonObject?.let { call ->
                val toolName = call["tool_name"]?.jsonPrimitive?.content
                if (toolName == "submit_evaluation") {
                    val params = call["parameters"]?.jsonObject ?: return@let
                    val evaluation = EvaluationResult(
                        score = params["score"]?.jsonPrimitive?.int ?: 0,
                        passed = params["passed"]?.jsonPrimitive?.boolean ?: false,
                        feedback = params["feedback"]?.jsonPrimitive?.content ?: "",
                        breakdown = EvaluationBreakdown(
                            apertura = params["apertura"]?.jsonPrimitive?.int ?: 0,
                            escuchaActiva = params["escucha_activa"]?.jsonPrimitive?.int ?: 0,
                            manejoObjeciones = params["manejo_objeciones"]?.jsonPrimitive?.int ?: 0,
                            propuestaValor = params["propuesta_valor"]?.jsonPrimitive?.int ?: 0,
                            cierre = params["cierre"]?.jsonPrimitive?.int ?: 0,
                        ),
                    )
                    _messages.trySend(AgentMessage.Evaluation(evaluation))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse message: ${e.message}")
        }
    }
}
