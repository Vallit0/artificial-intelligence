import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import {
  BuilderParams,
  PROSPECTING_PROMPT_PREFIX,
  RED_LINES,
  GLOBAL_LIMITS,
  AdvisorLevel,
  ChannelType,
} from "@/lib/prospectingPromptBuilder";

interface Props {
  value: BuilderParams;
  onChange: (next: BuilderParams) => void;
}

export default function ProspectingPromptBuilder({ value, onChange }: Props) {
  const [showPrefix, setShowPrefix] = useState(false);

  const patch = (mut: (draft: BuilderParams) => void) => {
    const next: BuilderParams = JSON.parse(JSON.stringify(value));
    mut(next);
    onChange(next);
  };

  const toggleCode = (list: "selected_red_lines" | "selected_global_limits", code: string, checked: boolean) => {
    patch((d) => {
      const set = new Set(d[list]);
      if (checked) set.add(code);
      else set.delete(code);
      d[list] = Array.from(set);
    });
  };

  return (
    <div className="space-y-5">
      {/* PREFIJO read-only */}
      <div className="rounded-lg border bg-muted/30">
        <button
          type="button"
          onClick={() => setShowPrefix((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted/50 rounded-t-lg"
        >
          {showPrefix ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          PREFIJO Señoriales (fijo, no editable)
        </button>
        {showPrefix && (
          <Textarea
            readOnly
            rows={14}
            value={PROSPECTING_PROMPT_PREFIX}
            className="text-[11px] font-mono bg-background rounded-t-none border-0 border-t resize-none"
          />
        )}
      </div>

      {/* 1) Identidad del agente */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 · Identidad del agente</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre del agente</Label>
            <Input
              value={value.agent_metadata.agent_name}
              onChange={(e) => patch((d) => (d.agent_metadata.agent_name = e.target.value))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Acento</Label>
            <Input
              value={value.agent_metadata.accent}
              onChange={(e) => patch((d) => (d.agent_metadata.accent = e.target.value))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Versión</Label>
            <Input
              value={value.agent_metadata.version}
              onChange={(e) => patch((d) => (d.agent_metadata.version = e.target.value))}
              className="text-sm"
            />
          </div>
        </div>
      </section>

      {/* 3) Escenario */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3 · Escenario</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Canal</Label>
            <Select
              value={value.scenario.channel_type}
              onValueChange={(v) => patch((d) => (d.scenario.channel_type = v as ChannelType))}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telefónico">Telefónico</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiqueta del canal</Label>
            <Input
              value={value.scenario.channel_label}
              placeholder='ej. "llamada en frío"'
              onChange={(e) => patch((d) => (d.scenario.channel_label = e.target.value))}
              className="text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Descripción de la escena</Label>
          <Textarea
            rows={3}
            value={value.scenario.scene_description}
            onChange={(e) => patch((d) => (d.scenario.scene_description = e.target.value))}
            className="text-sm"
          />
        </div>
      </section>

      {/* 4) Personaje */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">4 · Personaje (cliente)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre del personaje (opcional)</Label>
            <Input
              value={value.character.name_in_character ?? ""}
              placeholder="(anónimo)"
              onChange={(e) =>
                patch((d) => (d.character.name_in_character = e.target.value.trim() ? e.target.value : null))
              }
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rango de edad (opcional)</Label>
            <Input
              value={value.character.age_range ?? ""}
              placeholder='ej. "30-40 años"'
              onChange={(e) =>
                patch((d) => (d.character.age_range = e.target.value.trim() ? e.target.value : null))
              }
              className="text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rasgos de personalidad</Label>
          <Textarea
            rows={3}
            value={value.character.personality_traits}
            onChange={(e) => patch((d) => (d.character.personality_traits = e.target.value))}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estilo de habla</Label>
          <Textarea
            rows={2}
            value={value.character.speech_style}
            onChange={(e) => patch((d) => (d.character.speech_style = e.target.value))}
            className="text-sm"
          />
        </div>
      </section>

      {/* 7) Dificultad */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">7 · Dificultad y objeciones</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nivel del asesor</Label>
            <Select
              value={value.difficulty.advisor_level}
              onValueChange={(v) => patch((d) => (d.difficulty.advisor_level = v as AdvisorLevel))}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="principiante">Principiante</SelectItem>
                <SelectItem value="intermedio">Intermedio</SelectItem>
                <SelectItem value="experto">Experto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cantidad de objeciones</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={value.difficulty.objection_count}
              onChange={(e) =>
                patch((d) => (d.difficulty.objection_count = Math.max(0, Number(e.target.value) || 0)))
              }
              className="text-sm"
            />
          </div>
        </div>
      </section>

      {/* 9) Micro-clase */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">9 · Micro-clase pre-roleplay</h4>
        <div className="flex items-center justify-between rounded-md border p-3 bg-muted/20">
          <div>
            <p className="text-sm font-medium">Incluir micro-clase introductoria</p>
            <p className="text-[11px] text-muted-foreground">
              Antes del roleplay, el agente explica los pasos de prospección en 25–35 segundos.
            </p>
          </div>
          <Switch
            checked={value.intro_microclass.include}
            onCheckedChange={(v) => patch((d) => (d.intro_microclass.include = v))}
          />
        </div>
      </section>

      {/* 10) Líneas rojas */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">10 · Líneas rojas del escenario</h4>
        <div className="space-y-2">
          {RED_LINES.map((opt) => {
            const checked = value.selected_red_lines.includes(opt.code);
            return (
              <label
                key={opt.code}
                className="flex gap-2 items-start p-2 rounded-md border bg-background hover:bg-muted/40 cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleCode("selected_red_lines", opt.code, !!v)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* 13) Límites globales */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">13 · Límites globales del agente</h4>
        <div className="space-y-2">
          {GLOBAL_LIMITS.map((opt) => {
            const checked = value.selected_global_limits.includes(opt.code);
            return (
              <label
                key={opt.code}
                className="flex gap-2 items-start p-2 rounded-md border bg-background hover:bg-muted/40 cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleCode("selected_global_limits", opt.code, !!v)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
