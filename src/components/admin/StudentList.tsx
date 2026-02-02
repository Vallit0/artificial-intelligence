import { useState } from "react";
import { Student } from "@/hooks/useStudents";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
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
import { Award, ChevronDown, ChevronUp, Clock, FileText } from "lucide-react";
import StudentDetailModal from "./StudentDetailModal";
import GradeModal from "./GradeModal";
import CertificateModal from "./CertificateModal";

interface StudentListProps {
  students: Student[];
  onAssignGrade: (userId: string, grade: number, notes?: string) => Promise<boolean>;
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

export default function StudentList({ students, onAssignGrade, onRefetch }: StudentListProps) {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [gradeStudent, setGradeStudent] = useState<Student | null>(null);
  const [certificateStudent, setCertificateStudent] = useState<Student | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "sessions" | "grade">("sessions");
  const [sortAsc, setSortAsc] = useState(false);

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
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStudent(student)}
                  >
                    Ver Detalle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGradeStudent(student)}
                  >
                    Calificar
                  </Button>
                  {student.finalGrade !== null && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCertificateStudent(student)}
                    >
                      <Award className="w-4 h-4 mr-1" />
                      Certificado
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
    </>
  );
}
