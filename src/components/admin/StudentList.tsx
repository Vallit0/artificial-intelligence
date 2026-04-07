import { useState } from "react";
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
import { Award, Check, ChevronDown, ChevronUp, Clock, Eye, FileText, GraduationCap, Lock, MessageCircle, Pencil, Trash2, Unlock } from "lucide-react";
import StudentDetailModal from "./StudentDetailModal";
import GradeModal from "./GradeModal";
import CertificateModal from "./CertificateModal";
import DeleteUserModal from "./DeleteUserModal";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";

interface StudentListProps {
  students: Student[];
  onAssignGrade: (userId: string, grade: number, notes?: string) => Promise<boolean>;
  onToggleExamenFinal: (userId: string, enabled: boolean) => Promise<boolean>;
  onRefetch: () => Promise<void>;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export default function StudentList({ students, onAssignGrade, onToggleExamenFinal, onRefetch }: StudentListProps) {
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [gradeStudent, setGradeStudent] = useState<Student | null>(null);
  const [certificateStudent, setCertificateStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "sessions" | "grade">("sessions");
  const [sortAsc, setSortAsc] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [togglingExamenId, setTogglingExamenId] = useState<string | null>(null);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);

  const handleSendTestWhatsApp = async (student: Student) => {
    if (!student.phoneNumber) {
      toast({
        title: "Sin WhatsApp",
        description: `${student.full_name || student.email} no tiene número de WhatsApp registrado.`,
        variant: "destructive",
      });
      return;
    }
    setSendingWhatsAppId(student.id);
    try {
      await api.post("/api/whatsapp/send-to-user", {
        userId: student.id,
        message: `Hola ${student.full_name || ""}! Este es un mensaje de prueba del Centro de Negocios Senoriales. Tu plataforma de entrenamiento esta activa.`,
      });
      toast({
        title: "Mensaje enviado",
        description: `WhatsApp enviado a ${student.full_name || student.email}.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje de WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setSendingWhatsAppId(null);
    }
  };

  const handleApprove = async (student: Student) => {
    setApprovingId(student.id);
    const success = await onAssignGrade(student.id, 100, "Aprobado manualmente por el administrador");
    setApprovingId(null);
    
    if (success) {
      toast({
        title: "Estudiante aprobado",
        description: `${student.full_name || student.email} ha sido dado de alta exitosamente.`,
      });
    } else {
      toast({
        title: "Error",
        description: "No se pudo aprobar al estudiante. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleSort = (column: "name" | "sessions" | "grade") => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(false);
    }
  };

  const sortedStudents = [...students].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "name":
        comparison = (a.full_name || a.email || "").localeCompare(
          b.full_name || b.email || ""
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
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
            <TableHead className="text-center">Tiempo Total</TableHead>
            <TableHead className="text-center">Promedio IA</TableHead>
            <TableHead className="text-center">Examen Final</TableHead>
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
            <TableRow key={student.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">
                    {student.full_name || "Sin nombre"}
                  </p>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary">{student.totalSessions}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {formatDuration(student.totalDuration)}
                </div>
              </TableCell>
              <TableCell className="text-center">
                {student.averageScore !== null ? (
                  <Badge
                    variant={student.averageScore >= 50 ? "default" : "destructive"}
                  >
                    {Math.round(student.averageScore)}%
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
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
                    className="h-8 w-8 text-green-600 hover:text-green-700"
                    onClick={() => handleSendTestWhatsApp(student)}
                    disabled={sendingWhatsAppId === student.id || !student.phoneNumber}
                    title={student.phoneNumber ? "Enviar WhatsApp de prueba" : "Sin número de WhatsApp"}
                  >
                    <MessageCircle className="w-4 h-4" />
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
    </>
  );
}
