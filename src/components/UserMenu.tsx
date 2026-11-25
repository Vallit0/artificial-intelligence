import { useState } from "react";
import { KeyRound, LogOut, BarChart3, UserPen } from "lucide-react";
import { useLevelMode } from "@/hooks/useLevelMode";
import { CremacionIcon } from "@/lib/cremacion-theme";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangeMyPasswordModal } from "@/components/auth/ChangeMyPasswordModal";
import { EditMyNameModal } from "@/components/auth/EditMyNameModal";

const UserMenu = () => {
  const { user, roles, signOut } = useAuth();
  const { setTrack, resetReveal } = useLevelMode();
  const navigate = useNavigate();

  // Reactiva la bienvenida de Cremación (borra "No mostrar de nuevo") y la
  // reproduce ya, encendiendo la pista si hacía falta.
  const handleReplayCremacionIntro = () => {
    setTrack("cremacion");
    resetReveal();
  };
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);

  // Sólo admin/coach pueden auto-editar su nombre (el de los learners lo
  // administra el admin porque sale en los certificados). Espeja el check del
  // backend en PATCH /auth/me.
  const canEditOwnName = roles.includes("admin") || roles.includes("coach");
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getInitial = () => {
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full w-10 h-10 bg-primary/20 hover:bg-primary/30"
          >
            <span className="text-sm font-semibold text-primary">
              {getInitial()}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-foreground truncate">{fullName || "Mi Cuenta"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/progress")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Ver mi progreso
          </DropdownMenuItem>
          {canEditOwnName && (
            <DropdownMenuItem onClick={() => setNameModalOpen(true)}>
              <UserPen className="mr-2 h-4 w-4" />
              {fullName ? "Editar mi nombre" : "Poner mi nombre"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setPasswordModalOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Cambiar contraseña
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleReplayCremacionIntro}>
            <CremacionIcon className="mr-2 h-4 w-4 text-orange-500" />
            Ver bienvenida de Cremación
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangeMyPasswordModal
        open={passwordModalOpen}
        onOpenChange={setPasswordModalOpen}
      />
      <EditMyNameModal open={nameModalOpen} onOpenChange={setNameModalOpen} />
    </>
  );
};

export default UserMenu;
