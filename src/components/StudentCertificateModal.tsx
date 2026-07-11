import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileImage, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlatformConfig } from "@/hooks/useAppConfig";
import CertificatePreview from "@/components/admin/CertificatePreview";

interface StudentCertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Nivel del certificado: 1 = Prospección, 2 = Objeciones (final).
  level: 1 | 2;
  studentName: string;
  grade: number;
}

// Vista de certificado para el ALUMNO (autocontenida). Reusa CertificatePreview
// —la misma fuente visual que usa el panel admin— más los datos parametrizables
// (nombres + firmas) y la descarga PNG/PDF. Separada de CertificateModal (admin)
// porque aquí no hay un objeto Student, sólo el nombre y la nota del propio
// usuario.
export default function StudentCertificateModal({
  open,
  onOpenChange,
  level,
  studentName,
  grade,
}: StudentCertificateModalProps) {
  const { toast } = useToast();
  const { config } = usePlatformConfig();
  const certificateRef = useRef<HTMLDivElement>(null);

  const instructorName = level === 1 ? config?.certificateLevel1InstructorName : config?.certificateInstructorName;
  const directorName = level === 1 ? config?.certificateLevel1DirectorName : config?.certificateDirectorName;
  const courseName = level === 1 ? config?.certificateLevel1CourseName : config?.certificateCourseName;
  const instructorSignature = level === 1 ? config?.certificateLevel1InstructorSignature : config?.certificateInstructorSignature;
  const directorSignature = level === 1 ? config?.certificateLevel1DirectorSignature : config?.certificateDirectorSignature;

  const safeName = studentName.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "estudiante";

  const download = async (kind: "png" | "pdf") => {
    if (!certificateRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      if (kind === "png") {
        const link = document.createElement("a");
        link.download = `certificado-nivel${level}-${safeName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [canvas.width / 2, canvas.height / 2],
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save(`certificado-nivel${level}-${safeName}.pdf`);
      }

      toast({ title: "Certificado descargado", description: `Se guardó como ${kind.toUpperCase()}.` });
    } catch (error) {
      console.error("Error downloading certificate:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo generar el certificado. Intenta de nuevo.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Mi Certificado — Nivel {level}
          </DialogTitle>
        </DialogHeader>

        {/* El nodo interno queda a 800px (para la captura html2canvas); en
            móvil se escala sólo la vista. */}
        <div className="overflow-hidden bg-muted p-4 rounded-lg flex justify-center">
          <div className="w-[336px] h-[238px] sm:w-[600px] sm:h-[425px] md:w-[800px] md:h-[566px]">
            <div className="origin-top-left scale-[0.42] sm:scale-[0.75] md:scale-100">
              <CertificatePreview
                ref={certificateRef}
                level={level}
                studentName={studentName}
                grade={grade}
                instructorName={instructorName}
                directorName={directorName}
                courseName={courseName}
                instructorSignature={instructorSignature}
                directorSignature={directorSignature}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button variant="secondary" onClick={() => download("png")}>
            <FileImage className="w-4 h-4 mr-2" />
            Descargar PNG
          </Button>
          <Button onClick={() => download("pdf")}>
            <FileText className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
