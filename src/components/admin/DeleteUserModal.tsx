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
import { api } from "@/lib/api-client";

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
      await api.delete(`/api/admin/users/${student.id}`);

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
