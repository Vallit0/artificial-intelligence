import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, FlaskConical, Loader2 } from 'lucide-react';

interface VariantInput {
  name: string;
  systemPrompt: string;
  firstMessage: string;
  weight: number;
}

interface AbExperimentFormProps {
  onSubmit: (data: {
    name: string;
    description?: string;
    agentSecretName: string;
    variants: VariantInput[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function AbExperimentForm({ onSubmit, onCancel }: AbExperimentFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentSecretName, setAgentSecretName] = useState('');
  const [variants, setVariants] = useState<VariantInput[]>([
    { name: 'Control', systemPrompt: '', firstMessage: '', weight: 1 },
    { name: 'Variante B', systemPrompt: '', firstMessage: '', weight: 1 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addVariant = () => {
    setVariants([...variants, {
      name: `Variante ${String.fromCharCode(65 + variants.length)}`,
      systemPrompt: '',
      firstMessage: '',
      weight: 1,
    }]);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return;
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantInput, value: string | number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !agentSecretName.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        agentSecretName: agentSecretName.trim(),
        variants: variants.map(v => ({
          ...v,
          systemPrompt: v.systemPrompt || undefined,
          firstMessage: v.firstMessage || undefined,
        })) as any,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="w-4 h-4" />
          Nuevo Experimento A/B
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exp-name">Nombre del experimento</Label>
              <Input
                id="exp-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Test apertura directa vs empática"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-agent">Agent Secret Name</Label>
              <Input
                id="exp-agent"
                value={agentSecretName}
                onChange={e => setAgentSecretName(e.target.value)}
                placeholder="Ej: ELEVENLABS_AGENT_COACH"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-desc">Descripción (opcional)</Label>
            <Input
              id="exp-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Comparar prompt con tono más empático vs directo"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Variantes</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Agregar
              </Button>
            </div>

            {variants.map((variant, i) => (
              <Card key={i} className="bg-muted/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Input
                        value={variant.name}
                        onChange={e => updateVariant(i, 'name', e.target.value)}
                        className="w-40 h-8 text-sm"
                        placeholder="Nombre de variante"
                      />
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground">Peso:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={variant.weight}
                          onChange={e => updateVariant(i, 'weight', parseInt(e.target.value) || 1)}
                          className="w-16 h-8 text-sm"
                        />
                      </div>
                    </div>
                    {variants.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeVariant(i)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">System Prompt (override)</Label>
                    <Textarea
                      value={variant.systemPrompt}
                      onChange={e => updateVariant(i, 'systemPrompt', e.target.value)}
                      placeholder="Dejar vacío para usar el prompt por defecto del agente"
                      rows={3}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">First Message (override)</Label>
                    <Input
                      value={variant.firstMessage}
                      onChange={e => updateVariant(i, 'firstMessage', e.target.value)}
                      placeholder="Dejar vacío para usar el mensaje por defecto"
                      className="text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim() || !agentSecretName.trim()}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Experimento
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
