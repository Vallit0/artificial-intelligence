import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TranscriptReplay } from './TranscriptReplay';
import { CompetencyRadar } from '@/components/analytics/CompetencyRadar';
import { useSessionTranscript } from '@/hooks/useSessionTranscript';
import { Clock, Calendar, Target } from 'lucide-react';

interface SessionReplayModalProps {
  sessionId: string | null;
  isAdmin?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionReplayModal({ sessionId, isAdmin = false, open, onOpenChange }: SessionReplayModalProps) {
  const { data, isLoading, error, fetchTranscript, clear } = useSessionTranscript();

  useEffect(() => {
    if (open && sessionId) {
      fetchTranscript(sessionId, isAdmin);
    }
    if (!open) {
      clear();
    }
  }, [open, sessionId, isAdmin, fetchTranscript, clear]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Replay de Sesión
            {data?.scenarioName && (
              <Badge variant="outline">{data.scenarioName}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        )}

        {error && (
          <div className="text-center text-destructive py-8">{error}</div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Session metadata */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {new Date(data.createdAt).toLocaleDateString('es-GT', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatDuration(data.durationSeconds)}
              </div>
              {data.score !== null && (
                <div className="flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  <span className={data.passed ? 'text-green-600' : 'text-red-600'}>
                    {data.score} pts {data.passed ? '(Aprobado)' : '(No aprobado)'}
                  </span>
                </div>
              )}
              {isAdmin && data.user && (
                <Badge variant="secondary">
                  {[data.user.firstName, data.user.lastName].filter(Boolean).join(' ') || data.user.email}
                </Badge>
              )}
            </div>

            {/* Main content: transcript + sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Transcript */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Conversación</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TranscriptReplay
                      messages={data.transcript || []}
                      strengths={data.summary?.strengths}
                      weaknesses={data.summary?.weaknesses}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar: breakdown + summary */}
              <div className="space-y-4">
                {data.breakdown && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Competencias</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CompetencyRadar
                        latest={{
                          apertura: data.breakdown.apertura,
                          escuchaActiva: data.breakdown.escuchaActiva,
                          manejoObjeciones: data.breakdown.manejoObjeciones,
                          propuestaValor: data.breakdown.propuestaValor,
                          cierre: data.breakdown.cierre,
                        }}
                        average={null}
                      />
                    </CardContent>
                  </Card>
                )}

                {data.summary && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Resumen</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="text-muted-foreground">{data.summary.summary}</p>

                      {data.summary.strengths.length > 0 && (
                        <div>
                          <p className="font-medium text-green-600 mb-1">Fortalezas</p>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            {data.summary.strengths.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}

                      {data.summary.weaknesses.length > 0 && (
                        <div>
                          <p className="font-medium text-red-600 mb-1">Áreas de mejora</p>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            {data.summary.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                      )}

                      {data.summary.recommendation && (
                        <div>
                          <p className="font-medium mb-1">Recomendación</p>
                          <p className="text-muted-foreground">{data.summary.recommendation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {data.aiFeedback && !data.summary && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Feedback</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{data.aiFeedback}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
