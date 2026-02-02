import { useState } from "react";
import { Student } from "@/hooks/useStudents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GradeModalProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (grade: number, notes?: string) => Promise<boolean>;
}

export default function GradeModal({
  student,
  open,
  onOpenChange,
  onSubmit,
}: GradeModalProps) {
  const { toast } = useToast();
  const [grade, setGrade] = useState<string>(student?.finalGrade?.toString() || "");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && student) {
      setGrade(student.finalGrade?.toString() || "");
      setNotes("");
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100) {
      toast({
        title: "Error",
        description: "La nota debe ser un número entre 0 y 100",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const success = await onSubmit(gradeValue, notes);
    setIsSubmitting(false);

    if (success) {
      toast({
        title: "Nota asignada",
        description: `Se ha asignado la nota ${gradeValue} a ${student?.full_name || student?.email}`,
      });
    } else {
      toast({
        title: "Error",
        description: "No se pudo asignar la nota. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar Nota Final</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium text-foreground">
              {student.full_name || "Sin nombre"}
            </p>
            <p className="text-sm text-muted-foreground">{student.email}</p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 bg-card border border-border rounded-md">
              <p className="text-muted-foreground">Sesiones</p>
              <p className="font-semibold text-foreground">{student.totalSessions}</p>
            </div>
            <div className="p-2 bg-card border border-border rounded-md">
              <p className="text-muted-foreground">Promedio IA</p>
              <p className="font-semibold text-foreground">
                {student.averageScore !== null
                  ? `${Math.round(student.averageScore)}%`
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade">Nota Final (0-100)</Label>
            <Input
              id="grade"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Ingresa la nota final"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observaciones (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agrega comentarios sobre el desempeño del estudiante..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !grade}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Nota"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
