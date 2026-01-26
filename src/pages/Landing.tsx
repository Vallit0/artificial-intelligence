import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import logoSenoriales from "@/assets/logo-senoriales.png";

const Landing = () => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const handleStartPractice = () => {
    navigate("/practice?character=alvaro&tier=free");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img 
            src={logoSenoriales} 
            alt="Centro de Negocios Señoriales" 
            className="h-10 w-auto"
          />
          <span className="font-semibold text-foreground">Centro de Negocios Señoriales</span>
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
        {/* Logo Morph Style Button */}
        <button
          onClick={handleStartPractice}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative flex flex-col items-center justify-center group"
        >
          {/* Container for the logo */}
          <div className="relative w-64 h-80 flex flex-col items-center justify-center">
            {/* Circle - accent green */}
            <div
              className={cn(
                "absolute rounded-full bg-accent transition-all duration-300 ease-in-out",
                "w-44 h-44 top-8",
                isHovered && "scale-105 shadow-lg"
              )}
            />

            {/* Triangle */}
            <div
              className="absolute transition-all duration-300 ease-in-out"
              style={{ top: "80px" }}
            >
              <svg
                width="180"
                height="130"
                viewBox="0 0 180 130"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={cn(
                  "transition-transform duration-300",
                  isHovered && "translate-y-1"
                )}
              >
                <path
                  d="M90 10 L175 125 L5 125 Z"
                  className="fill-accent"
                />
                <path
                  d="M90 10 L5 125"
                  stroke="hsl(var(--background))"
                  strokeWidth="6"
                />
                <path
                  d="M90 10 L175 125"
                  stroke="hsl(var(--background))"
                  strokeWidth="6"
                />
              </svg>
            </div>

            {/* Text below logo */}
            <div className="absolute bottom-0 text-center">
              <h1 className="text-lg font-semibold text-foreground mb-1">
                Álvaro
              </h1>
              <p className="text-sm text-muted-foreground">
                Tu coach personal de ventas
              </p>
            </div>
          </div>
        </button>

        {/* Description */}
        <p className="text-center text-muted-foreground max-w-sm mt-4 mb-8">
          Te daré feedback en tiempo real y consejos para mejorar tu técnica de ventas.
        </p>

        {/* CTA Button */}
        <Button size="lg" onClick={handleStartPractice}>
          Habla con Álvaro
        </Button>

        {/* Free tier notice */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              3 minutos gratis
            </span>
          </p>
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="text-sm text-primary hover:underline mt-2"
          >
            Crea una cuenta para acceso completo
          </button>
        </div>
      </main>
    </div>
  );
};

export default Landing;
