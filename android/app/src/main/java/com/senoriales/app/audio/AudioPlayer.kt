package com.senoriales.app.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import java.util.concurrent.LinkedBlockingQueue

/**
 * Low-latency audio playback for TTS responses from ElevenLabs.
 *
 * Receives raw PCM chunks and plays them with minimal buffering.
 * Uses AudioTrack in streaming mode for lowest possible latency.
 */
class AudioPlayer {

    companion object {
        private const val TAG = "AudioPlayer"
        private const val SAMPLE_RATE = 16_000
    }

    private var track: AudioTrack? = null
    private var playThread: Thread? = null
    private val audioQueue = LinkedBlockingQueue<ByteArray>()

    @Volatile
    private var isPlaying = false

    @Volatile
    var isSpeaking = false
        private set

    fun start() {
        if (isPlaying) return

        val minBuffer = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )

        track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .build()
            )
            .setBufferSizeInBytes(minBuffer)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
            .build()

        isPlaying = true
        track?.play()

        playThread = Thread({
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)

            while (isPlaying) {
                val chunk = audioQueue.poll(100, java.util.concurrent.TimeUnit.MILLISECONDS)
                if (chunk != null) {
                    isSpeaking = true
                    track?.write(chunk, 0, chunk.size)
                } else {
                    isSpeaking = false
                }
            }
        }, "AudioPlayer").apply { start() }

        Log.d(TAG, "Audio player started")
    }

    /** Enqueue a PCM audio chunk received from ElevenLabs WebSocket. */
    fun enqueue(pcmData: ByteArray) {
        audioQueue.offer(pcmData)
    }

    /** Clear queued audio (e.g., on interruption). */
    fun flush() {
        audioQueue.clear()
        isSpeaking = false
    }

    fun stop() {
        isPlaying = false
        audioQueue.clear()
        playThread?.join(500)
        playThread = null

        track?.stop()
        track?.release()
        track = null
        isSpeaking = false

        Log.d(TAG, "Audio player stopped")
    }
}
