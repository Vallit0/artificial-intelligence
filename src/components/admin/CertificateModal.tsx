import { useRef } from "react";
import { Student } from "@/hooks/useStudents";
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
import CertificatePreview from "./CertificatePreview";

interface CertificateModalProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CertificateModal({
  student,
  open,
  onOpenChange,
}: CertificateModalProps) {
  const { toast } = useToast();
  const certificateRef = useRef<HTMLDivElement>(null);

  const downloadAsImage = async () => {
    if (!certificateRef.current || !student) return;

    try {
      // Dynamic import for html2canvas
      const html2canvas = (await import("html2canvas")).default;
      
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = `certificado-${[student.first_name, student.last_name].filter(Boolean).join(' ') || "estudiante"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({
        title: "Certificado descargado",
        description: "El certificado se ha guardado como imagen PNG",
      });
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "Error",
        description: "No se pudo generar la imagen del certificado",
        variant: "destructive",
      });
    }
  };

  const downloadAsPDF = async () => {
    if (!certificateRef.current || !student) return;

    try {
      // Dynamic imports
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width / 2, canvas.height / 2],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`certificado-${[student.first_name, student.last_name].filter(Boolean).join(' ') || "estudiante"}.pdf`);

      toast({
        title: "Certificado descargado",
        description: "El certificado se ha guardado como PDF",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF del certificado",
        variant: "destructive",
      });
    }
  };

  if (!student || student.finalGrade === null) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Generar Certificado
          </DialogTitle>
        </DialogHeader>

        {/* Certificate Preview */}
        <div className="overflow-auto bg-muted p-4 rounded-lg">
          <CertificatePreview
            ref={certificateRef}
            studentName={[student.first_name, student.last_name].filter(Boolean).join(' ') || student.email || "Estudiante"}
            grade={student.finalGrade}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button variant="secondary" onClick={downloadAsImage}>
            <FileImage className="w-4 h-4 mr-2" />
            Descargar PNG
          </Button>
          <Button onClick={downloadAsPDF}>
            <FileText className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
