import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { AvatarCard } from "@/components/landing/AvatarCard";

export interface AICharacter {
  id: string;
  name: string;
  role: "client" | "coach";
  description: string;
  personality: string;
  voiceType: string;
  gradient: string;
}

const characters: AICharacter[] = [
  {
    id: "alvaro",
    name: "Álvaro",
    role: "coach",
    description: "Entrenador de ventas",
    personality: "Soy tu entrenador personal de ventas. Te daré feedback en tiempo real y consejos para mejorar tu técnica.",
    voiceType: "male",
    gradient: "from-primary/80 to-primary",
  },
  {
    id: "lea",
    name: "Lea",
    role: "client",
    description: "Cliente potencial",
    personality: "Soy una clienta interesada en servicios funerarios. Tengo dudas y objeciones típicas que deberás resolver.",
    voiceType: "female",
    gradient: "from-accent/80 to-accent",
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);

  const handleSelectCharacter = (characterId: string) => {
    setSelectedCharacter(characterId);
    // Navigate to practice with the selected character and free tier flag
    navigate(`/practice?character=${characterId}&tier=free`);
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
            Elige a tu compañero de práctica y mejora tus habilidades de venta con IA
          </p>
        </div>

        {/* Character Selection */}
        <div className="flex flex-col md:flex-row gap-8 items-center justify-center w-full max-w-3xl">
          {characters.map((character) => (
            <AvatarCard
              key={character.id}
              character={character}
              onSelect={() => handleSelectCharacter(character.id)}
            />
          ))}
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
              Crea una cuenta para más tiempo
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Landing;
