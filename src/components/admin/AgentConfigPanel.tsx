import { useState, useEffect } from "react";
import { useAgentConfigs, AgentConfig } from "@/hooks/useAgentConfigs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Check, Key, Loader2, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_KEY_CONFIG = { secretName: "ELEVENLABS_API_KEY", label: "API Key de ElevenLabs" };

const KNOWN_AGENTS = [
  { secretName: "ELEVENLABS_AGENT_ID", label: "Agente Default (Fallback)" },
  { secretName: "ELEVENLABS_AGENT_COACH", label: "Coach" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_CLIENTE", label: "Role-Play Cliente" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_ASESOR", label: "Role-Play Asesor" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_PAREJA", label: "Prospeccion: Pareja en Caja" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_FRUTAS", label: "Prospeccion: Frutas y Verduras" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_NEUMATICOS", label: "Prospeccion: Neumaticos" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_RESTAURANTE", label: "Prospeccion: Restaurante" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_PARQUEO", label: "Prospeccion: Parqueo" },
  { secretName: "ELEVENLABS_AGENT_PROSPECCION_FISICA", label: "Prospeccion Fisica" },
  { secretName: "ELEVENLABS_AGENT_LEGADO_VIDA", label: "Legado de Vida" },
  { secretName: "ELEVENLABS_AGENT_EXAMEN_FINAL", label: "Examen Final" },
];

export default function AgentConfigPanel() {
  const { configs, isLoading, saveConfig, deleteConfig } = useAgentConfigs();
  const { toast } = useToast();

  // Merge known agents with DB configs
  const [rows, setRows] = useState<Record<string, { agentId: string; label: string; dbId?: string }>>({});
  const [apiKeyRow, setApiKeyRow] = useState<{ value: string; dbId?: string }>({ value: "" });
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const merged: typeof rows = {};
    // Start with known agents
    for (const known of KNOWN_AGENTS) {
      merged[known.secretName] = { agentId: "", label: known.label, dbId: undefined };
    }
    // Override with DB values
    for (const cfg of configs) {
      if (cfg.secretName === API_KEY_CONFIG.secretName) {
        setApiKeyRow({ value: cfg.agentId, dbId: cfg.id });
        continue;
      }
      merged[cfg.secretName] = {
        agentId: cfg.agentId,
        label: cfg.label || merged[cfg.secretName]?.label || cfg.secretName,
        dbId: cfg.id,
      };
    }
    setRows(merged);
  }, [configs]);

  const handleSaveApiKey = async () => {
    if (!apiKeyRow.value.trim()) {
      toast({ title: "Error", description: "Ingresa la API Key", variant: "destructive" });
      return;
    }
    setSavingKey(API_KEY_CONFIG.secretName);
    const success = await saveConfig(API_KEY_CONFIG.secretName, apiKeyRow.value.trim(), API_KEY_CONFIG.label);
    setSavingKey(null);
    if (success) {
      toast({ title: "Guardado", description: "API Key de ElevenLabs actualizada." });
    }
  };

  const handleDeleteApiKey = async () => {
    if (!apiKeyRow.dbId) return;
    const success = await deleteConfig(apiKeyRow.dbId);
    if (success) {
      setApiKeyRow({ value: "" });
      toast({ title: "Eliminado", description: "API Key eliminada. Se usara la variable de entorno." });
    }
  };

  const handleSave = async (secretName: string) => {
    const row = rows[secretName];
    if (!row?.agentId.trim()) {
      toast({ title: "Error", description: "Ingresa un Agent ID", variant: "destructive" });
      return;
    }
    setSavingKey(secretName);
    const success = await saveConfig(secretName, row.agentId.trim(), row.label);
    setSavingKey(null);
    if (success) {
      toast({ title: "Guardado", description: `${row.label || secretName} actualizado.` });
    }
  };

  const handleDelete = async (secretName: string) => {
    const row = rows[secretName];
    if (!row?.dbId) return;
    const success = await deleteConfig(row.dbId);
    if (success) {
      toast({ title: "Eliminado", description: `Config de ${row.label || secretName} eliminada.` });
    }
  };

  const updateRow = (secretName: string, field: "agentId" | "label", value: string) => {
    setRows((prev) => ({
      ...prev,
      [secretName]: { ...prev[secretName], [field]: value },
    }));
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
          <Bot className="w-5 h-5 text-primary" />
          Configuracion de Agentes ElevenLabs
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configura los Agent IDs de ElevenLabs para cada funcionalidad. Los cambios aplican inmediatamente.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* API Key Section */}
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">{API_KEY_CONFIG.label}</p>
              {apiKeyRow.dbId && (
                <Badge variant="secondary" className="text-[10px]">
                  <Check className="w-3 h-3 mr-0.5" /> Configurado
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="xi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={apiKeyRow.value}
                onChange={(e) => setApiKeyRow((prev) => ({ ...prev, value: e.target.value }))}
                className="h-9 text-sm font-mono flex-1"
              />
              <Button
                size="sm"
                onClick={handleSaveApiKey}
                disabled={savingKey === API_KEY_CONFIG.secretName}
                className="shrink-0"
              >
                {savingKey === API_KEY_CONFIG.secretName ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </Button>
              {apiKeyRow.dbId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDeleteApiKey}
                  className="shrink-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Si no se configura aqui, se usara la variable de entorno del servidor.
            </p>
          </div>

          {/* Agent IDs Section */}
          {Object.entries(rows).map(([secretName, row]) => (
            <div
              key={secretName}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg bg-muted/30 border"
            >
              <div className="flex-1 min-w-0 space-y-1 sm:space-y-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{row.label}</p>
                  {row.dbId && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Check className="w-3 h-3 mr-0.5" /> Configurado
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-mono truncate">{secretName}</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="agent_xxxxxxxxxx"
                  value={row.agentId}
                  onChange={(e) => updateRow(secretName, "agentId", e.target.value)}
                  className="h-9 text-sm font-mono w-full sm:w-64"
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(secretName)}
                  disabled={savingKey === secretName}
                  className="shrink-0"
                >
                  {savingKey === secretName ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </Button>
                {row.dbId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(secretName)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
