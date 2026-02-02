import { useState } from "react";
import { Student } from "@/hooks/useStudents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeleteUserModalProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function DeleteUserModal({
  student,
  open,
  onOpenChange,
  onSuccess,
}: DeleteUserModalProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!student) return;

    setIsDeleting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sesión expirada. Por favor, recarga la página.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: student.id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Tu sesión ha expirado. Por favor, recarga la página.");
        }
        if (response.status === 403) {
          throw new Error("No tienes permisos para eliminar usuarios");
        }
        if (response.status === 404) {
          // User already deleted - consider it success
          toast({
            title: "Usuario no encontrado",
            description: "El usuario ya fue eliminado",
          });
          onOpenChange(false);
          onSuccess();
          return;
        }
        throw new Error(result.error || "Error al eliminar usuario");
      }

      toast({
        title: "Usuario eliminado",
        description: `${student.full_name || student.email} ha sido eliminado`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error deleting user:", error);
      const message = error instanceof Error ? error.message : "Error de conexión";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
    }
    onOpenChange(newOpen);
  };

  if (!student) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará permanentemente a{" "}
            <strong>{student.full_name || student.email}</strong> y todos sus datos
            asociados. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} onClick={() => setError(null)}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              "Eliminar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
