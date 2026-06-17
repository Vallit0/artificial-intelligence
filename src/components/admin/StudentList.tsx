import { useMemo, useState } from "react";
import { Student } from "@/hooks/useStudents";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Coach, coachDisplayName } from "@/hooks/useCoaches";
import { Award, Check, ChevronDown, ChevronUp, Clock, Eye, FileText, KeyRound, Lock, Pencil, Trash2, Unlock, UserCog, UserPen } from "lucide-react";
import StudentDetailModal from "./StudentDetailModal";
import GradeModal from "./GradeModal";
import CertificateModal from "./CertificateModal";
import DeleteUserModal from "./DeleteUserModal";
import EditNameModal from "./EditNameModal";
import EditUserModal from "./EditUserModal";
import ResetStudentPasswordModal from "./ResetStudentPasswordModal";
import { useToast } from "@/hooks/use-toast";
import { UpdateUserPatch } from "@/hooks/useStudents";

interface StudentListProps {
  students: Student[];
  onAssignGrade: (userId: string, grade: number, notes?: string) => Promise<boolean>;
  onToggleExamenFinal: (userId: string, enabled: boolean) => Promise<boolean>;
  onBulkToggleExamenFinal: (userIds: string[], enabled: boolean) => Promise<number | null>;
  onRefetch: () => Promise<void>;
  coaches: Coach[];
  canAssignCoach: boolean;
  onAssignCoach: (userId: string, coachId: string | null) => Promise<boolean>;
  // Edición unificada (admin global). Si no se provee, se cae al editor de
  // nombre simple (que también pueden usar los coaches).
  canEditUser?: boolean;
  onUpdateUser?: (userId: string, patch: UpdateUserPatch) => Promise<boolean>;
}

const NO_COACH = "__none__";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export default function StudentList({ students, onAssignGrade, onToggleExamenFinal, onBulkToggleExamenFinal, onRefetch, coaches, canAssignCoach, onAssignCoach, canEditUser, onUpdateUser }: StudentListProps) {
  const { toast } = useToast();
  const [assigningCoachId, setAssigningCoachId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [gradeStudent, setGradeStudent] = useState<Student | null>(null);
  const [certificateStudent, setCertificateStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [editNameStudent, setEditNameStudent] = useState<Student | null>(null);
  const [editUserStudent, setEditUserStudent] = useState<Student | null>(null);
  const [resetPasswordStudent, setResetPasswordStudent] = useState<Student | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "sessions" | "grade">("sessions");
  const [sortAsc, setSortAsc] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [togglingExamenId, setTogglingExamenId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulk = async (enabled: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkPending(true);
    const count = await onBulkToggleExamenFinal(ids, enabled);
    setBulkPending(false);
    if (count === null) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el examen final para los seleccionados.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: enabled ? "Examen habilitado" : "Examen deshabilitado",
      description: `${count} estudiante${count === 1 ? "" : "s"} actualizado${count === 1 ? "" : "s"}.`,
    });
    setSelectedIds(new Set());
  };

  const handleApprove = async (student: Student) => {
    setApprovingId(student.id);
    const success = await onAssignGrade(student.id, 100, "Aprobado manualmente por el administrador");
    setApprovingId(null);
    
    if (success) {
      toast({
        title: "Estudiante aprobado",
        description: `${[student.first_name, student.last_name].filter(Boolean).join(' ') || student.email} ha sido dado de alta exitosamente.`,
      });
    } else {
      toast({
        title: "Error",
        description: "No se pudo aprobar al estudiante. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleCoachChange = async (student: Student, value: string) => {
    const coachId = value === NO_COACH ? null : value;
    if (coachId === (student.coachId ?? null)) return;
    setAssigningCoachId(student.id);
    const ok = await onAssignCoach(student.id, coachId);
    setAssigningCoachId(null);
    toast(
      ok
        ? {
            title: "Coach actualizado",
            description: coachId
              ? "Se asignó el coach al estudiante."
              : "Se quitó el coach del estudiante.",
          }
        : {
            title: "Error",
            description: "No se pudo actualizar el coach.",
            variant: "destructive",
          },
    );
  };

  const renderCoachCell = (student: Student) => {
    if (!canAssignCoach) {
      return <span className="text-sm text-muted-foreground">{student.coachName ?? "—"}</span>;
    }
    const sedeCoaches = coaches.filter((c) => c.sede?.id && c.sede.id === student.sedeId);
    // Si el coach actual no está en la lista filtrada (lista aún cargando, o
    // dato inconsistente), lo agregamos como opción para no perder el valor.
    const currentMissing =
      !!student.coachId && !sedeCoaches.some((c) => c.id === student.coachId);
    return (
      <Select
        value={student.coachId ?? NO_COACH}
        onValueChange={(v) => handleCoachChange(student, v)}
        disabled={assigningCoachId === student.id || !student.sedeId}
      >
        <SelectTrigger className="h-8 w-[160px] mx-auto text-xs">
          <SelectValue placeholder="Sin coach" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_COACH}>Sin coach</SelectItem>
          {currentMissing && student.coachId && (
            <SelectItem value={student.coachId}>{student.coachName ?? "Coach actual"}</SelectItem>
          )}
          {sedeCoaches.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {coachDisplayName(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const handleSort = (column: "name" | "sessions" | "grade") => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(false);
    }
  };

  const visibleIds = useMemo(() => students.map((s) => s.id), [students]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) visibleIds.forEach((id) => next.add(id));
      else visibleIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const sortedStudents = [...students].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "name":
        comparison = ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || "").localeCompare(
          [b.first_name, b.last_name].filter(Boolean).join(' ') || b.email || ""
        );
        break;
      case "sessions":
        comparison = a.totalSessions - b.totalSessions;
        break;
      case "grade":
        comparison = (a.finalGrade || 0) - (b.finalGrade || 0);
        break;
    }
    return sortAsc ? comparison : -comparison;
  });

  const SortIcon = ({ column }: { column: "name" | "sessions" | "grade" }) => {
    if (sortBy !== column) return null;
    return sortAsc ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p>No hay estudiantes registrados</p>
      </div>
    );
  }

  const selectionCount = selectedIds.size;

  return (
    <>
      {selectionCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-muted/60 border border-border rounded-lg px-4 py-3 mb-3">
          <div className="text-sm">
            <span className="font-semibold">{selectionCount}</span> estudiante{selectionCount === 1 ? "" : "s"} seleccionado{selectionCount === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              disabled={bulkPending}
              onClick={() => handleBulk(true)}
              className="gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              Habilitar examen ({selectionCount})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkPending}
              onClick={() => handleBulk(false)}
              className="gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Deshabilitar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={bulkPending}
              onClick={() => setSelectedIds(new Set())}
            >
              Limpiar
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                onCheckedChange={(v) => toggleAllVisible(!!v)}
                aria-label="Seleccionar todos"
              />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("name")}
            >
              Estudiante <SortIcon column="name" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground text-center"
              onClick={() => handleSort("sessions")}
            >
              Sesiones <SortIcon column="sessions" />
            </TableHead>
            <TableHead className="text-center">Coach</TableHead>
            <TableHead className="text-center">Tiempo Total</TableHead>
            <TableHead className="text-center">Examen Final</TableHead>
            <TableHead className="text-center">Nivel</TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground text-center"
              onClick={() => handleSort("grade")}
            >
              Nota Final <SortIcon column="grade" />
            </TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedStudents.map((student) => (
            <TableRow key={student.id} data-state={selectedIds.has(student.id) ? "selected" : undefined}>
              <TableCell className="w-10">
                <Checkbox
                  checked={selectedIds.has(student.id)}
                  onCheckedChange={(v) => toggleOne(student.id, !!v)}
                  aria-label={`Seleccionar ${student.email ?? student.id}`}
                />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">
                    {[student.first_name, student.last_name].filter(Boolean).join(' ') || "Sin nombre"}
                  </p>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary">{student.totalSessions}</Badge>
              </TableCell>
              <TableCell className="text-center">{renderCoachCell(student)}</TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {formatDuration(student.totalDuration)}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant={student.examenFinalEnabled ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  disabled={togglingExamenId === student.id}
                  onClick={async () => {
                    setTogglingExamenId(student.id);
                    await onToggleExamenFinal(student.id, !student.examenFinalEnabled);
                    setTogglingExamenId(null);
                  }}
                >
                  {student.examenFinalEnabled ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Habilitado
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Bloqueado
                    </>
                  )}
                </Button>
              </TableCell>
              <TableCell className="text-center">
                {/* Read-only — el ascenso a Nivel 2 solo se logra aprobando
                    el examen final con 50+ puntos. Sin override manual. */}
                <Badge variant={student.level2Unlocked ? "default" : "secondary"} className="font-medium">
                  {student.level2Unlocked ? "Nivel 2" : "Nivel 1"}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                {student.finalGrade !== null ? (
                  <Badge
                    variant={student.finalGrade >= 70 ? "default" : "secondary"}
                    className="font-bold"
                  >
                    {student.finalGrade}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">Sin calificar</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedStudent(student)}
                    title="Ver detalle"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {canEditUser && onUpdateUser ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditUserStudent(student)}
                      title="Editar usuario"
                    >
                      <UserCog className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditNameStudent(student)}
                      title="Editar nombre"
                    >
                      <UserPen className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setResetPasswordStudent(student)}
                    title="Resetear contraseña"
                  >
                    <KeyRound className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setGradeStudent(student)}
                    title="Editar calificación"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteStudent(student)}
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {student.finalGrade !== null ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCertificateStudent(student)}
                    >
                      <Award className="w-4 h-4 mr-1" />
                      Certificado
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(student)}
                      disabled={approvingId === student.id}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      {approvingId === student.id ? "Aprobando..." : "Dar de Alta"}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Modals */}
      <StudentDetailModal
        student={selectedStudent}
        open={!!selectedStudent}
        onOpenChange={(open) => !open && setSelectedStudent(null)}
      />

      <GradeModal
        student={gradeStudent}
        open={!!gradeStudent}
        onOpenChange={(open) => !open && setGradeStudent(null)}
        onSubmit={async (grade, notes) => {
          if (gradeStudent) {
            const success = await onAssignGrade(gradeStudent.id, grade, notes);
            if (success) {
              setGradeStudent(null);
            }
            return success;
          }
          return false;
        }}
      />

      <CertificateModal
        student={certificateStudent}
        open={!!certificateStudent}
        onOpenChange={(open) => !open && setCertificateStudent(null)}
      />

      <DeleteUserModal
        student={deleteStudent}
        open={!!deleteStudent}
        onOpenChange={(open) => !open && setDeleteStudent(null)}
        onSuccess={onRefetch}
      />

      <EditNameModal
        student={editNameStudent}
        open={!!editNameStudent}
        onOpenChange={(open) => !open && setEditNameStudent(null)}
        onSuccess={onRefetch}
      />

      {onUpdateUser && (
        <EditUserModal
          student={editUserStudent}
          open={!!editUserStudent}
          onOpenChange={(open) => !open && setEditUserStudent(null)}
          onSubmit={onUpdateUser}
        />
      )}

      <ResetStudentPasswordModal
        student={resetPasswordStudent}
        open={!!resetPasswordStudent}
        onOpenChange={(open) => !open && setResetPasswordStudent(null)}
      />
    </>
  );
}
