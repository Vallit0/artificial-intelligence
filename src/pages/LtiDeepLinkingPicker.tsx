import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, BookOpen, Loader2 } from "lucide-react";

interface PickerScenario {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
}

interface PickerState {
  stateId: string;
  platformName: string;
  contextTitle: string | null;
  scenarios: PickerScenario[];
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function LtiDeepLinkingPicker() {
  const [searchParams] = useSearchParams();
  const stateId = searchParams.get("state");

  const [data, setData] = useState<PickerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeMenu, setIncludeMenu] = useState(false);

  useEffect(() => {
    if (!stateId) {
      setError("Falta el parámetro state. Volvé a iniciar la actividad desde Moodle.");
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/lti/deep-linking/state/${stateId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<PickerState>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "No se pudo cargar la sesión de selección.");
        setLoading(false);
      });
  }, [stateId]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (!stateId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/lti/deep-linking/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateId,
          scenarioIds: [...selected],
          includeMenuLink: includeMenu,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const html = await res.text();
      // Replace the entire document with the auto-submit form so it POSTs
      // back to Moodle without any extra navigation.
      document.open();
      document.write(html);
      document.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la selección.");
      setSubmitting(false);
    }
  };

  const orderedScenarios = useMemo(
    () => (data ? [...data.scenarios].sort((a, b) => a.displayOrder - b.displayOrder) : []),
    [data],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              No se pudo cargar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Seleccionar actividad para Moodle
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Curso: <strong>{data.contextTitle ?? "(sin título)"}</strong> · Plataforma: {data.platformName}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Escenarios disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            {orderedScenarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay escenarios activos.</p>
            ) : (
              <div className="space-y-2">
                {orderedScenarios.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-start gap-3 p-3 rounded border cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => toggle(s.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {s.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={includeMenu}
                  onCheckedChange={(v) => setIncludeMenu(v === true)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-sm">Incluir también el menú general</div>
                  <div className="text-xs text-muted-foreground">
                    Agrega un link que abre el listado completo de prácticas. Útil si querés que los alumnos elijan.
                  </div>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">
            {selected.size} escenario{selected.size === 1 ? "" : "s"} seleccionado
            {selected.size === 1 ? "" : "s"}
          </Badge>
          <Button onClick={handleSubmit} disabled={submitting} size="lg">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Enviar a Moodle
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Si no seleccionás ningún escenario, se enviará un único link al menú general.
        </p>
      </div>
    </div>
  );
}
