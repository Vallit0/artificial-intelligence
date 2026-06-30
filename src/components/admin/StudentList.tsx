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
import { type Division } from "@/hooks/useDivisions";
import { Award, Check, ChevronDown, ChevronUp, Clock, Eye, FileText, KeyRound, Lock, Pencil, Unlock, UserCog, UserPen } from "lucide-react";
import StudentDetailModal from "./StudentDetailModal";
import GradeModal from "./GradeModal";
import CertificateModal from "./CertificateModal";
import EditNameModal from "./EditNameModal";
import EditUserModal from "./EditUserModal";
import ResetStudentPasswordModal from "./ResetStudentPasswordModal";
import { useToast } from "@/hooks/use-toast";
import { UpdateUserPatch, type ExamKind } from "@/hooks/useStudents";

interface StudentListProps {
  students: Student[];
  onAssignGrade: (userId: string, grade: number, notes?: string) => Promise<boolean>;
  onToggleExamen: (userId: string, exam: ExamKind, enabled: boolean) => Promise<boolean>;
  onBulkToggleExamen: (userIds: string[], exam: ExamKind, enabled: boolean) => Promise<number | null>;
  onRefetch: () => Promise<void>;
  divisions: Division[];
  canAssignDivision: boolean;
  onAssignDivision: (userId: string, divisionId: string | null) => Promise<boolean>;
  // Para acotar quién puede habilitar exámenes: el admin puede sobre cualquiera;
  // un coach SÓLO sobre sus estudiantes asignados (student.coachId === currentUserId).
  isAdmin: boolean;
  currentUserId: string;
  // Edición unificada (admin global). Si no se provee, se cae al editor de
  // nombre simple (que también pueden usar los coaches).
  canEditUser?: boolean;
  onUpdateUser?: (userId: string, patch: UpdateUserPatch) => Promise<boolean>;
}

const NO_DIVISION = "__none__";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export default function StudentList({ students, onAssignGrade, onToggleExamen, onBulkToggleExamen, onRefetch, divisions, canAssignDivision, onAssignDivision, isAdmin, currentUserId, canEditUser, onUpdateUser }: StudentListProps) {
  const { toast } = useToast();
  const [assigningDivisionId, setAssigningDivisionId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [gradeStudent, setGradeStudent] = useState<Student | null>(null);
  const [certificate, setCertificate] = useState<{ student: Student; level: 1 | 2 } | null>(null);
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

  const EXAM_LABEL: Record<ExamKind, string> = {
    prospeccion: "Prospección",
    objeciones: "Objeciones",
  };

  const handleBulk = async (exam: ExamKind, enabled: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkPending(true);
    const count = await onBulkToggleExamen(ids, exam, enabled);
    setBulkPending(false);
    if (count === null) {
      toast({
        title: "Error",
        description: `No se pudo actualizar el examen de ${EXAM_LABEL[exam]} para los seleccionados.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: `Examen ${EXAM_LABEL[exam]} ${enabled ? "habilitado" : "deshabilitado"}`,
      description:
        count === 0
          ? "Ningún estudiante actualizado (sólo podés habilitar exámenes a tus estudiantes asignados)."
          : `${count} estudiante${count === 1 ? "" : "s"} actualizado${count === 1 ? "" : "s"}.`,
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

  const handleDivisionChange = async (student: Student, value: string) => {
    const divisionId = value === NO_DIVISION ? null : value;
    if (divisionId === (student.divisionId ?? null)) return;
    setAssigningDivisionId(student.id);
    const ok = await onAssignDivision(student.id, divisionId);
    setAssigningDivisionId(null);
    toast(
      ok
        ? {
            title: "División actualizada",
            description: divisionId
              ? "Se asignó la división (y su coach) al estudiante."
              : "Se quitó la división del estudiante.",
          }
        : {
            title: "Error",
            description: "No se pudo actualizar la división.",
            variant: "destructive",
          },
    );
  };

  const renderDivisionCell = (student: Student) => {
    if (!canAssignDivision) {
      return <span className="text-sm text-muted-foreground">{student.divisionName ?? "—"}</span>;
    }
    const sedeDivisions = divisions.filter((d) => d.sede?.id && d.sede.id === student.sedeId);
    // Si la división actual no está en la lista filtrada (lista aún cargando,
    // inactiva, o dato inconsistente), la agregamos para no perder el valor.
    const currentMissing =
      !!student.divisionId && !sedeDivisions.some((d) => d.id === student.divisionId);
    return (
      <Select
        value={student.divisionId ?? NO_DIVISION}
        onValueChange={(v) => handleDivisionChange(student, v)}
        disabled={assigningDivisionId === student.id || !student.sedeId}
      >
        <SelectTrigger className="h-8 w-[160px] mx-auto text-xs">
          <SelectValue placeholder="Sin división" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_DIVISION}>Sin división</SelectItem>
          {currentMissing && student.divisionId && (
            <SelectItem value={student.divisionId}>
              {student.divisionName ?? "División actual"}
            </SelectItem>
          )}
          {sedeDivisions.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
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
        <div className="flex flex-col gap-3 bg-muted/60 border border-border rounded-lg px-4 py-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <span className="font-semibold">{selectionCount}</span> estudiante{selectionCount === 1 ? "" : "s"} seleccionado{selectionCount === 1 ? "" : "s"}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {(["prospeccion", "objeciones"] as ExamKind[]).map((exam) => (
              <div key={exam} className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{EXAM_LABEL[exam]}:</span>
                <Button
                  size="sm"
                  variant="default"
                  disabled={bulkPending}
                  onClick={() => handleBulk(exam, true)}
                  className="gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Habilitar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkPending}
                  onClick={() => handleBulk(exam, false)}
                  className="gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Deshabilitar
                </Button>
              </div>
            ))}
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
            <TableHead className="text-center">División</TableHead>
            <TableHead className="text-center">Tiempo Total</TableHead>
            <TableHead className="text-center">Exámenes</TableHead>
            <TableHead className="text-center">Nivel</TableHead>
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
              <TableCell className="text-center">{renderDivisionCell(student)}</TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {formatDuration(student.totalDuration)}
                </div>
              </TableCell>
              <TableCell className="text-center">
                {(() => {
                  // Coach: sólo puede habilitar exámenes a SUS estudiantes asignados.
                  const canToggle = isAdmin || student.coachId === currentUserId;
                  const exams: { exam: ExamKind; label: string; enabled: boolean }[] = [
                    { exam: "prospeccion", label: "Prospección", enabled: student.examenFinalEnabled },
                    { exam: "objeciones", label: "Objeciones", enabled: student.examenObjecionesEnabled },
                  ];
                  return (
                    <div className="flex flex-col items-stretch gap-1">
                      {exams.map(({ exam, label, enabled }) => {
                        const key = `${student.id}:${exam}`;
                        return (
                          <Button
                            key={exam}
                            variant={enabled ? "default" : "outline"}
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            disabled={!canToggle || togglingExamenId === key}
                            title={
                              canToggle
                                ? `${enabled ? "Deshabilitar" : "Habilitar"} examen de ${label}`
                                : "Sólo podés habilitar exámenes a tus estudiantes asignados"
                            }
                            onClick={async () => {
                              setTogglingExamenId(key);
                              await onToggleExamen(student.id, exam, !enabled);
                              setTogglingExamenId(null);
                            }}
                          >
                            {enabled ? (
                              <Unlock className="w-3 h-3" />
                            ) : (
                              <Lock className="w-3 h-3" />
                            )}
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell className="text-center">
                {/* Read-only — refleja si el alumno aprobó el examen de
                    Prospección. Ambos módulos están abiertos para todos. */}
                <Badge variant={student.level2Unlocked ? "default" : "secondary"} className="font-medium">
                  {student.level2Unlocked ? "Objeciones" : "Prospección"}
                </Badge>
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
                  {/* Certificados por nivel: disponibles automáticamente al
                      aprobar cada examen (N1 = Prospección, N2 = Objeciones). */}
                  {student.level2Unlocked && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCertificate({ student, level: 1 })}
                      title="Certificado de Nivel 1 (Prospección)"
                    >
                      <Award className="w-4 h-4 mr-1" />
                      Cert. N1
                    </Button>
                  )}
                  {student.courseCompleted && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCertificate({ student, level: 2 })}
                      title="Certificado de Nivel 2 (Manejo de Objeciones)"
                    >
                      <Award className="w-4 h-4 mr-1" />
                      Cert. N2
                    </Button>
                  )}
                  {student.finalGrade === null && (
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
        student={certificate?.student ?? null}
        level={certificate?.level ?? 2}
        open={!!certificate}
        onOpenChange={(open) => !open && setCertificate(null)}
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
