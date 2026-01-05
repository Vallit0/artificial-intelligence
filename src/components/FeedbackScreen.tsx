import { useState } from "react";
import { Star, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeedbackScreenProps {
  agentName: string;
  onSubmit: (rating: number) => void;
  sessionDuration?: number;
}

const FeedbackScreen = ({ agentName, onSubmit, sessionDuration }: FeedbackScreenProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 animate-fade-in">
      <h1 className="text-2xl font-semibold text-primary mb-4">
        Gracias por hablar con {agentName}
      </h1>

      {sessionDuration !== undefined && sessionDuration > 0 && (
        <div className="flex items-center gap-2 text-muted-foreground mb-12">
          <Clock className="w-4 h-4" />
          <span>Duración: {formatDuration(sessionDuration)}</span>
        </div>
      )}

      <div className="bg-accent rounded-3xl p-12 w-full max-w-md">
        <h2 className="text-xl font-semibold text-foreground text-center mb-8">
          ¿Cómo fue tu conversación?
        </h2>

        <div className="flex justify-center gap-2 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "w-10 h-10 transition-colors",
                  (hoveredRating || rating) >= star
                    ? "fill-primary text-primary"
                    : "text-muted-foreground"
                )}
              />
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          {[1, 2, 3, 4, 5].map((num) => (
            <span key={num} className="w-10 text-center">
              {num}
            </span>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={rating === 0}
          className="w-full mt-8 rounded-full"
        >
          Enviar
        </Button>
      </div>
    </div>
  );
};

export default FeedbackScreen;
