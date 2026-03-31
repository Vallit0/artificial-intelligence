package com.senoriales.app.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.senoriales.app.audio.AudioCapture
import com.senoriales.app.audio.AudioPlayer
import com.senoriales.app.data.AgentMessage
import com.senoriales.app.data.EvaluationResult
import com.senoriales.app.network.ApiClient
import com.senoriales.app.network.ElevenLabsSocket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ConversationUiState(
    val status: Status = Status.IDLE,
    val sessionSeconds: Int = 0,
    val isMuted: Boolean = false,
    val isSpeaking: Boolean = false,
    val transcript: List<TranscriptEntry> = emptyList(),
    val evaluation: EvaluationResult? = null,
    val error: String? = null,
    /** True when a signed URL has been pre-fetched and is ready to use. */
    val urlPreFetched: Boolean = false,
) {
    enum class Status { IDLE, PRE_CONNECTING, CONNECTING, ACTIVE, EVALUATING, EVALUATED, ERROR }
}

data class TranscriptEntry(val text: String, val isUser: Boolean, val timestamp: Long = System.currentTimeMillis())

/**
 * ViewModel orchestrating the full conversation lifecycle:
 *
 * 1. Pre-fetch signed URL on screen load → ~0ms URL wait on tap
 * 2. Pre-connect WebSocket before user taps "Start" (optional)
 * 3. On tap: start AudioCapture (raw PCM, no filters) → pipe to WebSocket
 * 4. Receive agent audio via WebSocket → AudioPlayer
 * 5. Parse transcript + evaluation messages
 */
class ConversationViewModel(app: Application) : AndroidViewModel(app) {

    companion object {
        private const val TAG = "ConversationVM"
    }

    private val _state = MutableStateFlow(ConversationUiState())
    val state: StateFlow<ConversationUiState> = _state.asStateFlow()

    private val socket = ElevenLabsSocket()
    private val player = AudioPlayer()
    private var capture: AudioCapture? = null

    private var timerJob: Job? = null
    private var messageJob: Job? = null
    private var prefetchedUrl: String? = null

    // ── Pre-fetch signed URL eagerly ────────────────────────────────────

    fun prefetchSignedUrl(scenarioId: String? = null, agentSecretName: String? = null) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                _state.value = _state.value.copy(status = ConversationUiState.Status.PRE_CONNECTING)
                prefetchedUrl = ApiClient.getSignedUrl(scenarioId, agentSecretName)
                _state.value = _state.value.copy(
                    status = ConversationUiState.Status.IDLE,
                    urlPreFetched = true,
                )
                Log.d(TAG, "Signed URL pre-fetched ✓")
            } catch (e: Exception) {
                Log.w(TAG, "Pre-fetch failed, will retry on connect", e)
                _state.value = _state.value.copy(status = ConversationUiState.Status.IDLE)
            }
        }
    }

    // ── Start conversation ──────────────────────────────────────────────

    @android.annotation.SuppressLint("MissingPermission")
    fun startConversation(scenarioId: String? = null, agentSecretName: String? = null) {
        if (_state.value.status == ConversationUiState.Status.ACTIVE ||
            _state.value.status == ConversationUiState.Status.CONNECTING
        ) return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                status = ConversationUiState.Status.CONNECTING,
                sessionSeconds = 0,
                transcript = emptyList(),
                evaluation = null,
                error = null,
            )

            try {
                // Use pre-fetched URL or fetch now
                val signedUrl = prefetchedUrl
                    ?: ApiClient.getSignedUrl(scenarioId, agentSecretName)
                prefetchedUrl = null

                // Start listening for messages BEFORE connecting
                startMessageListener()

                // Connect WebSocket
                socket.connect(signedUrl)

                // Start audio capture — raw PCM, no processing pipeline
                capture = AudioCapture { pcmData ->
                    socket.sendAudio(pcmData)
                }
                capture?.start()

                // Start audio playback
                player.start()

                // Start session timer
                startTimer()

                _state.value = _state.value.copy(status = ConversationUiState.Status.ACTIVE)

                // Pre-fetch next URL for quick reconnect
                viewModelScope.launch(Dispatchers.IO) {
                    try {
                        prefetchedUrl = ApiClient.getSignedUrl(scenarioId, agentSecretName)
                    } catch (_: Exception) { }
                }

            } catch (e: Exception) {
                Log.e(TAG, "Failed to start conversation", e)
                _state.value = _state.value.copy(
                    status = ConversationUiState.Status.ERROR,
                    error = e.message ?: "Connection failed",
                )
            }
        }
    }

    // ── Stop conversation ───────────────────────────────────────────────

    fun stopConversation() {
        capture?.stop()
        capture = null
        player.stop()
        socket.disconnect()
        timerJob?.cancel()
        messageJob?.cancel()

        val current = _state.value
        _state.value = current.copy(
            status = if (current.evaluation != null)
                ConversationUiState.Status.EVALUATED
            else
                ConversationUiState.Status.EVALUATING,
            isMuted = false,
        )
    }

    fun toggleMute() {
        // TODO: mute by pausing AudioCapture send (keep recording to avoid reinit latency)
        _state.value = _state.value.copy(isMuted = !_state.value.isMuted)
    }

    fun reset() {
        _state.value = ConversationUiState()
        prefetchedUrl = null
    }

    // ── Internal ────────────────────────────────────────────────────────

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (true) {
                delay(1000)
                _state.value = _state.value.copy(sessionSeconds = _state.value.sessionSeconds + 1)
            }
        }
    }

    private fun startMessageListener() {
        messageJob?.cancel()
        messageJob = viewModelScope.launch {
            socket.messages.collect { msg ->
                when (msg) {
                    is AgentMessage.UserTranscript -> {
                        val entry = TranscriptEntry(msg.text, isUser = true)
                        _state.value = _state.value.copy(transcript = _state.value.transcript + entry)
                    }
                    is AgentMessage.AgentResponse -> {
                        val entry = TranscriptEntry(msg.text, isUser = false)
                        _state.value = _state.value.copy(transcript = _state.value.transcript + entry)
                    }
                    is AgentMessage.AgentCorrection -> {
                        Log.d(TAG, "Agent corrected: ${msg.text}")
                        player.flush() // Stop playing interrupted audio
                    }
                    is AgentMessage.Evaluation -> {
                        _state.value = _state.value.copy(
                            evaluation = msg.result,
                            status = ConversationUiState.Status.EVALUATED,
                        )
                    }
                    is AgentMessage.Error -> {
                        _state.value = _state.value.copy(error = msg.message)
                    }
                    AgentMessage.Connected -> Log.d(TAG, "Socket connected")
                    AgentMessage.Disconnected -> {
                        if (_state.value.status == ConversationUiState.Status.ACTIVE) {
                            stopConversation()
                        }
                    }
                }
            }
        }
    }

    override fun onCleared() {
        capture?.stop()
        player.stop()
        socket.disconnect()
        timerJob?.cancel()
        messageJob?.cancel()
    }
}
