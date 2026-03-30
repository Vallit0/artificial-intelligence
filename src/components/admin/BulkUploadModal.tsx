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
import { 
  CheckCircle, 
  XCircle, 
  Upload, 
  FileText, 
  Loader2, 
  Download, 
  AlertCircle,
  RefreshCw 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedUser {
  email: string;
  password: string;
  fullName?: string;
  validationError?: string;
}

interface UploadResult {
  email: string;
  success: boolean;
  error?: string;
}

// Email validation regex
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

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
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resetState = () => {
    setParsedUsers([]);
    setUploadResults([]);
    setStep("upload");
    setParseError(null);
    setUploadError(null);
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

  const validateUser = (user: ParsedUser): string | undefined => {
    if (!user.email || !user.email.trim()) {
      return "Email vacío";
    }
    if (!isValidEmail(user.email.trim())) {
      return "Email inválido";
    }
    if (!user.password || user.password.length < 6) {
      return "Contraseña debe tener 6+ caracteres";
    }
    return undefined;
  };

  const parseCSV = (content: string): ParsedUser[] => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    const users: ParsedUser[] = [];

    if (lines.length === 0) {
      throw new Error("El archivo está vacío");
    }

    // Detect header row
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes("email") || firstLine.includes("correo");
    const startIndex = hasHeader ? 1 : 0;

    if (startIndex >= lines.length) {
      throw new Error("No se encontraron datos después del encabezado");
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle both comma and semicolon separators
      const separator = line.includes(";") ? ";" : ",";
      const parts = line.split(separator).map((p) => 
        p.trim().replace(/^["']|["']$/g, "")
      );

      if (parts.length >= 2) {
        const user: ParsedUser = {
          email: parts[0].toLowerCase(),
          password: parts[1],
          fullName: parts[2] || undefined,
        };
        user.validationError = validateUser(user);
        users.push(user);
      } else if (parts.length === 1 && parts[0]) {
        users.push({
          email: parts[0],
          password: "",
          validationError: "Falta la contraseña",
        });
      }
    }

    return users;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);

    // Validate file type
    const validTypes = [".csv", ".txt"];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!validTypes.includes(fileExtension)) {
      setParseError("Solo se aceptan archivos CSV o TXT");
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      setParseError("El archivo es demasiado grande (máximo 1MB)");
      return;
    }

    const reader = new FileReader();
    
    reader.onerror = () => {
      setParseError("Error al leer el archivo");
    };

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const users = parseCSV(content);

        if (users.length === 0) {
          setParseError("No se encontraron usuarios válidos en el archivo");
          return;
        }

        if (users.length > 100) {
          setParseError("Máximo 100 usuarios por archivo. El archivo contiene " + users.length);
          return;
        }

        setParsedUsers(users);
        setStep("preview");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al procesar el archivo";
        setParseError(message);
      }
    };

    reader.readAsText(file);
  };

  const handleUpload = async () => {
    // Filter out users with validation errors
    const validUsers = parsedUsers.filter((u) => !u.validationError);
    
    if (validUsers.length === 0) {
      setUploadError("No hay usuarios válidos para crear");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await api.post<{
        success: boolean;
        summary: { total: number; created: number; failed: number };
        results: UploadResult[];
      }>("/api/admin/users/bulk", {
        users: validUsers.map((u) => ({
          email: u.email.trim(),
          password: u.password,
          fullName: u.fullName?.trim(),
        }))
      });

      // Combine results with validation errors
      const allResults: UploadResult[] = parsedUsers.map((user) => {
        if (user.validationError) {
          return { email: user.email, success: false, error: user.validationError };
        }
        const uploadResult = result.results?.find(
          (r: UploadResult) => r.email.toLowerCase() === user.email.toLowerCase()
        );
        return uploadResult || { email: user.email, success: false, error: "Sin respuesta" };
      });

      setUploadResults(allResults);
      setStep("results");

      const successCount = allResults.filter((r) => r.success).length;
      const failCount = allResults.filter((r) => !r.success).length;

      toast({
        title: "Proceso completado",
        description: `${successCount} usuarios creados, ${failCount} errores`,
      });

      if (successCount > 0) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error in bulk upload:", error);
      const message = error instanceof Error ? error.message : "Error de conexión";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "email,password,nombre_completo\nusuario1@ejemplo.com,password123,Juan Pérez\nusuario2@ejemplo.com,password456,María García";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_usuarios.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validCount = parsedUsers.filter((u) => !u.validationError).length;
  const invalidCount = parsedUsers.filter((u) => u.validationError).length;

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
                El archivo CSV debe tener las columnas: <strong>email, password, nombre_completo</strong> (nombre es opcional).
                Separador: coma (,) o punto y coma (;)
              </AlertDescription>
            </Alert>

            {parseError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

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
              <div className="flex items-center gap-2">
                <Badge variant="default">{validCount} válidos</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">{invalidCount} con errores</Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={resetState}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Cambiar archivo
              </Button>
            </div>

            {uploadError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            <ScrollArea className="h-[300px] border border-border rounded-lg">
              <div className="p-4 space-y-2">
                {parsedUsers.map((user, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-md ${
                      user.validationError ? "bg-destructive/10" : "bg-muted"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{user.email || "(vacío)"}</p>
                      {user.fullName && (
                        <p className="text-sm text-muted-foreground truncate">{user.fullName}</p>
                      )}
                      {user.validationError && (
                        <p className="text-sm text-destructive">{user.validationError}</p>
                      )}
                    </div>
                    {user.validationError ? (
                      <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    ) : (
                      <Badge variant="secondary">Listo</Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isUploading}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={isUploading || validCount === 0}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando usuarios...
                  </>
                ) : (
                  `Crear ${validCount} usuario${validCount !== 1 ? "s" : ""}`
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
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{result.email}</p>
                      {result.error && (
                        <p className="text-sm text-destructive">{result.error}</p>
                      )}
                    </div>
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={resetState}>
                Cargar otro archivo
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
