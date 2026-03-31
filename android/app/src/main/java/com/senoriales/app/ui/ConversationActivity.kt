package com.senoriales.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.senoriales.app.databinding.ActivityConversationBinding
import kotlinx.coroutines.launch

/**
 * Main conversation screen.
 *
 * Lifecycle:
 * 1. onCreate → pre-fetch signed URL (background)
 * 2. User taps "Start" → mic permission → startConversation()
 * 3. Active: shows orb animation, transcript, timer
 * 4. User taps "End" → evaluation screen
 */
class ConversationActivity : AppCompatActivity() {

    private lateinit var binding: ActivityConversationBinding
    private val viewModel: ConversationViewModel by viewModels()

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

        // Pre-fetch signed URL immediately on screen load
        viewModel.prefetchSignedUrl(
            scenarioId = intent.getStringExtra("scenarioId"),
            agentSecretName = intent.getStringExtra("agentSecretName"),
        )

        setupListeners()
        observeState()
    }

    private fun setupListeners() {
        binding.btnStart.setOnClickListener {
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

        binding.btnEndCall.setOnClickListener {
            viewModel.stopConversation()
        }

        binding.btnMute.setOnClickListener {
            viewModel.toggleMute()
        }

        binding.btnRetry.setOnClickListener {
            viewModel.reset()
            viewModel.prefetchSignedUrl(
                scenarioId = intent.getStringExtra("scenarioId"),
                agentSecretName = intent.getStringExtra("agentSecretName"),
            )
        }
    }

    private fun observeState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    // Status-driven visibility
                    val isIdle = state.status == ConversationUiState.Status.IDLE ||
                            state.status == ConversationUiState.Status.PRE_CONNECTING
                    val isActive = state.status == ConversationUiState.Status.ACTIVE
                    val isConnecting = state.status == ConversationUiState.Status.CONNECTING
                    val isEvaluated = state.status == ConversationUiState.Status.EVALUATED
                    val isEvaluating = state.status == ConversationUiState.Status.EVALUATING

                    // Idle panel
                    binding.layoutIdle.visibility = if (isIdle) View.VISIBLE else View.GONE
                    binding.btnStart.isEnabled = !isConnecting

                    // Connecting indicator
                    binding.progressConnecting.visibility = if (isConnecting) View.VISIBLE else View.GONE

                    // Active conversation panel
                    binding.layoutActive.visibility = if (isActive) View.VISIBLE else View.GONE

                    // Timer
                    if (isActive) {
                        val mins = state.sessionSeconds / 60
                        val secs = state.sessionSeconds % 60
                        binding.tvTimer.text = String.format("%02d:%02d", mins, secs)
                    }

                    // Mute button
                    binding.btnMute.text = if (state.isMuted) "Desmutear" else "Mutear"

                    // Speaking indicator
                    binding.tvSpeakingIndicator.visibility =
                        if (isActive && state.isSpeaking) View.VISIBLE else View.INVISIBLE

                    // Evaluation panel
                    binding.layoutEvaluation.visibility =
                        if (isEvaluated || isEvaluating) View.VISIBLE else View.GONE

                    if (isEvaluating) {
                        binding.tvEvaluationTitle.text = "Evaluando..."
                        binding.tvEvaluationDetails.text = ""
                        binding.btnRetry.visibility = View.GONE
                    }

                    if (isEvaluated) {
                        state.evaluation?.let { eval ->
                            binding.tvEvaluationTitle.text =
                                if (eval.passed) "¡Aprobado! (${eval.score}/100)"
                                else "Score: ${eval.score}/100"
                            binding.tvEvaluationDetails.text = eval.feedback
                            binding.btnRetry.visibility = View.VISIBLE
                        }
                    }

                    // Error
                    state.error?.let {
                        Toast.makeText(this@ConversationActivity, it, Toast.LENGTH_LONG).show()
                    }

                    // Pre-fetch indicator (subtle)
                    binding.tvPreFetchStatus.visibility =
                        if (state.urlPreFetched && isIdle) View.VISIBLE else View.GONE
                }
            }
        }
    }
}
