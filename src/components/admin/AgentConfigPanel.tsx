import { useState, useEffect } from "react";
import { useAgentConfigs, AgentConfig } from "@/hooks/useAgentConfigs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Check, Globe, Key, Loader2, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Enrutamiento por país (espeja server/src/services/elevenlabs.service.ts):
// el país por defecto usa el secret name tal cual (ELEVENLABS_AGENT_COACH);
// los demás países usan sufijo ISO2 (ELEVENLABS_AGENT_COACH_MX). Si un país
// no tiene agente configurado, sus usuarios caen al agente base.
const COUNTRY_SUFFIX_RE = new RegExp(`_(${COUNTRIES.map((c) => c.code).join("|")})$`);

const secretNameForCountry = (base: string, country: string) =>
  country === DEFAULT_COUNTRY_CODE ? base : `${base}_${country}`;

// Separa "ELEVENLABS_AGENT_COACH_MX" → { base: "ELEVENLABS_AGENT_COACH", country: "MX" }.
const splitSecretName = (secretName: string): { base: string; country: string } => {
  const m = secretName.match(COUNTRY_SUFFIX_RE);
  if (!m) return { base: secretName, country: DEFAULT_COUNTRY_CODE };
  return { base: secretName.slice(0, -m[0].length), country: m[1] };
};

const API_KEY_CONFIG = { secretName: "ELEVENLABS_API_KEY", label: "API Key de ElevenLabs" };

const KNOWN_AGENTS = [
  { secretName: "ELEVENLABS_AGENT_ID", label: "Agente Default (Fallback)" },
  { secretName: "ELEVENLABS_AGENT_COACH", label: "Nivel 1 · Coach (Prospeccion)" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_CLIENTE", label: "Nivel 1 · Role-Play Cliente (Prospeccion)" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_ASESOR", label: "Nivel 1 · Role-Play Asesor (Prospeccion)" },
  { secretName: "ELEVENLABS_AGENT_COACH_NIVEL2", label: "Nivel 2 · Coach (Manejo de Objeciones)" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_CLIENTE_NIVEL2", label: "Nivel 2 · Role-Play Clientes (Pareja, multi-voice)" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_ASESOR_NIVEL2", label: "Nivel 2 · Role-Play Asesor (Manejo de Objeciones)" },
  // Pista Cremacion: mismos roles que N1/N2 con sufijo _CREMACION (ver
  // CREMACION_AGENT_SUFFIX en src/lib/cremacion-theme.ts). Mientras no esten
  // configurados, resolveAgent cae al agente default y lo registra como MISROUTE.
  { secretName: "ELEVENLABS_AGENT_COACH_CREMACION", label: "Cremacion N1 · Coach" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_CLIENTE_CREMACION", label: "Cremacion N1 · Role-Play Cliente" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_ASESOR_CREMACION", label: "Cremacion N1 · Role-Play Asesor" },
  { secretName: "ELEVENLABS_AGENT_COACH_NIVEL2_CREMACION", label: "Cremacion N2 · Coach (Objeciones)" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_CLIENTE_NIVEL2_CREMACION", label: "Cremacion N2 · Role-Play Cliente (Objeciones)" },
  { secretName: "ELEVENLABS_AGENT_ROLEPLAY_ASESOR_NIVEL2_CREMACION", label: "Cremacion N2 · Role-Play Asesor (Objeciones)" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_PAREJA", label: "Prospeccion: Pareja en Caja" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_FRUTAS", label: "Prospeccion: Frutas y Verduras" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_NEUMATICOS", label: "Prospeccion: Neumaticos" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_RESTAURANTE", label: "Prospeccion: Restaurante" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_PARQUEO", label: "Prospeccion: Parqueo" },
  { secretName: "ELEVENLABS_AGENT_FAMILIA", label: "Prospeccion: Familia en Stand" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_CAMINANDO", label: "Prospeccion: Profesional Caminando" },
  { secretName: "ELEVENLABS_AGENT_STAND1", label: "Prospeccion: Senora Compras Stand 1" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_CEMENTERIO", label: "Prospeccion: Pareja en Cementerio" },
  { secretName: "ELEVENLABS_AGENT_PROSPECCION_FISICA", label: "Prospeccion Fisica" },
  { secretName: "ELEVENLABS_AGENT_LEGADO_VIDA", label: "Legado de Vida" },
  { secretName: "ELEVENLABS_AGENT_EXAMEN_FINAL", label: "Examen Final" },
];

export default function AgentConfigPanel() {
  const { configs, isLoading, saveConfig, deleteConfig } = useAgentConfigs();
  const { toast } = useToast();

  // País cuyos agentes se están editando. El default muestra los secret names
  // base; los demás, los mismos agentes con sufijo (_MX, ...).
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY_CODE);
  const isDefaultCountry = country === DEFAULT_COUNTRY_CODE;

  // Merge known agents with DB configs
  const [rows, setRows] = useState<Record<string, { agentId: string; label: string; dbId?: string }>>({});
  const [apiKeyRow, setApiKeyRow] = useState<{ value: string; dbId?: string }>({ value: "" });
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const merged: typeof rows = {};
    // Start with known agents (secret name según el país seleccionado)
    for (const known of KNOWN_AGENTS) {
      merged[secretNameForCountry(known.secretName, country)] = { agentId: "", label: known.label, dbId: undefined };
    }
    // Override with DB values — sólo las del país seleccionado. Las filas con
    // sufijo de otro país se muestran al cambiar el selector.
    for (const cfg of configs) {
      if (cfg.secretName === API_KEY_CONFIG.secretName) {
        setApiKeyRow({ value: cfg.agentId, dbId: cfg.id });
        continue;
      }
      const parts = splitSecretName(cfg.secretName);
      if (parts.country !== country) continue;
      const knownLabel = KNOWN_AGENTS.find((k) => k.secretName === parts.base)?.label;
      merged[cfg.secretName] = {
        agentId: cfg.agentId,
        label: cfg.label || knownLabel || merged[cfg.secretName]?.label || cfg.secretName,
        dbId: cfg.id,
      };
    }
    setRows(merged);
  }, [configs, country]);

  const configuredCount = Object.values(rows).filter((r) => r.dbId).length;

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">País</span>
          </div>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="h-9 w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                  {c.code === DEFAULT_COUNTRY_CODE ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-[10px] w-fit">
            {configuredCount} configurado{configuredCount === 1 ? "" : "s"}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {isDefaultCountry
            ? "Agentes base: los usan todos los usuarios cuyo país no tiene su propio agente configurado."
            : `Agentes para usuarios cuya sede es de ${COUNTRIES.find((c) => c.code === country)?.name ?? country}. Si un agente queda vacío, esos usuarios usan el agente base (${COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY_CODE)?.name}). Los prompts override del panel de prospección se configuran aparte por país (secret name con sufijo _${country}).`}
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
