import { useCallback, useEffect, useRef, useState } from "react";

// ============================================
// Indicador de calidad de conexión en vivo (estilo WhatsApp)
// ============================================
// Mientras hay una llamada activa, sondea periódicamente un endpoint liviano
// del backend (/health/live) para medir el round-trip y combina eso con el
// estado online/offline del navegador. El resultado alimenta un banner tipo
// "Internet bajo" / "Sin conexión" en la UI de la llamada.
//
// Se usa `mode: "no-cors"` igual que el speedtest (useLatencyProbe): no
// necesitamos leer el cuerpo, solo que el fetch resuelva — eso ya prueba que el
// round-trip se completó, y evita cualquier handshake de CORS.

export type ConnectionQuality = "good" | "weak" | "offline";

interface UseConnectionQualityOptions {
  // Solo sondea mientras la llamada está activa para no generar tráfico inútil.
  active: boolean;
  // Cada cuánto medir (ms).
  intervalMs?: number;
  // Si un ping tarda más que esto, se considera fallido (ms).
  timeoutMs?: number;
  // Por encima de este RTT mediano la conexión se marca como "weak" (ms).
  weakRttMs?: number;
}

interface ConnectionQualityState {
  quality: ConnectionQuality;
  rttMs: number | null;
}

function apiBase() {
  return import.meta.env.VITE_API_URL || "";
}

// Cuántas muestras recientes conservar para suavizar el veredicto. Usar la
// mediana evita que un único pico de latencia haga parpadear el banner.
const WINDOW = 4;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function useConnectionQuality({
  active,
  intervalMs = 4000,
  timeoutMs = 3000,
  weakRttMs = 350,
}: UseConnectionQualityOptions): ConnectionQualityState {
  const [quality, setQuality] = useState<ConnectionQuality>("good");
  const [rttMs, setRttMs] = useState<number | null>(null);

  const samplesRef = useRef<number[]>([]);
  const consecutiveFailuresRef = useRef(0);
  // navigator.onLine puede no existir en SSR; default optimista.
  const onlineRef = useRef(typeof navigator === "undefined" ? true : navigator.onLine);

  // Recalcula el veredicto a partir de las señales acumuladas. Reglas:
  //  - offline: navegador sin red, o 2+ pings fallidos seguidos.
  //  - weak:    un ping fallido aislado, o RTT mediano alto.
  //  - good:    todo lo demás.
  const recompute = useCallback((): ConnectionQuality => {
    if (!onlineRef.current) return "offline";
    if (consecutiveFailuresRef.current >= 2) return "offline";
    if (consecutiveFailuresRef.current === 1) return "weak";
    const samples = samplesRef.current;
    if (samples.length >= 2 && median(samples) > weakRttMs) return "weak";
    return "good";
  }, [weakRttMs]);

  // Resetea el estado cuando la llamada arranca o termina, para no arrastrar
  // muestras viejas a la siguiente sesión.
  useEffect(() => {
    samplesRef.current = [];
    consecutiveFailuresRef.current = 0;
    setRttMs(null);
    if (!active) {
      setQuality("good");
    }
  }, [active]);

  // Listeners de red del navegador: reaccionan al instante a desconexiones
  // totales sin esperar al siguiente ping.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      onlineRef.current = true;
      setQuality(recompute());
    };
    const handleOffline = () => {
      onlineRef.current = false;
      setQuality("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [recompute]);

  // Bucle de sondeo: solo corre mientras `active` es true.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const ping = async () => {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeoutMs);
      const start = performance.now();
      try {
        await fetch(`${apiBase()}/health/live?t=${Date.now()}`, {
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });
        if (cancelled) return;
        const ms = performance.now() - start;
        consecutiveFailuresRef.current = 0;
        const next = [...samplesRef.current, ms].slice(-WINDOW);
        samplesRef.current = next;
        setRttMs(Math.round(ms));
      } catch {
        if (cancelled) return;
        consecutiveFailuresRef.current += 1;
        samplesRef.current = [];
        setRttMs(null);
      } finally {
        clearTimeout(to);
      }
      if (!cancelled) {
        setQuality(recompute());
        timer = setTimeout(ping, intervalMs);
      }
    };

    // Primer ping inmediato para no tardar `intervalMs` en detectar problemas.
    ping();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, intervalMs, timeoutMs, recompute]);

  return { quality, rttMs };
}
