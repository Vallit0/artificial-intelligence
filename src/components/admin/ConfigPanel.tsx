import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Award, Clock, GraduationCap, Loader2, Save, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlatformConfig, APP_CONFIG_DEFAULTS, type AppConfigPatch } from "@/hooks/useAppConfig";

// Estado local del formulario. Las duraciones se editan en MINUTOS (la DB
// guarda segundos); el resto se mapea 1:1.
interface FormState {
  callDurationProspeccionMin: number;
  callDurationObjecionesMin: number;
  passThresholdProspeccion: number;
  passThresholdObjeciones: number;
  certificateInstructorName: string;
  certificateDirectorName: string;
  certificateCourseName: string;
}

const EMPTY: FormState = {
  callDurationProspeccionMin: APP_CONFIG_DEFAULTS.callDurationProspeccionSec / 60,
  callDurationObjecionesMin: APP_CONFIG_DEFAULTS.callDurationObjecionesSec / 60,
  passThresholdProspeccion: APP_CONFIG_DEFAULTS.passThresholdProspeccion,
  passThresholdObjeciones: APP_CONFIG_DEFAULTS.passThresholdObjeciones,
  certificateInstructorName: "",
  certificateDirectorName: "",
  certificateCourseName: "",
};

export default function ConfigPanel() {
  const { config, isLoading, updateConfig } = usePlatformConfig();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    setForm({
      callDurationProspeccionMin: Math.round(config.callDurationProspeccionSec / 60),
      callDurationObjecionesMin: Math.round(config.callDurationObjecionesSec / 60),
      passThresholdProspeccion: config.passThresholdProspeccion,
      passThresholdObjeciones: config.passThresholdObjeciones,
      certificateInstructorName: config.certificateInstructorName ?? "",
      certificateDirectorName: config.certificateDirectorName ?? "",
      certificateCourseName: config.certificateCourseName ?? "",
    });
  }, [config]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Convierte minutos a segundos para la DB, clamp a 1–60 min.
  const minToSec = (min: number) => Math.max(1, Math.min(60, Math.round(min || 0))) * 60;
  const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)));

  const handleSave = async () => {
    setSaving(true);
    const patch: AppConfigPatch = {
      callDurationProspeccionSec: minToSec(form.callDurationProspeccionMin),
      callDurationObjecionesSec: minToSec(form.callDurationObjecionesMin),
      passThresholdProspeccion: clampPct(form.passThresholdProspeccion),
      passThresholdObjeciones: clampPct(form.passThresholdObjeciones),
      certificateInstructorName: form.certificateInstructorName.trim() || null,
      certificateDirectorName: form.certificateDirectorName.trim() || null,
      certificateCourseName: form.certificateCourseName.trim() || null,
    };
    const ok = await updateConfig(patch);
    setSaving(false);
    toast(
      ok
        ? { title: "Configuración guardada", description: "Los cambios aplican de inmediato." }
        : { title: "Error", description: "No se pudo guardar la configuración.", variant: "destructive" },
    );
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
          <Settings className="w-5 h-5 text-primary" />
          Configuración de la plataforma
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Estos valores aplican a toda la plataforma. Los cambios se reflejan de inmediato; los
          umbrales rigen la aprobación de los exámenes.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duración de llamadas */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Duración máxima de llamada (minutos)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Prospección</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={form.callDurationProspeccionMin}
                onChange={(e) => set("callDurationProspeccionMin", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Objeciones</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={form.callDurationObjecionesMin}
                onChange={(e) => set("callDurationObjecionesMin", Number(e.target.value))}
              />
            </div>
          </div>
        </section>

        {/* Umbrales de aprobación */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
            Umbral de aprobación del examen (0–100)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Prospección</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.passThresholdProspeccion}
                onChange={(e) => set("passThresholdProspeccion", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Objeciones</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.passThresholdObjeciones}
                onChange={(e) => set("passThresholdObjeciones", Number(e.target.value))}
              />
            </div>
          </div>
        </section>

        {/* Certificado */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Award className="w-4 h-4 text-muted-foreground" />
            Certificado
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del Instructor (firma)</Label>
              <Input
                placeholder="Vacío = línea sin nombre"
                value={form.certificateInstructorName}
                onChange={(e) => set("certificateInstructorName", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre del Director Académico (firma)</Label>
              <Input
                placeholder="Vacío = línea sin nombre"
                value={form.certificateDirectorName}
                onChange={(e) => set("certificateDirectorName", e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Nombre del curso</Label>
              <Input
                placeholder="Vacío = «Manejo de Objeciones»"
                value={form.certificateCourseName}
                onChange={(e) => set("certificateCourseName", e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
