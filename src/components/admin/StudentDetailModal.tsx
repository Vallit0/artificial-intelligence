import { Student } from "@/hooks/useStudents";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, CheckCircle, XCircle, MessageSquare } from "lucide-react";

interface StudentDetailModalProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

export default function StudentDetailModal({
  student,
  open,
  onOpenChange,
}: StudentDetailModalProps) {
  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {student.full_name || "Sin nombre"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 py-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-foreground">
              {student.totalSessions}
            </p>
            <p className="text-xs text-muted-foreground">Sesiones</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-foreground">
              {formatDuration(student.totalDuration)}
            </p>
            <p className="text-xs text-muted-foreground">Tiempo Total</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-foreground">
              {student.averageScore !== null
                ? `${Math.round(student.averageScore)}%`
                : "-"}
            </p>
            <p className="text-xs text-muted-foreground">Promedio IA</p>
          </div>
        </div>

        <Separator />

        {/* Session History */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">
            Historial de Sesiones
          </h3>
          <ScrollArea className="h-[300px]">
            {student.sessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay sesiones registradas
              </p>
            ) : (
              <div className="space-y-3 pr-4">
                {student.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {format(new Date(session.created_at), "PPp", {
                            locale: es,
                          })}
                        </span>
                      </div>
                      {session.passed !== null && (
                        session.passed ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Aprobado
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="w-3 h-3" />
                            No aprobado
                          </Badge>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(session.duration_seconds)}
                      </span>
                      {session.score !== null && (
                        <Badge variant="outline">
                          Puntuación: {session.score}%
                        </Badge>
                      )}
                    </div>

                    {session.ai_feedback && (
                      <div className="mt-2 p-3 bg-muted rounded-md">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {session.ai_feedback}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
