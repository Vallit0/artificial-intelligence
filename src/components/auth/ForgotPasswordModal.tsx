import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Status = "idle" | "loading" | "success" | "error";

export function ForgotPasswordModal({ open, onOpenChange }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setStatus("error");
      setErrorMessage("Por favor ingresa tu email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus("error");
      setErrorMessage("Por favor ingresa un email válido");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { email: email.trim().toLowerCase() },
      });

      if (error) {
        throw new Error(error.message || "Error al enviar solicitud");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatus("success");
    } catch (err) {
      console.error("Password reset error:", err);
      setStatus("error");
      
      if (err instanceof Error) {
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          setErrorMessage("Error de conexión. Verifica tu internet e intenta de nuevo.");
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Error inesperado. Intenta de nuevo más tarde.");
      }
    }
  };

  const handleClose = () => {
    setEmail("");
    setStatus("idle");
    setErrorMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Recuperar Contraseña
          </DialogTitle>
        </DialogHeader>

        {status === "success" ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">¡Revisa tu correo!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Si existe una cuenta con ese email, recibirás instrucciones para restablecer tu contraseña.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Entendido
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            {status === "error" && errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") {
                  setStatus("idle");
                  setErrorMessage("");
                }
              }}
              disabled={status === "loading"}
              className="h-12"
              autoFocus
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={status === "loading"}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={status === "loading" || !email.trim()}
                className="flex-1"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar enlace"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
