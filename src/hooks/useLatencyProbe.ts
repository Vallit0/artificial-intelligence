import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api-client";

// ============================================
// Speedtest-style latency diagnostics
// ============================================
// Corre enteramente en el navegador. El backend solo aparece como otro objetivo
// que se mide — el veredicto debe poder explicarle al usuario si la voz lenta es
// culpa de su red, su ancho de banda, el backend, o de ElevenLabs.
//
// Las etapas voz-criticas (microfono, WebSocket real de ConvAI) tocan los mismos
// recursos que una sesion real. El WebSocket de ConvAI se abre y se cierra sin
// enviar audio.

export type StageId =
  | "internet"
  | "server_ping"
  | "elevenlabs_rtt"
  | "download"
  | "upload"
  | "microphone"
  | "voice_ws"
  | "server_probes";

export type StageStatus = "idle" | "running" | "ok" | "warn" | "fail" | "skipped";

export interface StageResult {
  id: StageId;
  label: string;
  hint: string;
  status: StageStatus;
  value: number | null;
  unit: "ms" | "Mbps" | "kHz";
  detail?: string;
  error?: string;
}

export interface ServerProbeDetail {
  service: "database" | "elevenlabs";
  ok: boolean;
  latencyMs: number;
  skipped?: boolean;
  status?: number;
  error?: string;
  target?: string;
  detail?: string;
}

export interface SpeedtestReport {
  timestamp: string;
  stages: StageResult[];
  serverProbes: ServerProbeDetail[];
  verdict: string;
}

interface ServerProbeResponse {
  timestamp: string;
  totalMs: number;
  probes: ServerProbeDetail[];
}

const DOWNLOAD_BYTES = 2 * 1024 * 1024;
const UPLOAD_BYTES = 1 * 1024 * 1024;
const PING_SAMPLES = 5;
const WS_TIMEOUT_MS = 10_000;

const INITIAL_STAGES: StageResult[] = [
  {
    id: "internet",
    label: "Tu internet",
    hint: "Ping desde el navegador a un CDN externo (Cloudflare). Aisla si tu conexion a internet esta lenta.",
    status: "idle",
    value: null,
    unit: "ms",
  },
  {
    id: "server_ping",
    label: "Tu red → Servidor",
    hint: "Round-trip del navegador al backend de Senoriales.",
    status: "idle",
    value: null,
    unit: "ms",
  },
  {
    id: "elevenlabs_rtt",
    label: "Tu red → ElevenLabs",
    hint: "Fetch no-cors directo a api.elevenlabs.io. Si esto es alto, el cuello esta entre tu ISP y ElevenLabs.",
    status: "idle",
    value: null,
    unit: "ms",
  },
  {
    id: "download",
    label: "Ancho de banda de bajada",
    hint: "Descarga 2MB desde el backend — indicador de tu conexion de bajada.",
    status: "idle",
    value: null,
    unit: "Mbps",
  },
  {
    id: "upload",
    label: "Ancho de banda de subida",
    hint: "Sube 1MB al backend. Importa porque el audio del microfono viaja por este canal.",
    status: "idle",
    value: null,
    unit: "Mbps",
  },
  {
    id: "microphone",
    label: "Microfono",
    hint: "Pide permiso y mide cuanto tarda en quedar listo el stream de audio.",
    status: "idle",
    value: null,
    unit: "ms",
  },
  {
    id: "voice_ws",
    label: "WebSocket de voz (ConvAI)",
    hint: "Abre una sesion real a ElevenLabs con un signed URL y mide el handshake + primer mensaje. Se cierra sin enviar audio.",
    status: "idle",
    value: null,
    unit: "ms",
  },
  {
    id: "server_probes",
    label: "Servidor → servicios",
    hint: "Probes internos desde el backend: DB y endpoint de voz de ElevenLabs.",
    status: "idle",
    value: null,
    unit: "ms",
  },
];

function apiBase() {
  return import.meta.env.VITE_API_URL || "";
}

function authHeaders(): HeadersInit {
  const token = api.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function classifyLatency(ms: number): StageStatus {
  if (ms < 120) return "ok";
  if (ms < 400) return "warn";
  return "fail";
}

function classifyBandwidth(mbps: number): StageStatus {
  if (mbps >= 5) return "ok";
  if (mbps >= 1.5) return "warn";
  return "fail";
}

function classifyVoiceHandshake(ms: number): StageStatus {
  // WebSocket to ConvAI typically opens in <500ms on a good connection,
  // up to ~1500ms being acceptable.
  if (ms < 700) return "ok";
  if (ms < 1500) return "warn";
  return "fail";
}

function classifyMic(ms: number): StageStatus {
  // First-time prompts can be slow because the user has to click "Allow".
  // Measure only the machine side: if permission was already granted,
  // getUserMedia should return in <500ms.
  if (ms < 500) return "ok";
  if (ms < 2000) return "warn";
  return "fail";
}

async function sampleRTT(url: string, init: RequestInit = {}): Promise<number> {
  const start = performance.now();
  await fetch(url, { cache: "no-store", ...init });
  return performance.now() - start;
}

async function runInternet(): Promise<{ ms: number }> {
  // Cloudflare trace endpoint is globally distributed and CORS-friendly.
  // Use no-cors to avoid needing any CORS handshake and still get timing.
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    samples.push(
      await sampleRTT(`https://www.cloudflare.com/cdn-cgi/trace?t=${Date.now() + i}`, {
        mode: "no-cors",
      })
    );
  }
  samples.sort((a, b) => a - b);
  return { ms: samples[Math.floor(samples.length / 2)] };
}

async function runServerPing(): Promise<{ ms: number; jitter: number }> {
  const samples: number[] = [];
  for (let i = 0; i < PING_SAMPLES; i++) {
    const start = performance.now();
    const res = await fetch(`${apiBase()}/api/admin/latency-probe/ping?t=${Date.now()}`, {
      cache: "no-store",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const jitter = samples[samples.length - 1] - samples[0];
  return { ms: median, jitter };
}

async function runElevenLabsRtt(): Promise<{ ms: number }> {
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    samples.push(
      await sampleRTT(`https://api.elevenlabs.io/v1/health?t=${Date.now() + i}`, {
        mode: "no-cors",
      })
    );
  }
  samples.sort((a, b) => a - b);
  return { ms: samples[Math.floor(samples.length / 2)] };
}

async function runDownload(): Promise<{ mbps: number; ms: number }> {
  const start = performance.now();
  const res = await fetch(
    `${apiBase()}/api/admin/latency-probe/download?bytes=${DOWNLOAD_BYTES}&t=${Date.now()}`,
    { cache: "no-store", headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const ms = performance.now() - start;
  const mbps = (buf.byteLength * 8) / (ms * 1000);
  return { mbps, ms };
}

async function runUpload(): Promise<{ mbps: number; ms: number }> {
  const payload = new Uint8Array(UPLOAD_BYTES);
  const CHUNK = 65536;
  for (let offset = 0; offset < payload.length; offset += CHUNK) {
    crypto.getRandomValues(payload.subarray(offset, Math.min(offset + CHUNK, payload.length)));
  }
  const start = performance.now();
  const res = await fetch(`${apiBase()}/api/admin/latency-probe/upload?t=${Date.now()}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/octet-stream",
    },
    body: payload,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await res.json();
  const ms = performance.now() - start;
  const mbps = (UPLOAD_BYTES * 8) / (ms * 1000);
  return { mbps, ms };
}

async function runMicrophone(): Promise<{ ms: number; sampleRate: number; label: string }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("MediaDevices no disponible en este navegador");
  }
  const start = performance.now();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ms = performance.now() - start;
  const track = stream.getAudioTracks()[0];
  const settings = track.getSettings();
  const label = track.label || "microfono por defecto";
  stream.getTracks().forEach((t) => t.stop());
  return {
    ms,
    sampleRate: settings.sampleRate ?? 0,
    label,
  };
}

async function runVoiceWebSocket(): Promise<{ signedUrlMs: number; openMs: number; firstMsgMs: number }> {
  // Step 1: fetch signed URL from backend (same endpoint used by real voice sessions).
  const signedStart = performance.now();
  const data = await api.post<{ signedUrl?: string }>("/api/elevenlabs/conversation-token", {});
  const signedUrlMs = performance.now() - signedStart;
  if (!data?.signedUrl) {
    throw new Error("Backend no entrego signedUrl (agente no configurado o kill-switch activo)");
  }
  // Step 2: open the actual ConvAI WebSocket and wait for first message.
  return await new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(data.signedUrl!);
    } catch (err) {
      reject(err instanceof Error ? err : new Error("No se pudo crear WebSocket"));
      return;
    }
    const openedAt = { v: 0 };
    const wsStart = performance.now();
    const timer = window.setTimeout(() => {
      try { ws.close(); } catch { /* noop */ }
      reject(new Error(`timeout tras ${WS_TIMEOUT_MS}ms`));
    }, WS_TIMEOUT_MS);

    ws.onopen = () => {
      openedAt.v = performance.now();
    };
    ws.onmessage = () => {
      if (!openedAt.v) return;
      const now = performance.now();
      window.clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      resolve({
        signedUrlMs,
        openMs: openedAt.v - wsStart,
        firstMsgMs: now - openedAt.v,
      });
    };
    ws.onerror = () => {
      window.clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      reject(new Error("Error de WebSocket al conectar con ElevenLabs"));
    };
  });
}

async function runServerProbes(): Promise<ServerProbeResponse> {
  return api.get<ServerProbeResponse>("/api/admin/latency-probe");
}

function buildVerdict(stages: StageResult[], server: ServerProbeDetail[]): string {
  const by = (id: StageId) => stages.find((s) => s.id === id);
  const internet = by("internet");
  const serverPing = by("server_ping");
  const elRtt = by("elevenlabs_rtt");
  const dl = by("download");
  const ul = by("upload");
  const mic = by("microphone");
  const ws = by("voice_ws");
  const elServer = server.find((p) => p.service === "elevenlabs");

  if (mic?.status === "fail") {
    return "El microfono no pudo inicializarse. Revisa permisos del navegador — sin esto la voz no puede funcionar.";
  }
  if (ws?.status === "fail") {
    return "El WebSocket de voz a ElevenLabs no se pudo abrir. Este es el camino real que usa una sesion — revisa firewalls/proxy o el estado de ElevenLabs.";
  }
  if (internet?.status === "fail") {
    return "Tu conexion a internet esta muy lenta. Revisa tu red antes de probar voz.";
  }
  if (dl?.status === "fail" || ul?.status === "fail") {
    return "Tu ancho de banda es bajo para conversaciones de voz en tiempo real (<1.5 Mbps). La voz se va a sentir entrecortada.";
  }
  if (elServer && !elServer.skipped && elServer.latencyMs > 1500) {
    return "El servidor tarda mucho en obtener el token de voz de ElevenLabs. Posible incidente del lado de ElevenLabs o del datacenter del servidor.";
  }
  if (elRtt?.status === "fail" && serverPing?.status !== "fail") {
    return "Tu ISP tarda en llegar a ElevenLabs aunque el servidor este bien. Puede ser ruteo o congestion regional.";
  }
  if (
    elServer && !elServer.skipped && elServer.latencyMs > 600 &&
    elRtt && elRtt.value !== null && elRtt.value < 300
  ) {
    return "El servidor tarda mas que tu navegador en llegar a ElevenLabs: el cuello esta entre el backend y ElevenLabs, no en tu red.";
  }
  if (ws?.value !== null && ws && ws.value !== undefined && ws.status === "warn") {
    return "El handshake del WebSocket de voz esta al limite. La voz va a sentirse con delay al inicio de cada sesion.";
  }
  if (
    internet?.status === "warn" ||
    serverPing?.status === "warn" ||
    elRtt?.status === "warn" ||
    dl?.status === "warn" ||
    ul?.status === "warn"
  ) {
    return "Todo funciona pero con margen ajustado. La voz puede sentirse con pequenos delays.";
  }
  return "Todo esta en verde. Si la voz se siente lenta, probablemente es la latencia natural del modelo de ElevenLabs (TTFA).";
}

export const useLatencyProbe = () => {
  const [stages, setStages] = useState<StageResult[]>(() => INITIAL_STAGES.map((s) => ({ ...s })));
  const [report, setReport] = useState<SpeedtestReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const updateStage = useCallback((id: StageId, patch: Partial<StageResult>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    setError(null);
    setReport(null);
    const fresh = INITIAL_STAGES.map((s) => ({
      ...s,
      status: "idle" as StageStatus,
      value: null,
      detail: undefined,
      error: undefined,
    }));
    setStages(fresh);
    const finalStages: StageResult[] = fresh.map((s) => ({ ...s }));
    let serverProbes: ServerProbeDetail[] = [];

    const indexOf = (id: StageId) => finalStages.findIndex((s) => s.id === id);

    async function stage(id: StageId, fn: () => Promise<Partial<StageResult>>) {
      updateStage(id, { status: "running" });
      try {
        const patch = await fn();
        updateStage(id, patch);
        Object.assign(finalStages[indexOf(id)], patch);
      } catch (err) {
        const patch: Partial<StageResult> = {
          status: "fail",
          error: err instanceof Error ? err.message : String(err),
        };
        updateStage(id, patch);
        Object.assign(finalStages[indexOf(id)], patch);
      }
    }

    // 1. Internet externo
    await stage("internet", async () => {
      const { ms } = await runInternet();
      return { status: classifyLatency(ms), value: Math.round(ms), detail: "mediana de 3 muestras no-cors a cloudflare.com" };
    });

    // 2. Ping al backend
    await stage("server_ping", async () => {
      const { ms, jitter } = await runServerPing();
      return {
        status: classifyLatency(ms),
        value: Math.round(ms),
        detail: `mediana de ${PING_SAMPLES} muestras · jitter ${Math.round(jitter)}ms`,
      };
    });

    // 3. RTT a ElevenLabs directo
    await stage("elevenlabs_rtt", async () => {
      const { ms } = await runElevenLabsRtt();
      return { status: classifyLatency(ms), value: Math.round(ms), detail: "mediana de 3 muestras no-cors a api.elevenlabs.io" };
    });

    // 4. Download
    await stage("download", async () => {
      const { mbps, ms } = await runDownload();
      return {
        status: classifyBandwidth(mbps),
        value: Math.round(mbps * 10) / 10,
        detail: `${(DOWNLOAD_BYTES / 1024 / 1024).toFixed(0)}MB en ${Math.round(ms)}ms`,
      };
    });

    // 5. Upload
    await stage("upload", async () => {
      const { mbps, ms } = await runUpload();
      return {
        status: classifyBandwidth(mbps),
        value: Math.round(mbps * 10) / 10,
        detail: `${(UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB en ${Math.round(ms)}ms`,
      };
    });

    // 6. Microfono
    await stage("microphone", async () => {
      const { ms, sampleRate, label } = await runMicrophone();
      const detail = `${Math.round(sampleRate / 1000)} kHz · ${label}`;
      return { status: classifyMic(ms), value: Math.round(ms), detail };
    });

    // 7. WebSocket real de ConvAI
    await stage("voice_ws", async () => {
      const { signedUrlMs, openMs, firstMsgMs } = await runVoiceWebSocket();
      const total = openMs + firstMsgMs;
      const detail = `signedUrl ${Math.round(signedUrlMs)}ms · open ${Math.round(openMs)}ms · primer mensaje ${Math.round(firstMsgMs)}ms`;
      return { status: classifyVoiceHandshake(total), value: Math.round(total), detail };
    });

    // 8. Probes del servidor
    await stage("server_probes", async () => {
      const resp = await runServerProbes();
      serverProbes = resp.probes;
      const elevenProbe = resp.probes.find((p) => p.service === "elevenlabs");
      const primary = elevenProbe ?? resp.probes.find((p) => p.service === "database")!;
      let status: StageStatus;
      if (primary.skipped) status = "skipped";
      else if (!primary.ok) status = "fail";
      else status = classifyLatency(primary.latencyMs);
      const detail = resp.probes
        .map((p) => `${p.service}:${p.skipped ? "—" : `${p.latencyMs}ms`}`)
        .join(" · ");
      return {
        status,
        value: primary.skipped ? null : primary.latencyMs,
        detail,
      };
    });

    const verdict = buildVerdict(finalStages, serverProbes);
    setReport({
      timestamp: new Date().toISOString(),
      stages: finalStages,
      serverProbes,
      verdict,
    });
    runningRef.current = false;
    setIsRunning(false);
  }, [updateStage]);

  return { stages, report, isRunning, error, run };
};
