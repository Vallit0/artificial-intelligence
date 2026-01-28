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
      {/* Container for the logo - responsive sizing */}
      <div className="relative w-48 h-60 sm:w-56 sm:h-72 md:w-64 md:h-80 flex flex-col items-center justify-center">
        {/* Circle - turquoise, stays in place */}
        <div
          className={cn(
            "absolute rounded-full bg-turquoise transition-all duration-[1500ms] ease-in-out",
            isMorphing
              ? "w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56 shadow-2xl top-0"
              : "w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 top-6 sm:top-8 group-hover:scale-105 group-hover:shadow-lg"
          )}
        />

        {/* Triangle - turquoise, flies up when morphing */}
        <div
          className={cn(
            "absolute transition-all duration-[1500ms] ease-in-out",
            isMorphing
              ? "opacity-0 -translate-y-96"
              : "opacity-100 translate-y-0"
          )}
          style={{ top: "60px" }}
        >
          {/* Triangle SVG - matching the reference logo style, responsive */}
          <svg
            viewBox="0 0 180 130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-32 h-24 sm:w-40 sm:h-28 md:w-[180px] md:h-[130px] transition-transform duration-300 group-hover:translate-y-1"
          >
            {/* Main triangle body */}
            <path
              d="M90 10 L175 125 L5 125 Z"
              className="fill-turquoise"
            />
            {/* White diagonal lines from peak to corners */}
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

        {/* Text - fades out when morphing */}
        <div
          className={cn(
            "absolute bottom-0 text-center transition-all duration-500",
            isMorphing ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          )}
        >
          <h1 className="text-base sm:text-lg font-semibold text-foreground mb-1">
            Práctica de Ventas
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isConnecting ? "Conectando..." : "Toca para iniciar"}
          </p>
        </div>
      </div>
    </button>
  );
};

export default LogoMorph;
