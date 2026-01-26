import { useMemo } from "react";
import { 
  Mic, 
  Clock, 
  Star, 
  MessageSquare, 
  Flame, 
  Trophy,
  Target,
  Zap,
  Award,
  TrendingUp,
  Volume2,
  Users,
  Calendar,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";

interface Mission {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  current: number;
  target: number;
  xp: number;
  category: "daily" | "weekly" | "achievement";
}

export default function Quests() {
  const { sessions } = usePracticeSessions();

  // Calculate real progress from sessions
  const todaySessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessions.filter(s => new Date(s.created_at) >= today);
  }, [sessions]);

  const todayMinutes = useMemo(() => {
    return Math.floor(todaySessions.reduce((acc, s) => acc + s.duration_seconds, 0) / 60);
  }, [todaySessions]);

  const perfectSessions = useMemo(() => {
    return todaySessions.filter(s => s.rating === 5).length;
  }, [todaySessions]);

  const totalSessions = sessions.length;
  const totalMinutes = Math.floor(sessions.reduce((acc, s) => acc + s.duration_seconds, 0) / 60);

  const DAILY_MISSIONS: Mission[] = [
    {
      id: "practice-session",
      title: "Práctica del día",
      description: "Completa 1 sesión de práctica de voz",
      icon: Mic,
      current: todaySessions.length,
      target: 1,
      xp: 10,
      category: "daily"
    },
    {
      id: "practice-time-5",
      title: "Calentamiento vocal",
      description: "Acumula 5 minutos hablando con el coach",
      icon: Clock,
      current: Math.min(todayMinutes, 5),
      target: 5,
      xp: 10,
      category: "daily"
    },
    {
      id: "practice-time-10",
      title: "Entrena 10 minutos",
      description: "Acumula 10 minutos de práctica hoy",
      icon: Clock,
      current: Math.min(todayMinutes, 10),
      target: 10,
      xp: 15,
      category: "daily"
    },
    {
      id: "practice-time-20",
      title: "Sesión intensiva",
      description: "Practica 20 minutos en un solo día",
      icon: Zap,
      current: Math.min(todayMinutes, 20),
      target: 20,
      xp: 25,
      category: "daily"
    },
    {
      id: "perfect-response",
      title: "Respuesta perfecta",
      description: "Obtén 5 estrellas en una sesión",
      icon: Star,
      current: perfectSessions,
      target: 1,
      xp: 25,
      category: "daily"
    },
    {
      id: "complete-scenario",
      title: "Conquista un escenario",
      description: "Completa cualquier escenario de ventas",
      icon: MessageSquare,
      current: todaySessions.length,
      target: 1,
      xp: 20,
      category: "daily"
    },
    {
      id: "streak-keeper",
      title: "Mantén la racha",
      description: "Practica hoy para mantener tu racha activa",
      icon: Flame,
      current: todaySessions.length > 0 ? 1 : 0,
      target: 1,
      xp: 15,
      category: "daily"
    },
    {
      id: "double-session",
      title: "Doble esfuerzo",
      description: "Completa 2 sesiones de práctica hoy",
      icon: Target,
      current: Math.min(todaySessions.length, 2),
      target: 2,
      xp: 20,
      category: "daily"
    },
    {
      id: "triple-session",
      title: "Hat-trick de ventas",
      description: "Completa 3 sesiones de práctica hoy",
      icon: Trophy,
      current: Math.min(todaySessions.length, 3),
      target: 3,
      xp: 30,
      category: "daily"
    },
    {
      id: "voice-warmup",
      title: "Calienta la voz",
      description: "Inicia tu primera sesión del día",
      icon: Volume2,
      current: todaySessions.length > 0 ? 1 : 0,
      target: 1,
      xp: 5,
      category: "daily"
    }
  ];

  const WEEKLY_MISSIONS: Mission[] = [
    {
      id: "weekly-sessions",
      title: "Vendedor dedicado",
      description: "Completa 10 sesiones esta semana",
      icon: Users,
      current: Math.min(totalSessions, 10),
      target: 10,
      xp: 100,
      category: "weekly"
    },
    {
      id: "weekly-time",
      title: "Maratón de ventas",
      description: "Acumula 60 minutos de práctica esta semana",
      icon: Calendar,
      current: Math.min(totalMinutes, 60),
      target: 60,
      xp: 150,
      category: "weekly"
    },
    {
      id: "weekly-perfect",
      title: "Semana perfecta",
      description: "Obtén 5 sesiones con 5 estrellas esta semana",
      icon: Award,
      current: Math.min(sessions.filter(s => s.rating === 5).length, 5),
      target: 5,
      xp: 200,
      category: "weekly"
    },
    {
      id: "weekly-streak",
      title: "Racha semanal",
      description: "Practica 5 días seguidos",
      icon: TrendingUp,
      current: 0, // Would need streak calculation
      target: 5,
      xp: 175,
      category: "weekly"
    }
  ];

  const allMissions = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS];
  const completedCount = allMissions.filter(m => m.current >= m.target).length;
  const totalXpEarned = allMissions
    .filter(m => m.current >= m.target)
    .reduce((acc, m) => acc + m.xp, 0);

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-56 min-h-screen">
        <ScrollArea className="h-screen">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Misiones</h1>
              <p className="text-muted-foreground">Completa misiones para ganar XP y mejorar tus habilidades de venta</p>
            </div>

            {/* Stats Summary */}
            <Card className="mb-8 bg-gradient-to-r from-secondary/10 to-primary/10 border-secondary/20">
              <CardContent className="py-6">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-secondary">{completedCount}</div>
                    <div className="text-sm text-muted-foreground">Completadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{allMissions.length}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-500">{totalXpEarned}</div>
                    <div className="text-sm text-muted-foreground">XP Ganado</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Missions */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-5 h-5 text-orange-500" />
                <h2 className="text-xl font-bold text-foreground">Misiones Diarias</h2>
                <Badge variant="secondary" className="ml-auto">
                  Se reinician en 24h
                </Badge>
              </div>
              <div className="space-y-3">
                {DAILY_MISSIONS.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))}
              </div>
            </div>

            {/* Weekly Missions */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Misiones Semanales</h2>
                <Badge variant="outline" className="ml-auto">
                  Se reinician el lunes
                </Badge>
              </div>
              <div className="space-y-3">
                {WEEKLY_MISSIONS.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}

function MissionCard({ mission }: { mission: Mission }) {
  const Icon = mission.icon;
  const progress = (mission.current / mission.target) * 100;
  const isComplete = mission.current >= mission.target;

  return (
    <Card className={`transition-all ${isComplete ? "bg-secondary/5 border-secondary/30" : "hover:shadow-md"}`}>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isComplete ? "bg-secondary/20" : "bg-muted"
          }`}>
            {isComplete ? (
              <CheckCircle2 className="w-6 h-6 text-secondary" />
            ) : (
              <Icon className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className={`font-semibold ${isComplete ? "text-secondary" : "text-foreground"}`}>
                {mission.title}
              </p>
              <Badge variant={isComplete ? "secondary" : "outline"} className="ml-2">
                +{mission.xp} XP
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{mission.description}</p>
            <div className="flex items-center gap-3">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {mission.current} / {mission.target}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border py-3 px-4 lg:hidden shadow-lg">
      <div className="flex items-center justify-around">
        <MobileNavItem icon="home" label="Aprender" href="/scenarios" />
        <MobileNavItem icon="trophy" label="Ranking" href="/leaderboards" />
        <MobileNavItem icon="target" label="Misiones" href="/quests" active />
        <MobileNavItem icon="user" label="Perfil" href="/profile" />
      </div>
    </nav>
  );
}

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
  const getIcon = () => {
    switch (icon) {
      case "home":
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        );
      case "trophy":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
      case "user":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <a
      href={href}
      className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-200 ${
        active 
          ? "text-secondary bg-secondary/10" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {getIcon()}
      <span className="text-xs font-semibold">{label}</span>
    </a>
  );
}
