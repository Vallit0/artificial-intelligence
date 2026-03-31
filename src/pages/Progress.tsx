import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PracticeTimer from "@/components/PracticeTimer";
import CelebrationModal from "@/components/CelebrationModal";
import { Award, Clock, TrendingUp, Flame, Calendar, Star } from "lucide-react";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { formatDistanceToNow, startOfWeek, endOfWeek, isWithinInterval, startOfDay, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
 import MobileNavigation from "@/components/MobileNavigation";
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
                                {session.score !== null
                                  ? `Score: ${session.score}/100${session.passed ? " - Aprobado" : ""}`
                                  : session.rating
                                  ? `${"⭐".repeat(session.rating)}`
                                  : "Sin calificación"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {session.score !== null && (
                                <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                                  session.score >= 50
                                    ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
                                    : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
                                }`}>
                                  {session.score}%
                                </span>
                              )}
                              <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                                {formatDuration(session.duration_seconds)}
                              </span>
                            </div>
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
       <MobileNavigation />
    </div>
  );
};

export default Progress;
