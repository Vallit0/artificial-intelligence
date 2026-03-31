import { useCallback, useRef } from "react";

/**
 * Generates pleasant call sounds using Web Audio API.
 * Inspired by Sesame.ai-style interaction sounds.
 */
export const useCallSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.15) => {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    },
    [getAudioContext]
  );

  /** Ascending two-tone chime when starting a call */
  const playStartCall = useCallback(() => {
    playTone(523.25, 0.25, "sine", 0.12); // C5
    setTimeout(() => playTone(659.25, 0.3, "sine", 0.12), 150); // E5
    setTimeout(() => playTone(783.99, 0.35, "sine", 0.1), 300); // G5
  }, [playTone]);

  /** Warm connection confirmation sound */
  const playConnected = useCallback(() => {
    playTone(440, 0.15, "sine", 0.1); // A4
    setTimeout(() => playTone(554.37, 0.15, "sine", 0.1), 100); // C#5
    setTimeout(() => playTone(659.25, 0.4, "sine", 0.12), 200); // E5
  }, [playTone]);

  /** Descending tone when ending a call */
  const playEndCall = useCallback(() => {
    playTone(659.25, 0.2, "sine", 0.1); // E5
    setTimeout(() => playTone(523.25, 0.2, "sine", 0.1), 120); // C5
    setTimeout(() => playTone(392.0, 0.4, "sine", 0.08), 240); // G4
  }, [playTone]);

  /** Subtle notification sound */
  const playNotification = useCallback(() => {
    playTone(880, 0.12, "sine", 0.08); // A5
    setTimeout(() => playTone(1108.73, 0.18, "sine", 0.06), 80); // C#6
  }, [playTone]);

  return {
    playStartCall,
    playConnected,
    playEndCall,
    playNotification,
  };
};
