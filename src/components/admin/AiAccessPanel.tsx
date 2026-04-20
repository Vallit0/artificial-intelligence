import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface AiAccessStatus {
  locked: boolean;
  reason: string | null;
  lockedAt: number | null;
}

export default function AiAccessPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState<AiAccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  const load = async () => {
    try {
      const data = await api.get<AiAccessStatus>("/api/admin/ai-access");
      setStatus(data);
      setReason(data.reason ?? "");
    } catch (err) {
      console.error("Failed to load AI access status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    try {
      const data = await api.put<AiAccessStatus & { success: boolean }>("/api/admin/ai-access", {
        locked: next,
        reason: next ? (reason || "Demo en curso. La practica con IA esta pausada.") : null,
      });
      setStatus({ locked: data.locked, reason: data.reason, lockedAt: data.lockedAt });
      toast({
        title: next ? "IA bloqueada" : "IA desbloqueada",
        description: next
          ? "Solo los administradores pueden iniciar conversaciones."
          : "Todos los usuarios pueden practicar de nuevo.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo actualizar",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const locked = !!status?.locked;

  return (
    <Card className={locked ? "border-destructive/60 bg-destructive/5" : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${locked ? "bg-destructive/15" : "bg-primary/10"}`}>
              {locked ? <ShieldAlert className="w-5 h-5 text-destructive" /> : <Lock className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Modo Demo (Bloquear IA)
                {locked && <Badge variant="destructive">ACTIVO</Badge>}
              </CardTitle>
              <CardDescription>
                Bloquea el acceso a todas las conversaciones con IA para todos los usuarios, excepto administradores.
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={locked}
            disabled={saving}
            onCheckedChange={handleToggle}
            aria-label="Bloquear IA"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Mensaje mostrado a los usuarios (opcional)
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Demo en curso. La practica con IA esta pausada."
            disabled={saving}
          />
          {locked && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggle(true)}
                disabled={saving}
              >
                Actualizar mensaje
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Al reiniciar el servidor, el bloqueo se desactiva automaticamente (valor seguro por defecto).
        </p>
      </CardContent>
    </Card>
  );
}
