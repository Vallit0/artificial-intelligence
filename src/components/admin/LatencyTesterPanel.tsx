import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Gauge,
  Globe,
  Loader2,
  Mic,
  MinusCircle,
  Play,
  Radio,
  Server,
  Wifi,
  XCircle,
} from "lucide-react";
import { ReactNode } from "react";
import { useLatencyProbe, StageId, StageResult, StageStatus } from "@/hooks/useLatencyProbe";

const STAGE_ICON: Record<StageId, ReactNode> = {
  internet: <Globe className="w-4 h-4" />,
  server_ping: <Wifi className="w-4 h-4" />,
  elevenlabs_rtt: <Radio className="w-4 h-4" />,
  download: <ArrowDownToLine className="w-4 h-4" />,
  upload: <ArrowUpFromLine className="w-4 h-4" />,
  microphone: <Mic className="w-4 h-4" />,
  voice_ws: <Radio className="w-4 h-4" />,
  server_probes: <Server className="w-4 h-4" />,
};

function StageIndicator({ status }: { status: StageStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    case "ok":
      return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case "warn":
      return <CheckCircle2 className="w-4 h-4 text-amber-500" />;
    case "fail":
      return <XCircle className="w-4 h-4 text-destructive" />;
    case "skipped":
      return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-muted" />;
  }
}

function statusTone(status: StageStatus): string {
  switch (status) {
    case "ok":
      return "text-emerald-600 dark:text-emerald-400";
    case "warn":
      return "text-amber-600 dark:text-amber-400";
    case "fail":
      return "text-destructive";
    case "skipped":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

function formatValue(stage: StageResult): string {
  if (stage.value === null) {
    if (stage.status === "skipped") return "—";
    if (stage.status === "fail") return "✕";
    if (stage.status === "running") return "…";
    return "—";
  }
  return `${stage.value} ${stage.unit}`;
}

function StageRow({ stage }: { stage: StageResult }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 pt-0.5">
        <StageIndicator status={stage.status} />
        <span className="text-muted-foreground">{STAGE_ICON[stage.id]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{stage.label}</p>
        <p className="text-[11px] text-muted-foreground">{stage.hint}</p>
        {stage.detail && (
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{stage.detail}</p>
        )}
        {stage.error && <p className="text-[11px] text-destructive mt-0.5">{stage.error}</p>}
      </div>
      <div className={`text-sm font-mono font-semibold tabular-nums shrink-0 ${statusTone(stage.status)}`}>
        {formatValue(stage)}
      </div>
    </div>
  );
}

export default function LatencyTesterPanel() {
  const { stages, report, isRunning, error, run } = useLatencyProbe();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              Diagnostico tipo Speedtest
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Corre enteramente en tu navegador. Mide tu internet, ancho de banda, el microfono, y abre un
              WebSocket real contra ElevenLabs para que sepas si la voz lenta es tu red, tu banda, el
              servidor, o el propio ElevenLabs. Al final hay un veredicto.
            </p>
          </div>
          <Button onClick={run} disabled={isRunning} size="sm">
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Corriendo...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Ejecutar prueba
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <div className="space-y-2">
          {stages.map((s) => (
            <StageRow key={s.id} stage={s} />
          ))}
        </div>

        {report && (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-lg border bg-primary/5 flex items-start gap-3">
              <Activity className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Veredicto</p>
                <p className="text-sm text-foreground">{report.verdict}</p>
                <p className="text-[11px] text-muted-foreground">
                  Corrida: <span className="font-mono">{new Date(report.timestamp).toLocaleTimeString()}</span>
                </p>
              </div>
            </div>

            {report.serverProbes.length > 0 && (
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" />
                  Detalle servidor → servicios
                </p>
                <div className="space-y-1.5">
                  {report.serverProbes.map((p) => (
                    <div key={p.service} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-medium capitalize shrink-0">{p.service}</span>
                        {p.service === "elevenlabs" && (
                          <Badge variant="outline" className="text-[10px] flex items-center gap-0.5">
                            <Mic className="w-2.5 h-2.5" />
                            voz
                          </Badge>
                        )}
                        {p.skipped && (
                          <Badge variant="secondary" className="text-[10px]">no configurado</Badge>
                        )}
                        <span className="text-muted-foreground font-mono truncate">
                          {p.target}
                          {p.detail ? ` — ${p.detail}` : ""}
                        </span>
                      </span>
                      <span className={`font-mono font-semibold tabular-nums shrink-0 ${
                        p.skipped
                          ? "text-muted-foreground"
                          : !p.ok
                          ? "text-destructive"
                          : p.latencyMs < 200
                          ? "text-emerald-600 dark:text-emerald-400"
                          : p.latencyMs < 1000
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-destructive"
                      }`}>
                        {p.skipped ? "—" : `${p.latencyMs}ms`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 p-3 rounded-lg bg-muted/30 border text-[11px] text-muted-foreground space-y-2">
          <div>
            <p className="font-semibold mb-1">Umbrales:</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Ping: {"<"} 120ms bueno · {"<"} 400ms aceptable</span>
              <span>Banda ancha: {"≥"} 5 Mbps bueno · {"≥"} 1.5 Mbps aceptable</span>
            </div>
          </div>
          <p>
            <span className="font-semibold">Latencia de voz en sesion real:</span> durante una llamada, el hook emite
            en consola los eventos <code className="font-mono">connect</code> (apertura de WebSocket) y {" "}
            <code className="font-mono">ttfa</code> (tiempo al primer audio del agente). Eso complementa este
            diagnostico.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
