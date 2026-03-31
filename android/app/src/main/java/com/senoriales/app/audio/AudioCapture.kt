package com.senoriales.app.audio

import android.Manifest
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import androidx.annotation.RequiresPermission

/**
 * Low-latency raw PCM audio capture using AudioRecord.
 *
 * No filters, no compressors, no AudioContext overhead.
 * Sends 16-bit mono PCM at 16kHz directly to the callback.
 *
 * Typical latency: ~10-20ms (vs ~50-100ms in browser with Web Audio API).
 */
class AudioCapture(
    private val onAudioData: (ByteArray) -> Unit,
) {
    companion object {
        private const val TAG = "AudioCapture"
        const val SAMPLE_RATE = 16_000
        private const val CHANNEL = AudioFormat.CHANNEL_IN_MONO
        private const val ENCODING = AudioFormat.ENCODING_PCM_16BIT

        /** Small buffer = lower latency. 640 bytes = 20ms at 16kHz mono 16-bit. */
        private const val FRAME_SIZE = 640
    }

    private var recorder: AudioRecord? = null
    private var captureThread: Thread? = null

    @Volatile
    private var isCapturing = false

    @RequiresPermission(Manifest.permission.RECORD_AUDIO)
    fun start() {
        if (isCapturing) return

        val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL, ENCODING)
        val bufferSize = maxOf(minBuffer, FRAME_SIZE * 4)

        recorder = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION, // optimized for voice, echo-cancelled by OS
            SAMPLE_RATE,
            CHANNEL,
            ENCODING,
            bufferSize,
        )

        if (recorder?.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord failed to initialize")
            recorder?.release()
            recorder = null
            return
        }

        isCapturing = true
        recorder?.startRecording()

        captureThread = Thread({
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)
            val buffer = ByteArray(FRAME_SIZE)

            while (isCapturing) {
                val read = recorder?.read(buffer, 0, FRAME_SIZE) ?: -1
                if (read > 0) {
                    onAudioData(buffer.copyOf(read))
                }
            }
        }, "AudioCapture").apply { start() }

        Log.d(TAG, "Audio capture started (16kHz mono PCM, ${FRAME_SIZE}B frames)")
    }

    fun stop() {
        isCapturing = false
        captureThread?.join(500)
        captureThread = null

        recorder?.stop()
        recorder?.release()
        recorder = null

        Log.d(TAG, "Audio capture stopped")
    }

    @get:RequiresPermission(Manifest.permission.RECORD_AUDIO)
    val isActive: Boolean get() = isCapturing
}
