import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PracticeTimer from "@/components/PracticeTimer";
import UserMenu from "@/components/UserMenu";
import CelebrationModal from "@/components/CelebrationModal";
import { Button } from "@/components/ui/button";
import { Award, Clock, TrendingUp, ArrowLeft } from "lucide-react";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const TARGET_TIME = 7200; // 2 hours in seconds

const Progress = () => {
  const navigate = useNavigate();
  const { sessions, totalPracticeTime, isLoading } = usePracticeSessions();
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSeenCelebration, setHasSeenCelebration] = useState(false);

  // Check if user has reached the target
  useEffect(() => {
    if (totalPracticeTime >= TARGET_TIME && !hasSeenCelebration && !isLoading) {
      const celebrated = localStorage.getItem("certification_celebrated");
      if (!celebrated) {
        setShowCelebration(true);
        setHasSeenCelebration(true);
        localStorage.setItem("certification_celebrated", "true");
      }
    }
  }, [totalPracticeTime, hasSeenCelebration, isLoading]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const recentSessions = sessions.slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <CelebrationModal
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a practicar
          </Button>
          <UserMenu />
        </div>
      </header>

      <main className="pt-24 pb-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-foreground mb-2">Tu Progreso</h1>
          <p className="text-muted-foreground mb-8">
            Revisa tu avance hacia la certificación
          </p>

          {/* Main progress card */}
          <div className="bg-card border border-border rounded-2xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                Progreso de Certificación
              </h2>
              <Award className="w-8 h-8 text-primary" />
            </div>

            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            ) : (
              <>
                <PracticeTimer
                  totalSeconds={totalPracticeTime}
                  targetSeconds={TARGET_TIME}
                  className="mb-6"
                />

                <div className="grid md:grid-cols-3 gap-6 mt-8">
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">
                      {formatDuration(totalPracticeTime)}
                    </p>
                    <p className="text-sm text-muted-foreground">Tiempo total</p>
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">
                      {sessions.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sesiones completadas
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <Award className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">
                      {Math.min(
                        100,
                        Math.round((totalPracticeTime / TARGET_TIME) * 100)
                      )}
                      %
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Hacia certificación
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Recent sessions */}
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Sesiones Recientes
            </h2>

            {isLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-xl"></div>
                ))}
              </div>
            ) : recentSessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aún no tienes sesiones de práctica. ¡Comienza tu primera sesión!
              </p>
            ) : (
              <div className="space-y-4">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {formatDistanceToNow(new Date(session.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.rating
                          ? `Calificación: ${"⭐".repeat(session.rating)}`
                          : "Sin calificación"}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      {formatDuration(session.duration_seconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Progress;
