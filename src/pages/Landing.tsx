import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const Landing = () => {
  const navigate = useNavigate();

  const handleStartPractice = () => {
    navigate("/practice?character=alvaro&tier=free");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-foreground">Señoriales</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/auth")}
          className="gap-2"
        >
          <LogIn className="h-4 w-4" />
          Iniciar Sesión
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Practica tus ventas
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Entrena con Álvaro, tu coach personal de ventas con IA
          </p>
        </div>

        {/* Álvaro Coach Card */}
        <div
          className="relative group cursor-pointer"
          onClick={handleStartPractice}
        >
          {/* Glow effect */}
          <div
            className={cn(
              "absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/50 opacity-0 blur-xl transition-opacity duration-500",
              "group-hover:opacity-30"
            )}
          />

          {/* Card */}
          <div
            className={cn(
              "relative flex flex-col items-center p-10 rounded-3xl border border-border bg-card/50 backdrop-blur-sm transition-all duration-300",
              "hover:border-primary/50 hover:shadow-lg hover:-translate-y-1",
              "w-[320px]"
            )}
          >
            {/* Avatar Orb */}
            <div
              className={cn(
                "w-36 h-36 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center mb-6 transition-transform duration-300",
                "group-hover:scale-110"
              )}
            >
              <span className="text-5xl font-bold text-primary-foreground">
                Á
              </span>
            </div>

            {/* Name */}
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Álvaro
            </h2>

            {/* Role badge */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
              <GraduationCap className="h-4 w-4" />
              <span>Tu coach personal de ventas</span>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground text-center mb-6">
              Te daré feedback en tiempo real y consejos para mejorar tu técnica de ventas.
            </p>

            {/* CTA Button */}
            <Button className="w-full" size="lg">
              Empezar a practicar
            </Button>
          </div>
        </div>

        {/* Free tier notice */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              3 minutos gratis
            </span>
            {" · "}
            <button
              onClick={() => navigate("/auth?mode=signup")}
              className="text-primary hover:underline"
            >
              Crea una cuenta para acceso completo
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Landing;
