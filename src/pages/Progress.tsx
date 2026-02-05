import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PracticeTimer from "@/components/PracticeTimer";
import CelebrationModal from "@/components/CelebrationModal";
import { Award, Clock, TrendingUp, Flame, Calendar, Star } from "lucide-react";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { formatDistanceToNow, startOfWeek, endOfWeek, isWithinInterval, startOfDay, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";

const TARGET_TIME = 1500; // 25 minutes in seconds

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

  // Calculate streak
  const streak = useMemo(() => {
    if (sessions.length === 0) return 0;

    const today = startOfDay(new Date());
    const sortedDates = sessions
      .map((s) => startOfDay(new Date(s.created_at)))
      .filter((d, i, self) => i === self.findIndex((x) => x.getTime() === d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    if (sortedDates.length === 0) return 0;

    const mostRecent = sortedDates[0];
    const daysSinceLast = differenceInCalendarDays(today, mostRecent);
    if (daysSinceLast > 1) return 0;

    let count = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = differenceInCalendarDays(sortedDates[i - 1], sortedDates[i]);
      if (diff === 1) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [sessions]);

  // Calculate this week's stats
  const weekStats = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const weekSessions = sessions.filter((session) => {
      const sessionDate = new Date(session.created_at);
      return isWithinInterval(sessionDate, { start: weekStart, end: weekEnd });
    });

    const weekTime = weekSessions.reduce((acc, s) => acc + s.duration_seconds, 0);
    const avgRating = weekSessions.filter(s => s.rating).length > 0
      ? weekSessions.filter(s => s.rating).reduce((acc, s) => acc + (s.rating || 0), 0) / weekSessions.filter(s => s.rating).length
      : 0;

    return {
      sessions: weekSessions.length,
      time: weekTime,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  }, [sessions]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const recentSessions = sessions.slice(0, 8);
  const progressPercent = Math.min(100, Math.round((totalPracticeTime / TARGET_TIME) * 100));

  return (
    <div className="min-h-screen bg-background">
      <CelebrationModal
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
      />

      {/* Left Sidebar */}
      <LeftSidebar />

      {/* Main Content */}
      <main className="lg:ml-56 min-h-screen">
        <ScrollArea className="h-screen">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Mi Progreso</h1>
              <p className="text-muted-foreground">
                Revisa tu avance hacia la certificación y tus estadísticas
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 bg-muted rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Main Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardContent className="p-4 text-center">
                      <Clock className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-2xl font-bold text-foreground">
                        {formatDuration(totalPracticeTime)}
                      </p>
                      <p className="text-xs text-muted-foreground">Tiempo Total</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="w-8 h-8 text-secondary mx-auto mb-2" />
                      <p className="text-2xl font-bold text-foreground">
                        {sessions.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Sesiones</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
                    <CardContent className="p-4 text-center">
                      <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-foreground">
                        {streak}
                      </p>
                      <p className="text-xs text-muted-foreground">Días de racha</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
                    <CardContent className="p-4 text-center">
                      <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-foreground">
                        {weekStats.avgRating > 0 ? weekStats.avgRating : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">Prom. Estrellas</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Certification Progress */}
                <Card className="mb-8">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Award className="w-6 h-6 text-primary" />
                        Progreso de Certificación
                      </CardTitle>
                      <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PracticeTimer
                      totalSeconds={totalPracticeTime}
                      targetSeconds={TARGET_TIME}
                      className="mb-4"
                    />
                    <p className="text-sm text-muted-foreground text-center">
                      {totalPracticeTime >= TARGET_TIME 
                        ? "🎉 ¡Felicidades! Has completado las 2 horas de práctica requeridas."
                        : `Necesitas ${formatDuration(TARGET_TIME - totalPracticeTime)} más para obtener tu certificación.`
                      }
                    </p>
                  </CardContent>
                </Card>

                {/* This Week Stats */}
                <Card className="mb-8">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-secondary" />
                      Esta Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-xl">
                        <p className="text-2xl font-bold text-foreground">{weekStats.sessions}</p>
                        <p className="text-xs text-muted-foreground">Sesiones</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-xl">
                        <p className="text-2xl font-bold text-foreground">{formatDuration(weekStats.time)}</p>
                        <p className="text-xs text-muted-foreground">Tiempo</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-xl">
                        <p className="text-2xl font-bold text-foreground">
                          {weekStats.avgRating > 0 ? `${weekStats.avgRating}⭐` : "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">Promedio</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Sessions */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle>Sesiones Recientes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentSessions.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Aún no tienes sesiones de práctica. ¡Comienza tu primera sesión!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {recentSessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
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
                                  ? `${"⭐".repeat(session.rating)}`
                                  : "Sin calificación"}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                              {formatDuration(session.duration_seconds)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border py-3 px-4 lg:hidden shadow-lg">
        <div className="flex items-center justify-around">
          <MobileNavItem icon="home" label="Aprender" href="/scenarios" />
          <MobileNavItem icon="target" label="Misiones" href="/quests" />
          <MobileNavItem icon="progress" label="Progreso" href="/progress" active />
        </div>
      </nav>
    </div>
  );
};

function MobileNavItem({
  icon,
  label,
  href,
  active,
}: {
  icon: string;
  label: string;
  href: string;
  active?: boolean;
}) {
  const navigate = useNavigate();

  const getIcon = () => {
    switch (icon) {
      case "home":
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        );
      case "target":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <circle cx="12" cy="12" r="6" strokeWidth={2} />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        );
      case "progress":
        return (
          <TrendingUp className="w-6 h-6" />
        );
      default:
        return null;
    }
  };

  return (
    <button
      onClick={() => navigate(href)}
      className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-200 ${
        active 
          ? "text-secondary bg-secondary/10" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {getIcon()}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

export default Progress;
