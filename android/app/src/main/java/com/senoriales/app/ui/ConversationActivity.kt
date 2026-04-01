package com.senoriales.app.ui

import android.Manifest
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.senoriales.app.R
import com.senoriales.app.databinding.ActivityConversationBinding
import com.senoriales.app.databinding.ItemBreakdownBinding
import kotlinx.coroutines.launch
import java.util.Calendar

class ConversationActivity : AppCompatActivity() {

    private lateinit var binding: ActivityConversationBinding
    private val viewModel: ConversationViewModel by viewModels()

    private var orbAnimatorSet: AnimatorSet? = null
    private var breakdownVisible = false

    private val micPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            viewModel.startConversation(
                scenarioId = intent.getStringExtra("scenarioId"),
                agentSecretName = intent.getStringExtra("agentSecretName"),
            )
        } else {
            Toast.makeText(this, "Se necesita permiso de micrófono", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityConversationBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupGreeting()
        setupListeners()
        observeState()

        // Pre-fetch signed URL
        viewModel.prefetchSignedUrl(
            scenarioId = intent.getStringExtra("scenarioId"),
            agentSecretName = intent.getStringExtra("agentSecretName"),
        )
    }

    private fun setupGreeting() {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        binding.tvGreeting.text = when {
            hour < 12 -> "Buenos días"
            hour < 18 -> "Buenas tardes"
            else -> "Buenas noches"
        }
    }

    private fun setupListeners() {
        // Tap logo to start (like webapp LogoMorph click)
        binding.logoContainer.setOnClickListener { requestStartConversation() }

        binding.btnEndCall.setOnClickListener { viewModel.stopConversation() }
        binding.btnMute.setOnClickListener { viewModel.toggleMute() }

        binding.btnRetry.setOnClickListener {
            viewModel.reset()
            viewModel.prefetchSignedUrl(
                scenarioId = intent.getStringExtra("scenarioId"),
                agentSecretName = intent.getStringExtra("agentSecretName"),
            )
        }

        binding.btnContinue.setOnClickListener { finish() }
        binding.btnBackToScenarios.setOnClickListener { finish() }

        binding.btnErrorRetry.setOnClickListener {
            viewModel.reset()
            viewModel.prefetchSignedUrl(
                scenarioId = intent.getStringExtra("scenarioId"),
                agentSecretName = intent.getStringExtra("agentSecretName"),
            )
        }

        // Breakdown toggle
        binding.tvToggleBreakdown.setOnClickListener {
            breakdownVisible = !breakdownVisible
            binding.layoutBreakdown.visibility = if (breakdownVisible) View.VISIBLE else View.GONE
            binding.tvToggleBreakdown.text =
                if (breakdownVisible) "Ocultar detalles" else "Ver desglose de puntaje"
        }
    }

    private fun requestStartConversation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED
        ) {
            viewModel.startConversation(
                scenarioId = intent.getStringExtra("scenarioId"),
                agentSecretName = intent.getStringExtra("agentSecretName"),
            )
        } else {
            micPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun observeState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    updateVisibility(state)

                    when (state.status) {
                        ConversationUiState.Status.IDLE,
                        ConversationUiState.Status.PRE_CONNECTING -> renderIdle(state)
                        ConversationUiState.Status.CONNECTING -> renderConnecting()
                        ConversationUiState.Status.ACTIVE -> renderActive(state)
                        ConversationUiState.Status.EVALUATING -> { /* layout handles it */ }
                        ConversationUiState.Status.EVALUATED -> renderEvaluated(state)
                        ConversationUiState.Status.ERROR -> renderError(state)
                    }

                    // Show transient errors as toast (e.g., WebSocket errors during active session)
                    if (state.error != null && state.status != ConversationUiState.Status.ERROR) {
                        Toast.makeText(this@ConversationActivity, state.error, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun updateVisibility(state: ConversationUiState) {
        val status = state.status
        binding.layoutIdle.visibility =
            if (status == ConversationUiState.Status.IDLE || status == ConversationUiState.Status.PRE_CONNECTING)
                View.VISIBLE else View.GONE

        binding.layoutConnecting.visibility =
            if (status == ConversationUiState.Status.CONNECTING) View.VISIBLE else View.GONE

        binding.layoutActive.visibility =
            if (status == ConversationUiState.Status.ACTIVE) View.VISIBLE else View.GONE

        binding.layoutEvaluating.visibility =
            if (status == ConversationUiState.Status.EVALUATING) View.VISIBLE else View.GONE

        binding.layoutEvaluation.visibility =
            if (status == ConversationUiState.Status.EVALUATED) View.VISIBLE else View.GONE

        binding.layoutError.visibility =
            if (status == ConversationUiState.Status.ERROR) View.VISIBLE else View.GONE

        // Stop orb animation when not active
        if (status != ConversationUiState.Status.ACTIVE) {
            stopOrbAnimation()
        }
    }

    private fun renderIdle(state: ConversationUiState) {
        binding.tvPreFetchStatus.visibility =
            if (state.urlPreFetched) View.VISIBLE else View.GONE
        binding.tvStartHint.text =
            if (state.status == ConversationUiState.Status.PRE_CONNECTING)
                "Preparando..." else "Toca para iniciar"
    }

    private fun renderConnecting() {
        // The connecting layout handles its own UI
    }

    private fun renderActive(state: ConversationUiState) {
        // Timer in HH:MM:SS format like webapp
        val hrs = state.sessionSeconds / 3600
        val mins = (state.sessionSeconds % 3600) / 60
        val secs = state.sessionSeconds % 60
        binding.tvTimer.text = String.format("%02d:%02d:%02d", hrs, mins, secs)

        // Mute button state
        if (state.isMuted) {
            binding.btnMute.setBackgroundResource(R.drawable.btn_mute_active_bg)
            binding.btnMute.setColorFilter(
                ContextCompat.getColor(this, R.color.surface)
            )
        } else {
            binding.btnMute.setBackgroundResource(R.drawable.btn_mute_bg)
            binding.btnMute.setColorFilter(
                ContextCompat.getColor(this, R.color.text_primary)
            )
        }

        // Speaking indicator
        binding.tvSpeakingIndicator.visibility =
            if (state.isSpeaking) View.VISIBLE else View.INVISIBLE

        // Start/maintain orb animation
        startOrbAnimation(state.isSpeaking)
    }

    private fun renderEvaluated(state: ConversationUiState) {
        val eval = state.evaluation ?: return

        if (eval.passed) {
            binding.tvEvaluationTitle.text = "¡Misión Completada!"
            binding.tvEvaluationTitle.setTextColor(ContextCompat.getColor(this, R.color.turquoise))
            binding.evalIconBg.setBackgroundResource(R.drawable.circle_turquoise_bg)
            binding.tvEvaluationSubtitle.text = "Siguiente escenario desbloqueado"
            binding.tvEvaluationSubtitle.visibility = View.VISIBLE
            binding.tvScore.setTextColor(ContextCompat.getColor(this, R.color.turquoise))
            binding.progressScore.progressDrawable =
                ContextCompat.getDrawable(this, R.drawable.progress_bar_fill_turquoise)
            binding.btnContinue.visibility = View.VISIBLE
            binding.btnRetry.visibility = View.GONE
            binding.btnBackToScenarios.visibility = View.GONE
        } else {
            binding.tvEvaluationTitle.text = "¡Sigue practicando!"
            binding.tvEvaluationTitle.setTextColor(ContextCompat.getColor(this, R.color.text_primary))
            binding.evalIconBg.setBackgroundResource(R.drawable.circle_muted_bg)
            binding.tvEvaluationSubtitle.text = "Necesitas 50+ puntos para pasar"
            binding.tvEvaluationSubtitle.visibility = View.VISIBLE
            binding.tvScore.setTextColor(ContextCompat.getColor(this, R.color.text_primary))
            binding.progressScore.progressDrawable =
                ContextCompat.getDrawable(this, R.drawable.progress_bar_fill_muted)
            binding.btnRetry.visibility = View.VISIBLE
            binding.btnContinue.visibility = View.GONE
            binding.btnBackToScenarios.visibility = View.VISIBLE
        }

        binding.tvScore.text = "${eval.score}/100"
        binding.progressScore.progress = eval.score
        binding.tvFeedback.text = eval.feedback

        // Duration
        if (state.sessionSeconds > 0) {
            val mins = state.sessionSeconds / 60
            val secs = state.sessionSeconds % 60
            binding.tvDuration.text = "Duración: ${mins}:${String.format("%02d", secs)}"
            binding.layoutDuration.visibility = View.VISIBLE
        } else {
            binding.layoutDuration.visibility = View.GONE
        }

        // Breakdown
        eval.breakdown?.let { breakdown ->
            binding.tvToggleBreakdown.visibility = View.VISIBLE
            setupBreakdownItem(binding.breakdownApertura, "Apertura", breakdown.apertura)
            setupBreakdownItem(binding.breakdownEscucha, "Escucha Activa", breakdown.escuchaActiva)
            setupBreakdownItem(binding.breakdownObjeciones, "Manejo de Objeciones", breakdown.manejoObjeciones)
            setupBreakdownItem(binding.breakdownPropuesta, "Propuesta de Valor", breakdown.propuestaValor)
            setupBreakdownItem(binding.breakdownCierre, "Cierre", breakdown.cierre)
        } ?: run {
            binding.tvToggleBreakdown.visibility = View.GONE
            binding.layoutBreakdown.visibility = View.GONE
        }
    }

    private fun setupBreakdownItem(itemBinding: ItemBreakdownBinding, label: String, value: Int) {
        itemBinding.tvBreakdownLabel.text = label
        itemBinding.progressBreakdown.progress = value * 5
        itemBinding.tvBreakdownValue.text = "$value/20"
    }

    private fun renderError(state: ConversationUiState) {
        binding.tvErrorMessage.text = state.error ?: "Error desconocido"
    }

    // ── Orb Animations ──────────────────────────────────────────────────

    private fun startOrbAnimation(isSpeaking: Boolean) {
        if (orbAnimatorSet?.isRunning == true) return

        val outerScale = if (isSpeaking) 1.15f else 1.08f
        val middleScale = if (isSpeaking) 1.12f else 1.05f
        val duration = if (isSpeaking) 800L else 2000L

        val outerScaleX = ObjectAnimator.ofFloat(binding.orbGlowOuter, "scaleX", 1f, outerScale, 1f).apply {
            this.duration = duration
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
        }
        val outerScaleY = ObjectAnimator.ofFloat(binding.orbGlowOuter, "scaleY", 1f, outerScale, 1f).apply {
            this.duration = duration
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
        }
        val middleScaleX = ObjectAnimator.ofFloat(binding.orbGlowMiddle, "scaleX", 1f, middleScale, 1f).apply {
            this.duration = duration
            startDelay = 300
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
        }
        val middleScaleY = ObjectAnimator.ofFloat(binding.orbGlowMiddle, "scaleY", 1f, middleScale, 1f).apply {
            this.duration = duration
            startDelay = 300
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
        }
        val orbScaleX = ObjectAnimator.ofFloat(binding.voiceOrb, "scaleX", 1f, 1.03f, 1f).apply {
            this.duration = duration
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
        }
        val orbScaleY = ObjectAnimator.ofFloat(binding.voiceOrb, "scaleY", 1f, 1.03f, 1f).apply {
            this.duration = duration
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
        }

        // Alpha pulsing on glow rings
        val outerAlpha = ObjectAnimator.ofFloat(binding.orbGlowOuter, "alpha", 0.6f, 1f, 0.6f).apply {
            this.duration = duration
            repeatCount = ValueAnimator.INFINITE
        }
        val middleAlpha = ObjectAnimator.ofFloat(binding.orbGlowMiddle, "alpha", 0.7f, 1f, 0.7f).apply {
            this.duration = duration
            startDelay = 300
            repeatCount = ValueAnimator.INFINITE
        }

        orbAnimatorSet = AnimatorSet().apply {
            playTogether(outerScaleX, outerScaleY, middleScaleX, middleScaleY,
                orbScaleX, orbScaleY, outerAlpha, middleAlpha)
            start()
        }
    }

    private fun stopOrbAnimation() {
        orbAnimatorSet?.cancel()
        orbAnimatorSet = null
        // Reset scales
        listOf(binding.orbGlowOuter, binding.orbGlowMiddle, binding.voiceOrb).forEach { view ->
            view.scaleX = 1f
            view.scaleY = 1f
            view.alpha = 1f
        }
    }

    override fun onDestroy() {
        stopOrbAnimation()
        super.onDestroy()
    }
}
