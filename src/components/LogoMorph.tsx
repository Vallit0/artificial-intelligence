import { cn } from "@/lib/utils";

interface LogoMorphProps {
  isMorphing: boolean;
  isConnecting: boolean;
  onClick: () => void;
}

const LogoMorph = ({ isMorphing, isConnecting, onClick }: LogoMorphProps) => {
  return (
    <button
      onClick={onClick}
      disabled={isConnecting || isMorphing}
      className="relative flex flex-col items-center justify-center group"
    >
      {/* Container for the logo */}
      <div className="relative w-64 h-80 flex flex-col items-center justify-center">
        {/* Circle - stays in place */}
        <div
          className={cn(
            "absolute rounded-full bg-secondary transition-all duration-[1500ms] ease-in-out",
            isMorphing
              ? "w-56 h-56 shadow-2xl"
              : "w-48 h-48 group-hover:scale-105 group-hover:shadow-lg"
          )}
          style={{ top: 0 }}
        />

        {/* Triangle - flies up when morphing */}
        <div
          className={cn(
            "absolute transition-all duration-[1500ms] ease-in-out",
            isMorphing
              ? "opacity-0 -translate-y-96"
              : "opacity-100 translate-y-0"
          )}
          style={{ top: "90px" }}
        >
          {/* Triangle SVG */}
          <svg
            width="160"
            height="140"
            viewBox="0 0 160 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-transform duration-300 group-hover:translate-y-1"
          >
            <path
              d="M80 0 L160 140 L0 140 Z"
              className="fill-accent"
            />
            {/* White border line at top of triangle */}
            <path
              d="M80 0 L25 100"
              stroke="hsl(var(--background))"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M80 0 L135 100"
              stroke="hsl(var(--background))"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Text - fades out when morphing */}
        <div
          className={cn(
            "absolute bottom-0 text-center transition-all duration-500",
            isMorphing ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          )}
        >
          <h1 className="text-lg font-semibold text-foreground mb-1">
            Práctica de Ventas
          </h1>
          <p className="text-sm text-muted-foreground">
            {isConnecting ? "Conectando..." : "Toca para iniciar"}
          </p>
        </div>
      </div>
    </button>
  );
};

export default LogoMorph;
