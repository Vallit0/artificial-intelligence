import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Gauge, Loader2, RefreshCw, Zap } from "lucide-react";
import { api } from "@/lib/api-client";

interface AggregateStats {
  avg: number | null;
  p50: number | null;
  p95: number | null;
  count: number;
}

interface RecentSession {
  id: string;
  createdAt: string;
  durationSeconds: number;
  connectMs: number | null;
  ttfaSamplesCount: number;
  ttfaAvgMs: number | null;
  ttfaP95Ms: number | null;
  userName: string;
  scenarioName: string | null;
}

interface AgentLatencyResponse {
  ttfa: AggregateStats;
  connect: AggregateStats;
  sessionCount: number;
  recent: RecentSession[];
}

function tone(ms: number | null, goodMax: number, okMax: number): string {
  if (ms === null) return "text-muted-foreground";
  if (ms <= goodMax) return "text-emerald-600 dark:text-emerald-400";
  if (ms <= okMax) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function fmt(ms: number | null): string {
  return ms === null ? "—" : `${ms}ms`;
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatCard({
  label,
  value,
  hint,
  toneClass,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  toneClass: string;
  icon: React.ElementType;
}) {
  return (
    <div className="p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={`text-2xl font-bold font-mono tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function AgentLatencyPanel() {
  const [data, setData] = useState<AgentLatencyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<AgentLatencyResponse>("/api/admin/agent-latency?limit=50");
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando metricas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              Performance del agente
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Latencia real medida en sesiones de estudiantes. <span className="font-mono">connect</span> = handshake
              al iniciar la llamada. <span className="font-mono">TTFA</span> = tiempo entre que el estudiante deja de
              hablar y el agente empieza a responder. Solo cuenta sesiones con datos persistidos.
            </p>
          </div>
          <Button onClick={fetchData} disabled={isLoading} size="sm" variant="outline">
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {isLoading && !data && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {data && (
          <>
            {/* Aggregates */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="TTFA promedio"
                value={fmt(data.ttfa.avg)}
                hint={`${data.ttfa.count} muestras`}
                toneClass={tone(data.ttfa.avg, 800, 1500)}
                icon={Zap}
              />
              <StatCard
                label="TTFA p95"
                value={fmt(data.ttfa.p95)}
                hint="95% por debajo"
                toneClass={tone(data.ttfa.p95, 1200, 2500)}
                icon={Activity}
              />
              <StatCard
                label="Connect promedio"
                value={fmt(data.connect.avg)}
                hint={`${data.connect.count} sesiones`}
                toneClass={tone(data.connect.avg, 500, 1500)}
                icon={Gauge}
              />
              <StatCard
                label="Sesiones con datos"
                value={String(data.sessionCount)}
                hint={`top ${data.recent.length}`}
                toneClass="text-foreground"
                icon={Activity}
              />
            </div>

            {/* Recent sessions table — scroll horizontal en móvil (el grid tiene
                un ancho mínimo para no aplastar las columnas de métricas). */}
            <div className="border rounded-lg overflow-x-auto">
              <div className="min-w-[640px]">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-3">Estudiante</div>
                <div className="col-span-2">Escenario</div>
                <div className="col-span-1 text-right">Dur.</div>
                <div className="col-span-2 text-right">Connect</div>
                <div className="col-span-2 text-right">TTFA avg</div>
                <div className="col-span-2 text-right">TTFA p95 (n)</div>
              </div>
              <div className="divide-y">
                {data.recent.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Aun no hay sesiones con metricas. Las metricas se persisten al terminar una llamada.
                  </div>
                )}
                {data.recent.map((s) => (
                  <div key={s.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center hover:bg-muted/20">
                    <div className="col-span-3 truncate" title={s.userName}>
                      {s.userName}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="col-span-2 truncate text-muted-foreground" title={s.scenarioName ?? ""}>
                      {s.scenarioName ?? <span className="italic">— libre —</span>}
                    </div>
                    <div className="col-span-1 text-right font-mono tabular-nums text-muted-foreground">
                      {fmtDuration(s.durationSeconds)}
                    </div>
                    <div className={`col-span-2 text-right font-mono tabular-nums ${tone(s.connectMs, 500, 1500)}`}>
                      {fmt(s.connectMs)}
                    </div>
                    <div className={`col-span-2 text-right font-mono tabular-nums ${tone(s.ttfaAvgMs, 800, 1500)}`}>
                      {fmt(s.ttfaAvgMs)}
                    </div>
                    <div className={`col-span-2 text-right font-mono tabular-nums ${tone(s.ttfaP95Ms, 1200, 2500)}`}>
                      {fmt(s.ttfaP95Ms)}
                      <Badge variant="secondary" className="ml-1 text-[10px] font-normal">
                        n={s.ttfaSamplesCount}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>

            {/* Threshold legend */}
            <div className="mt-4 p-3 rounded-lg bg-muted/30 border text-[11px] text-muted-foreground">
              <p className="font-semibold mb-1">Umbrales (color):</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span><span className="text-emerald-600 dark:text-emerald-400">verde</span> = TTFA ≤ 800ms · connect ≤ 500ms</span>
                <span><span className="text-amber-600 dark:text-amber-400">amarillo</span> = aceptable</span>
                <span><span className="text-destructive">rojo</span> = lento, revisar</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
