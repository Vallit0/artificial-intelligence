import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Save, Target, Users as UsersIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useProspectingScenarioConfigs,
  useUserScenarioAccess,
} from "@/hooks/useProspectingScenarios";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";
import { useStudents } from "@/hooks/useStudents";

// Known prospecting scenarios (keep in sync with ProspectingCarousel.tsx)
const SCENARIOS: Array<{ secretName: string; label: string }> = [
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_PAREJA", label: "Pareja en la Fila de Caja" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_FRUTAS", label: "Señora en Frutas y Verduras" },
  { secretName: "ELEVENLABS_AGENT_FAMILIA", label: "Familia en Stand" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_NEUMATICOS", label: "Señor en Neumáticos" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_RESTAURANTE", label: "Profesional en Restaurante" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_PARQUEO", label: "Señor en el Parqueo" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_CAMINANDO", label: "Profesional Caminando" },
  { secretName: "ELEVENLABS_AGENT_STAND1", label: "Señora de Compras (Stand 1)" },
  { secretName: "ELEVENLABS_AGENT_STAND2", label: "Señora de Compras (Stand 2)" },
  { secretName: "ELEVENLABS_AGENT_PROSPECTING_CEMENTERIO", label: "Pareja en Cementerio" },
];

interface RowState {
  systemPrompt: string;
  firstMessage: string;
  isActiveGlobal: boolean;
  agentId: string;
}

export default function ProspectingScenariosPanel() {
  const { configs, isLoading, saveConfig } = useProspectingScenarioConfigs();
  const { configs: agentConfigs, saveConfig: saveAgentConfig } = useAgentConfigs();
  const { students, isLoading: studentsLoading } = useStudents();
  const { toast } = useToast();

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const agentMap = new Map(agentConfigs.map((c) => [c.secretName, c.agentId]));
    const merged: Record<string, RowState> = {};
    for (const s of SCENARIOS) {
      merged[s.secretName] = {
        systemPrompt: "",
        firstMessage: "",
        isActiveGlobal: true,
        agentId: agentMap.get(s.secretName) || "",
      };
    }
    for (const cfg of configs) {
      merged[cfg.secretName] = {
        systemPrompt: cfg.systemPrompt || "",
        firstMessage: cfg.firstMessage || "",
        isActiveGlobal: cfg.isActiveGlobal,
        agentId: agentMap.get(cfg.secretName) || "",
      };
    }
    setRows(merged);
  }, [configs, agentConfigs]);

  const updateRow = (secretName: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [secretName]: { ...prev[secretName], ...patch } }));
  };

  const handleSave = async (secretName: string) => {
    const row = rows[secretName];
    const label = SCENARIOS.find((s) => s.secretName === secretName)?.label;
    setSavingKey(secretName);

    const trimmedAgentId = row.agentId.trim();
    const previousAgentId = agentConfigs.find((c) => c.secretName === secretName)?.agentId || "";
    const agentChanged = trimmedAgentId !== previousAgentId;

    const [okScenario, okAgent] = await Promise.all([
      saveConfig(secretName, {
        label,
        systemPrompt: row.systemPrompt,
        firstMessage: row.firstMessage,
        isActiveGlobal: row.isActiveGlobal,
      }),
      agentChanged && trimmedAgentId
        ? saveAgentConfig(secretName, trimmedAgentId, label)
        : Promise.resolve(true),
    ]);
    setSavingKey(null);

    const ok = okScenario && okAgent;
    if (ok) toast({ title: "Guardado", description: `${label} actualizado.` });
    else toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Escenarios de Prospección
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configura los prompts inyectados vía SDK y la visibilidad por usuario.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="prompts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="access">Accesos por Usuario</TabsTrigger>
          </TabsList>

          <TabsContent value="prompts" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              SCENARIOS.map((s) => {
                const row = rows[s.secretName] || { systemPrompt: "", firstMessage: "", isActiveGlobal: true, agentId: "" };
                const agentConfigured = !!agentConfigs.find((c) => c.secretName === s.secretName)?.agentId;
                return (
                  <div key={s.secretName} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">{s.label}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{s.secretName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`active-${s.secretName}`} className="text-xs">Visible global</Label>
                        <Switch
                          id={`active-${s.secretName}`}
                          checked={row.isActiveGlobal}
                          onCheckedChange={(v) => updateRow(s.secretName, { isActiveGlobal: v })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Agent ID (override)</Label>
                        {agentConfigured && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Check className="w-3 h-3 mr-0.5" /> En DB
                          </Badge>
                        )}
                      </div>
                      <Input
                        placeholder="agent_xxxxxxxxxx (dejar vacío para usar la variable de entorno)"
                        value={row.agentId}
                        onChange={(e) => updateRow(s.secretName, { agentId: e.target.value })}
                        className="text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">System Prompt (override)</Label>
                      <Textarea
                        rows={5}
                        placeholder="Dejar vacío para usar el prompt configurado en ElevenLabs"
                        value={row.systemPrompt}
                        onChange={(e) => updateRow(s.secretName, { systemPrompt: e.target.value })}
                        className="text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">First Message (override)</Label>
                      <Input
                        placeholder="Dejar vacío para usar el mensaje por defecto"
                        value={row.firstMessage}
                        onChange={(e) => updateRow(s.secretName, { firstMessage: e.target.value })}
                        className="text-sm"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSave(s.secretName)}
                        disabled={savingKey === s.secretName}
                      >
                        {savingKey === s.secretName ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Guardar
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="access">
            <UserAccessMatrix students={students} studentsLoading={studentsLoading} configs={configs} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface UserAccessMatrixProps {
  students: ReturnType<typeof useStudents>["students"];
  studentsLoading: boolean;
  configs: Array<{ secretName: string; isActiveGlobal: boolean }>;
}

function UserAccessMatrix({ students, studentsLoading, configs }: UserAccessMatrixProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { access, isLoading, saveAccess } = useUserScenarioAccess(selectedUserId);
  const { toast } = useToast();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const globalMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of configs) m.set(c.secretName, c.isActiveGlobal);
    return m;
  }, [configs]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    const accessMap = new Map(access.map((a) => [a.secretName, a.enabled]));
    for (const s of SCENARIOS) {
      if (accessMap.has(s.secretName)) {
        initial[s.secretName] = accessMap.get(s.secretName)!;
      } else {
        initial[s.secretName] = globalMap.get(s.secretName) ?? true;
      }
    }
    setPending(initial);
  }, [access, globalMap]);

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    const entries = SCENARIOS.map((s) => ({ secretName: s.secretName, enabled: !!pending[s.secretName] }));
    const ok = await saveAccess(entries);
    setSaving(false);
    if (ok) toast({ title: "Guardado", description: "Accesos actualizados." });
    else toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <UsersIcon className="w-4 h-4 text-muted-foreground" />
        <Select value={selectedUserId ?? ""} onValueChange={(v) => setSelectedUserId(v || null)}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder={studentsLoading ? "Cargando..." : "Selecciona un usuario"} />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {[s.first_name, s.last_name].filter(Boolean).join(" ") || s.email || s.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedUserId && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {SCENARIOS.map((s) => (
                <div
                  key={s.secretName}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 border"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{s.secretName}</p>
                  </div>
                  <Switch
                    checked={!!pending[s.secretName]}
                    onCheckedChange={(v) => setPending((prev) => ({ ...prev, [s.secretName]: v }))}
                  />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar accesos
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
