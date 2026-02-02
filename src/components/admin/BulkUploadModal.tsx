import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Upload, FileText, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedUser {
  email: string;
  password: string;
  fullName?: string;
}

interface UploadResult {
  email: string;
  success: boolean;
  error?: string;
}

export default function BulkUploadModal({
  open,
  onOpenChange,
  onSuccess,
}: BulkUploadModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "results">("upload");

  const resetState = () => {
    setParsedUsers([]);
    setUploadResults([]);
    setStep("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const parseCSV = (content: string): ParsedUser[] => {
    const lines = content.split("\n").filter((line) => line.trim());
    const users: ParsedUser[] = [];

    // Skip header if it looks like one
    const startIndex = lines[0]?.toLowerCase().includes("email") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle both comma and semicolon separators
      const separator = line.includes(";") ? ";" : ",";
      const parts = line.split(separator).map((p) => p.trim().replace(/^["']|["']$/g, ""));

      if (parts.length >= 2) {
        users.push({
          email: parts[0],
          password: parts[1],
          fullName: parts[2] || undefined,
        });
      }
    }

    return users;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const users = parseCSV(content);

      if (users.length === 0) {
        toast({
          title: "Error",
          description: "No se encontraron usuarios válidos en el archivo",
          variant: "destructive",
        });
        return;
      }

      if (users.length > 100) {
        toast({
          title: "Error",
          description: "Máximo 100 usuarios por archivo",
          variant: "destructive",
        });
        return;
      }

      setParsedUsers(users);
      setStep("preview");
    };

    reader.readAsText(file);
  };

  const handleUpload = async () => {
    setIsUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=bulk-create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ users: parsedUsers }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear usuarios");
      }

      setUploadResults(result.results);
      setStep("results");

      toast({
        title: "Proceso completado",
        description: `${result.summary.created} usuarios creados, ${result.summary.failed} errores`,
      });

      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "email,password,nombre_completo\nusuario1@ejemplo.com,password123,Juan Pérez\nusuario2@ejemplo.com,password456,María García";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_usuarios.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Carga Masiva de Usuarios</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con los usuarios a crear
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-6">
            <Alert className="mb-4">
              <FileText className="h-4 w-4" />
              <AlertDescription>
                El archivo CSV debe tener las columnas: <strong>email, password, nombre_completo</strong> (nombre es opcional)
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed border-border rounded-lg">
              <Upload className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Arrastra un archivo CSV aquí o haz clic para seleccionar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Seleccionar Archivo
                </Button>
                <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Plantilla
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {parsedUsers.length} usuarios encontrados
              </p>
              <Button variant="ghost" size="sm" onClick={resetState}>
                Cambiar archivo
              </Button>
            </div>

            <ScrollArea className="h-[300px] border border-border rounded-lg">
              <div className="p-4 space-y-2">
                {parsedUsers.map((user, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-md"
                  >
                    <div>
                      <p className="font-medium text-foreground">{user.email}</p>
                      {user.fullName && (
                        <p className="text-sm text-muted-foreground">{user.fullName}</p>
                      )}
                    </div>
                    <Badge variant="secondary">Pendiente</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando usuarios...
                  </>
                ) : (
                  `Crear ${parsedUsers.length} usuarios`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "results" && (
          <div className="py-4">
            <div className="flex items-center gap-4 mb-4">
              <Badge variant="default" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                {uploadResults.filter((r) => r.success).length} creados
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                {uploadResults.filter((r) => !r.success).length} errores
              </Badge>
            </div>

            <ScrollArea className="h-[300px] border border-border rounded-lg">
              <div className="p-4 space-y-2">
                {uploadResults.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-md ${
                      result.success ? "bg-primary/10" : "bg-destructive/10"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-foreground">{result.email}</p>
                      {result.error && (
                        <p className="text-sm text-destructive">{result.error}</p>
                      )}
                    </div>
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button onClick={() => handleOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
