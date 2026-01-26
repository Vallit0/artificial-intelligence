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
      <header className="flex items-center justify-between px-6 py-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <img 
            src={logoSenoriales} 
            alt="Centro de Negocios Señoriales" 
            className="h-14 w-auto"
          />
          <span className="text-xl font-bold text-foreground">Centro de Negocios Señoriales</span>
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
          className="relative flex flex-col items-center justify-center group animate-fade-in"
        >
          {/* Container for the logo */}
          <div className="relative w-80 h-80 flex flex-col items-center justify-center">
            {/* Circle - turquoise */}
            <div
              className={cn(
                "absolute rounded-full bg-turquoise transition-all duration-300 ease-in-out",
                "w-48 h-48 top-4",
                isHovered && "scale-110 shadow-lg"
              )}
            />

            {/* Triangle */}
            <div
              className="absolute transition-all duration-300 ease-in-out"
              style={{ top: "70px" }}
            >
              <svg
                width="200"
                height="140"
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
                  className="fill-turquoise"
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
              <h2 
                className="text-2xl font-extrabold text-foreground mb-1"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                Álvaro
              </h2>
              <p className="text-sm font-semibold text-muted-foreground">
                Tu coach personal de ventas
              </p>
            </div>
          </div>
        </button>

        {/* CTA Buttons - Duolingo style */}
        <div className="flex flex-col gap-3 w-full max-w-xs mt-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Button
            onClick={handleStartPractice}
            className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-wider shadow-[0_4px_0_0_hsl(var(--primary)/0.4)] hover:shadow-[0_2px_0_0_hsl(var(--primary)/0.4)] hover:translate-y-[2px] transition-all"
          >
            Empezar Ahora
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/auth")}
            className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-wider border-2 border-border shadow-[0_4px_0_0_hsl(var(--border))] hover:shadow-[0_2px_0_0_hsl(var(--border))] hover:translate-y-[2px] transition-all"
          >
            Ya Tengo Una Cuenta
          </Button>
        </div>

        {/* Free tier notice */}
        <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <p className="text-sm font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              3 minutos gratis para probar
            </span>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Landing;
