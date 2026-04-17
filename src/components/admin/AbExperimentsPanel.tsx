import { useState } from 'react';
import { useAbExperiments, type AbExperiment, type ExperimentResults } from '@/hooks/useAbExperiments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Play, Square, BarChart3, FlaskConical, AlertTriangle } from 'lucide-react';
import { AbExperimentForm } from './AbExperimentForm';
import { AbExperimentResults } from './AbExperimentResults';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  active: { label: 'Activo', variant: 'default' },
  completed: { label: 'Completado', variant: 'outline' },
};

export default function AbExperimentsPanel() {
  const { experiments, isLoading, createExperiment, updateExperiment, deleteExperiment, getResults } = useAbExperiments();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedResults, setSelectedResults] = useState<ExperimentResults | null>(null);
  const [loadingResults, setLoadingResults] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleViewResults = async (id: string) => {
    setLoadingResults(id);
    try {
      const results = await getResults(id);
      setSelectedResults(results);
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoadingResults(null);
    }
  };

  const handleStatusChange = async (exp: AbExperiment, newStatus: 'active' | 'completed') => {
    await updateExperiment(exp.id, { status: newStatus });
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteExperiment(deleteTarget);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedResults) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedResults(null)}>
          Volver a experimentos
        </Button>
        <AbExperimentResults results={selectedResults} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            Experimentos A/B
          </h3>
          <p className="text-sm text-muted-foreground">
            Compara variantes de prompts para optimizar el entrenamiento
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Experimento
        </Button>
      </div>

      {showCreateForm && (
        <AbExperimentForm
          onSubmit={async (data) => {
            await createExperiment(data);
            setShowCreateForm(false);
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {experiments.length === 0 && !showCreateForm ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay experimentos creados. Crea uno para comparar variantes de prompts.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {experiments.map((exp) => {
            const statusConfig = STATUS_LABELS[exp.status];
            return (
              <Card key={exp.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{exp.name}</h4>
                        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                      </div>
                      {exp.description && (
                        <p className="text-sm text-muted-foreground">{exp.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Agente: <code className="bg-muted px-1 rounded">{exp.agentSecretName}</code></span>
                        <span>{exp.variants.length} variantes</span>
                        {exp._count && <span>{exp._count.assignments} asignaciones</span>}
                      </div>
                      <div className="flex gap-1 mt-2">
                        {exp.variants.map(v => (
                          <Badge key={v.id} variant="outline" className="text-xs">
                            {v.name} (peso: {v.weight})
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {exp.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(exp, 'active')}
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          Activar
                        </Button>
                      )}
                      {exp.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(exp, 'completed')}
                        >
                          <Square className="w-3.5 h-3.5 mr-1" />
                          Finalizar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewResults(exp.id)}
                        disabled={loadingResults === exp.id}
                      >
                        {loadingResults === exp.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <BarChart3 className="w-3.5 h-3.5 mr-1" />
                        )}
                        Resultados
                      </Button>
                      {exp.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(exp.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Eliminar experimento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el experimento, todas sus variantes y asignaciones. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
