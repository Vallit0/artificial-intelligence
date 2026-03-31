package com.senoriales.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SignedUrlResponse(
    @SerialName("signedUrl") val signedUrl: String,
)

@Serializable
data class ConversationTokenRequest(
    val scenarioId: String? = null,
    val agentSecretName: String? = null,
)

@Serializable
data class EvaluationBreakdown(
    val apertura: Int = 0,
    @SerialName("escucha_activa") val escuchaActiva: Int = 0,
    @SerialName("manejo_objeciones") val manejoObjeciones: Int = 0,
    @SerialName("propuesta_valor") val propuestaValor: Int = 0,
    val cierre: Int = 0,
)

@Serializable
data class EvaluationResult(
    val score: Int = 0,
    val passed: Boolean = false,
    val feedback: String = "",
    val breakdown: EvaluationBreakdown? = null,
)

/** Typed wrapper for ElevenLabs WebSocket messages we care about. */
sealed class AgentMessage {
    data class UserTranscript(val text: String) : AgentMessage()
    data class AgentResponse(val text: String) : AgentMessage()
    data class AgentCorrection(val text: String) : AgentMessage()
    data class Evaluation(val result: EvaluationResult) : AgentMessage()
    data class Error(val message: String) : AgentMessage()
    data object Connected : AgentMessage()
    data object Disconnected : AgentMessage()
}
