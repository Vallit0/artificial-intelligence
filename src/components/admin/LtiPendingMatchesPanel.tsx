import { useState } from "react";
import { useLtiPendingMatches, LtiPendingMatch } from "@/hooks/useLtiPendingMatches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function describeCandidate(c: LtiPendingMatch["candidates"][number]): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "(sin nombre)";
  return `${name} — ${c.email}`;
}

export default function LtiPendingMatchesPanel() {
  const { matches, isLoading, resolveMatch, dismissMatch } = useLtiPendingMatches();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});

  const handleResolve = async (m: LtiPendingMatch) => {
    const userId = picked[m.id];
    if (!userId) {
      toast({
        title: "Seleccioná un candidato",
        description: "Tenés que elegir uno de los usuarios listados antes de resolver.",
        variant: "destructive",
      });
      return;
    }
    setBusyId(m.id);
    const ok = await resolveMatch(m.id, userId);
    setBusyId(null);
    if (ok) toast({ title: "Resuelto", description: "El estudiante quedó linkeado a este miembro de Moodle." });
    else toast({ title: "Error", description: "No se pudo resolver.", variant: "destructive" });
  };

  const handleDismiss = async (m: LtiPendingMatch) => {
    setBusyId(m.id);
    const ok = await dismissMatch(m.id);
    setBusyId(null);
    if (ok) toast({ title: "Descartado", description: "Marcado como no-asesor o no-aplicable." });
    else toast({ title: "Error", description: "No se pudo descartar.", variant: "destructive" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          Matches Pendientes ({matches.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin matches pendientes. El sync resuelve automáticamente cuando hay match por email o nombre único.
          </p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <div key={m.id} className="p-4 border rounded-lg bg-muted/20 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{m.ltiName ?? "(sin nombre)"}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.ltiEmail ?? "(sin email)"} ·{" "}
                      <span className="font-mono">LTI uid: {m.ltiUserId}</span>
                    </div>
                    {m.courseSync && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Curso: {m.courseSync.contextTitle ?? m.courseSync.contextId}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline">{m.reason}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Candidatos en Señoriales:
                  </div>
                  {m.candidates.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">Sin candidatos disponibles.</div>
                  ) : (
                    <div className="space-y-1">
                      {m.candidates.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="radio"
                            name={`pick-${m.id}`}
                            value={c.id}
                            checked={picked[m.id] === c.id}
                            onChange={() => setPicked({ ...picked, [m.id]: c.id })}
                          />
                          <span className="text-sm">{describeCandidate(c)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDismiss(m)}
                    disabled={busyId === m.id}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Descartar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleResolve(m)}
                    disabled={busyId === m.id || !picked[m.id]}
                  >
                    {busyId === m.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    Linkear
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
