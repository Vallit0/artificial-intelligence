import { useState, useRef } from "react";
import * as XLSX from "xlsx";
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
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { useSedes } from "@/hooks/useSedes";
import { useDivisions } from "@/hooks/useDivisions";
import { countryLabel } from "@/lib/countries";

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type BulkRole = "learner" | "coach" | "admin";

interface ParsedUser {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: BulkRole;
  sede?: string;
  division?: string;
  validationError?: string;
}

interface UploadResult {
  email: string;
  success: boolean;
  error?: string;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Normaliza un encabezado o valor: minúsculas, sin acentos ni espacios extra.
// Permite que el admin escriba "Teléfono", "telefono" o "TELEFONO" indistinto.
const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

// Encabezado del Excel → campo de ParsedUser. Acepta sinónimos comunes en
// español e inglés.
const HEADER_ALIASES: Record<string, keyof ParsedUser> = {
  email: "email",
  correo: "email",
  password: "password",
  contrasena: "password",
  clave: "password",
  nombre: "firstName",
  firstname: "firstName",
  apellido: "lastName",
  apellidos: "lastName",
  lastname: "lastName",
  telefono: "phoneNumber",
  celular: "phoneNumber",
  phone: "phoneNumber",
  rol: "role",
  role: "role",
  sede: "sede",
  division: "division",
};

// Valor de la columna "rol" → rol interno. Acepta sinónimos en español.
const roleFromLabel = (raw?: string): BulkRole | undefined => {
  if (!raw) return undefined;
  const v = normalize(raw);
  if (["learner", "asesor", "estudiante", "alumno"].includes(v)) return "learner";
  if (v === "coach") return "coach";
  if (["admin", "administrador"].includes(v)) return "admin";
  return undefined; // desconocido → se marca como error de validación
};

const ROLE_LABEL: Record<BulkRole, string> = {
  learner: "Asesor",
  coach: "Coach",
  admin: "Admin",
};

export default function BulkUploadModal({
  open,
  onOpenChange,
  onSuccess,
}: BulkUploadModalProps) {
  const { toast } = useToast();
  const { sedes } = useSedes();
  const { divisions } = useDivisions();
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

  const validateUser = (user: ParsedUser, rawRole?: string): string | undefined => {
    if (!user.email || !user.email.trim()) return "Email vacío";
    if (!isValidEmail(user.email.trim())) return "Email inválido";
    if (!user.password || user.password.length < 8) return "Contraseña debe tener 8+ caracteres";
    if (!user.sede || !user.sede.trim()) return "Falta la sede";
    if (rawRole && !user.role) return `Rol desconocido: "${rawRole}"`;
    return undefined;
  };

  // Convierte la matriz de la hoja (fila 0 = encabezados) en usuarios.
  const rowsToUsers = (rows: string[][]): ParsedUser[] => {
    if (rows.length === 0) throw new Error("El archivo está vacío");

    // Mapea cada columna (por su encabezado) al campo correspondiente.
    const headers = rows[0].map((h) => HEADER_ALIASES[normalize(String(h ?? ""))]);
    if (!headers.includes("email")) {
      throw new Error('No se encontró la columna "email" en el encabezado');
    }

    const users: ParsedUser[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;

      const user: ParsedUser = { email: "", password: "" };
      let rawRole: string | undefined;
      headers.forEach((field, col) => {
        if (!field) return;
        const value = String(row[col] ?? "").trim();
        if (field === "role") {
          rawRole = value || undefined;
          user.role = roleFromLabel(value);
        } else if (field === "email") {
          user.email = value.toLowerCase();
        } else {
          (user as Record<string, string>)[field] = value;
        }
      });

      user.validationError = validateUser(user, rawRole);
      users.push(user);
    }
    return users;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);

    const validTypes = [".xlsx", ".xls", ".csv", ".txt"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!validTypes.includes(ext)) {
      setParseError("Formatos aceptados: Excel (.xlsx, .xls) o CSV (.csv)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setParseError("El archivo es demasiado grande (máximo 2MB)");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setParseError("Error al leer el archivo");
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // header:1 → matriz de filas; defval:"" para no perder celdas vacías.
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        const users = rowsToUsers(rows);
        if (users.length === 0) {
          setParseError("No se encontraron filas de usuarios en el archivo");
          return;
        }
        if (users.length > 100) {
          setParseError(`Máximo 100 usuarios por archivo. El archivo contiene ${users.length}`);
          return;
        }
        setParsedUsers(users);
        setStep("preview");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al procesar el archivo";
        setParseError(message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUpload = async () => {
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
          firstName: u.firstName?.trim() || undefined,
          lastName: u.lastName?.trim() || undefined,
          phoneNumber: u.phoneNumber?.trim() || undefined,
          role: u.role || undefined,
          sede: u.sede?.trim() || undefined,
          // El backend resuelve la división por nombre dentro de la sede.
          divisionId: u.division?.trim() || undefined,
        })),
      });

      // Combina la respuesta del server con los errores de validación locales.
      const allResults: UploadResult[] = parsedUsers.map((user) => {
        if (user.validationError) {
          return { email: user.email, success: false, error: user.validationError };
        }
        const uploadResult = result.results?.find(
          (r) => r.email.toLowerCase() === user.email.toLowerCase(),
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
      if (successCount > 0) onSuccess();
    } catch (error) {
      console.error("Error in bulk upload:", error);
      const message = error instanceof Error ? error.message : "Error de conexión";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  // Genera una plantilla .xlsx con dos hojas: "Usuarios" (a llenar) y
  // "Referencia" (sedes y divisiones válidas, para copiar los nombres exactos).
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const usuarios = [
      ["email", "password", "nombre", "apellido", "telefono", "rol", "sede", "division"],
      ["asesor1@ejemplo.com", "password123", "Juan", "Pérez", "50212345678", "Asesor", sedes[0]?.name ?? "Nombre de la sede", divisions[0]?.name ?? ""],
      ["coach1@ejemplo.com", "password123", "María", "García", "50298765432", "Coach", sedes[0]?.name ?? "Nombre de la sede", ""],
    ];
    const wsUsuarios = XLSX.utils.aoa_to_sheet(usuarios);
    wsUsuarios["!cols"] = [
      { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsUsuarios, "Usuarios");

    // Hoja de referencia: sedes activas y divisiones por sede.
    const activeSedes = sedes.filter((s) => s.isActive);
    const ref: string[][] = [
      ["Rol (valores válidos)", "Asesor / Coach / Admin", "", ""],
      [],
      ["Sede", "País", "Divisiones de la sede", ""],
    ];
    for (const s of activeSedes) {
      const sedeDivisions = divisions
        .filter((d) => d.sede?.id === s.id && d.isActive)
        .map((d) => d.name);
      ref.push([
        s.name,
        s.country ? countryLabel(s.country) : "",
        sedeDivisions.length ? sedeDivisions.join(", ") : "(sin divisiones)",
        "",
      ]);
    }
    const wsRef = XLSX.utils.aoa_to_sheet(ref);
    wsRef["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 40 }, { wch: 4 }];
    XLSX.utils.book_append_sheet(wb, wsRef, "Referencia");

    XLSX.writeFile(wb, "plantilla_usuarios.xlsx");
  };

  const validCount = parsedUsers.filter((u) => !u.validationError).length;
  const invalidCount = parsedUsers.filter((u) => u.validationError).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Carga Masiva de Usuarios</DialogTitle>
          <DialogDescription>
            Descargá la plantilla Excel, llenala y subila para crear usuarios en lote
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-6">
            <Alert className="mb-4">
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Columnas: <strong>email, password, nombre, apellido, telefono, rol, sede, division</strong>.
                <br />
                Obligatorias: <strong>email, password, sede</strong>. La contraseña va en su columna (mínimo 8
                caracteres). La hoja <strong>Referencia</strong> de la plantilla lista las sedes y divisiones válidas.
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
                Seleccioná un archivo Excel (.xlsx) o CSV
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="excel-upload"
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
                      <p className="text-sm text-muted-foreground truncate">
                        {[
                          [user.firstName, user.lastName].filter(Boolean).join(" "),
                          user.role ? ROLE_LABEL[user.role] : null,
                          user.sede,
                          user.division,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
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
