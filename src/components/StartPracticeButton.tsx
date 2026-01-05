import { cn } from "@/lib/utils";

interface StartPracticeButtonProps {
  onClick: () => void;
  isConnecting: boolean;
  isMorphing: boolean;
}

const StartPracticeButton = ({
  onClick,
  isConnecting,
  isMorphing,
}: StartPracticeButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={isConnecting || isMorphing}
      className={cn(
        "bg-accent transition-all duration-700 ease-in-out flex items-center justify-center",
        isMorphing
          ? "w-56 h-56 rounded-full"
          : "w-80 h-48 rounded-3xl hover:scale-105"
      )}
    >
      {!isMorphing && (
        <div className="text-center animate-fade-in">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Práctica de Ventas
          </h1>
          <p className="text-sm text-muted-foreground">
            {isConnecting ? "Conectando..." : "Toca para iniciar"}
          </p>
        </div>
      )}
    </button>
  );
};

export default StartPracticeButton;
