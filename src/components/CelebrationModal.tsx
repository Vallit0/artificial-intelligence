import { useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";

interface CelebrationModalProps {
  open: boolean;
  onClose: () => void;
}

const CelebrationModal = ({ open, onClose }: CelebrationModalProps) => {
  useEffect(() => {
    if (open) {
      // Fire confetti from both sides
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#C4B896", "#E6C84A", "#5A7A3B"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#C4B896", "#E6C84A", "#5A7A3B"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();

      // Big burst in the center
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#C4B896", "#E6C84A", "#5A7A3B"],
        });
      }, 500);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4 mx-auto">
            <Award className="w-10 h-10 text-primary" />
          </div>
          <DialogTitle className="text-2xl">¡Felicidades!</DialogTitle>
          <DialogDescription className="text-base">
            Has completado las 2 horas de práctica necesarias para tu
            certificación. ¡Excelente trabajo!
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6">
          <Button onClick={onClose} className="w-full">
            ¡Gracias!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CelebrationModal;
