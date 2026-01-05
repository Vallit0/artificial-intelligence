import { useNavigate } from "react-router-dom";
import PracticeTimer from "@/components/PracticeTimer";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Award, Clock, TrendingUp, ArrowLeft } from "lucide-react";

const Progress = () => {
  const navigate = useNavigate();
  
  // This would come from the database in the full implementation
  const totalPracticeTime = 3600; // 1 hour in seconds for demo
  const targetTime = 7200; // 2 hours

  return (
    <div className="min-h-screen bg-background">
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

            <PracticeTimer
              totalSeconds={totalPracticeTime}
              targetSeconds={targetTime}
              className="mb-6"
            />

            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {Math.floor(totalPracticeTime / 3600)}h{" "}
                  {Math.floor((totalPracticeTime % 3600) / 60)}m
                </p>
                <p className="text-sm text-muted-foreground">Tiempo total</p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">5</p>
                <p className="text-sm text-muted-foreground">Sesiones completadas</p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <Award className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {Math.round((totalPracticeTime / targetTime) * 100)}%
                </p>
                <p className="text-sm text-muted-foreground">Hacia certificación</p>
              </div>
            </div>
          </div>

          {/* Recent sessions */}
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Sesiones Recientes
            </h2>

            <div className="space-y-4">
              {[
                { date: "Hoy", duration: "15 min", topics: "Manejo de objeciones" },
                { date: "Ayer", duration: "22 min", topics: "Cierre de ventas" },
                { date: "Hace 2 días", duration: "18 min", topics: "Presentación de servicios" },
              ].map((session, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-xl"
                >
                  <div>
                    <p className="font-medium text-foreground">{session.date}</p>
                    <p className="text-sm text-muted-foreground">{session.topics}</p>
                  </div>
                  <span className="text-sm font-medium text-primary">
                    {session.duration}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Progress;
