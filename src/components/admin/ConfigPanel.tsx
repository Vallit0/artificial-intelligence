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
  certificateLevel1InstructorName: string;
  certificateLevel1DirectorName: string;
  certificateLevel1CourseName: string;
  // Firmas como data URI base64 ("" = sin firma).
  certificateInstructorSignature: string;
  certificateDirectorSignature: string;
  certificateLevel1InstructorSignature: string;
  certificateLevel1DirectorSignature: string;
}

const EMPTY: FormState = {
  callDurationProspeccionMin: APP_CONFIG_DEFAULTS.callDurationProspeccionSec / 60,
  callDurationObjecionesMin: APP_CONFIG_DEFAULTS.callDurationObjecionesSec / 60,
  passThresholdProspeccion: APP_CONFIG_DEFAULTS.passThresholdProspeccion,
  passThresholdObjeciones: APP_CONFIG_DEFAULTS.passThresholdObjeciones,
  certificateInstructorName: "",
  certificateDirectorName: "",
  certificateCourseName: "",
  certificateLevel1InstructorName: "",
  certificateLevel1DirectorName: "",
  certificateLevel1CourseName: "",
  certificateInstructorSignature: "",
  certificateDirectorSignature: "",
  certificateLevel1InstructorSignature: "",
  certificateLevel1DirectorSignature: "",
};

// Lee un File como data URI base64 (data:image/png;base64,...).
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Tope de ~1.5 MB por firma (el backend rechaza >2 MB de data URI).
const MAX_SIGNATURE_BYTES = 1.5 * 1024 * 1024;

interface SignatureFieldProps {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  onError: (message: string) => void;
}

function SignatureField({ label, value, onChange, onError }: SignatureFieldProps) {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-subir el mismo archivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("La firma debe ser una imagen (PNG o JPG).");
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      onError("La imagen de firma es muy pesada (máx. 1.5 MB).");
      return;
    }
    try {
      onChange(await fileToDataUrl(file));
    } catch {
      onError("No se pudo leer la imagen de firma.");
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt="Firma"
            className="h-12 max-w-[140px] object-contain rounded border bg-white p-1"
          />
        ) : (
          <span className="text-xs text-muted-foreground">Sin firma</span>
        )}
        <Input
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFile}
          className="max-w-[220px] cursor-pointer"
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Quitar
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        PNG con fondo transparente recomendado. Se dibuja sobre la línea de firma.
      </p>
    </div>
  );
}

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
      certificateLevel1InstructorName: config.certificateLevel1InstructorName ?? "",
      certificateLevel1DirectorName: config.certificateLevel1DirectorName ?? "",
      certificateLevel1CourseName: config.certificateLevel1CourseName ?? "",
      certificateInstructorSignature: config.certificateInstructorSignature ?? "",
      certificateDirectorSignature: config.certificateDirectorSignature ?? "",
      certificateLevel1InstructorSignature: config.certificateLevel1InstructorSignature ?? "",
      certificateLevel1DirectorSignature: config.certificateLevel1DirectorSignature ?? "",
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
      certificateLevel1InstructorName: form.certificateLevel1InstructorName.trim() || null,
      certificateLevel1DirectorName: form.certificateLevel1DirectorName.trim() || null,
      certificateLevel1CourseName: form.certificateLevel1CourseName.trim() || null,
      certificateInstructorSignature: form.certificateInstructorSignature || null,
      certificateDirectorSignature: form.certificateDirectorSignature || null,
      certificateLevel1InstructorSignature: form.certificateLevel1InstructorSignature || null,
      certificateLevel1DirectorSignature: form.certificateLevel1DirectorSignature || null,
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
              <Label className="text-xs">Prospección (Nivel 1)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.passThresholdProspeccion}
                onChange={(e) => set("passThresholdProspeccion", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Objeciones (Nivel 2)</Label>
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

        {/* Certificado Nivel 1 (Prospección) */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Award className="w-4 h-4 text-muted-foreground" />
            Certificado Nivel 1 (Prospección)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del Instructor (firma)</Label>
              <Input
                placeholder="Vacío = línea sin nombre"
                value={form.certificateLevel1InstructorName}
                onChange={(e) => set("certificateLevel1InstructorName", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre del Director Académico (firma)</Label>
              <Input
                placeholder="Vacío = línea sin nombre"
                value={form.certificateLevel1DirectorName}
                onChange={(e) => set("certificateLevel1DirectorName", e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Nombre del curso</Label>
              <Input
                placeholder="Vacío = «Prospección»"
                value={form.certificateLevel1CourseName}
                onChange={(e) => set("certificateLevel1CourseName", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <SignatureField
                label="Firma del Instructor (imagen)"
                value={form.certificateLevel1InstructorSignature}
                onChange={(v) => set("certificateLevel1InstructorSignature", v)}
                onError={(m) => toast({ title: "Error", description: m, variant: "destructive" })}
              />
            </div>
            <div className="sm:col-span-2">
              <SignatureField
                label="Firma del Director Académico (imagen)"
                value={form.certificateLevel1DirectorSignature}
                onChange={(v) => set("certificateLevel1DirectorSignature", v)}
                onError={(m) => toast({ title: "Error", description: m, variant: "destructive" })}
              />
            </div>
          </div>
        </section>

        {/* Certificado Nivel 2 (Manejo de Objeciones) */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Award className="w-4 h-4 text-muted-foreground" />
            Certificado Nivel 2 (Manejo de Objeciones)
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
            <div className="sm:col-span-2">
              <SignatureField
                label="Firma del Instructor (imagen)"
                value={form.certificateInstructorSignature}
                onChange={(v) => set("certificateInstructorSignature", v)}
                onError={(m) => toast({ title: "Error", description: m, variant: "destructive" })}
              />
            </div>
            <div className="sm:col-span-2">
              <SignatureField
                label="Firma del Director Académico (imagen)"
                value={form.certificateDirectorSignature}
                onChange={(v) => set("certificateDirectorSignature", v)}
                onError={(m) => toast({ title: "Error", description: m, variant: "destructive" })}
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
