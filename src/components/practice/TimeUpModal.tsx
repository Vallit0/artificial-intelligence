import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TimeUpModalProps {
  open: boolean;
  characterName: string;
}

export const TimeUpModal = ({ open, characterName }: TimeUpModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl">¡Tiempo agotado!</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Tu sesión de 3 minutos con {characterName} ha terminado.
            <br />
            <span className="text-foreground font-medium">
              Crea una cuenta gratis para continuar practicando sin límites.
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-3 sm:flex-col mt-4">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => navigate("/auth?mode=signup")}
          >
            <Crown className="h-4 w-4" />
            Crear cuenta gratis
          </Button>
          <Button
            variant="ghost"
            className="w-full gap-2"
            onClick={() => navigate("/")}
          >
            <Home className="h-4 w-4" />
            Volver al inicio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
