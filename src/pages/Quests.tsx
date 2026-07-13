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
  CheckCircle2,
  Sparkles,
  Gem
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const CATEGORY_STYLES: Record<
  Mission["category"],
  { gradient: string; soft: string; text: string; ring: string }
> = {
  daily: {
    gradient: "from-orange-400 to-amber-500",
    soft: "bg-orange-500/10",
    text: "text-orange-500",
    ring: "ring-orange-500/20",
  },
  weekly: {
    gradient: "from-primary to-indigo",
    soft: "bg-primary/10",
    text: "text-primary",
    ring: "ring-primary/20",
  },
  achievement: {
    gradient: "from-secondary to-turquoise",
    soft: "bg-secondary/10",
    text: "text-secondary",
    ring: "ring-secondary/20",
  },
};

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

  const overallPct = allMissions.length
    ? Math.round((completedCount / allMissions.length) * 100)
    : 0;

  // Lightweight gamification: 100 XP per level
  const level = Math.floor(totalXpEarned / 100) + 1;
  const xpIntoLevel = totalXpEarned % 100;

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="ml-60 min-h-screen animate-fade-in pb-24 lg:pb-0">
        <ScrollArea className="h-screen">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
            {/* Header */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mb-2">
                <Sparkles className="w-4 h-4" />
                Centro de misiones
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-1">
                Misiones
              </h1>
              <p className="text-muted-foreground">
                Completa misiones para ganar XP y mejorar tus habilidades de venta
              </p>
            </div>

            {/* Hero progress card */}
            <Card className="mb-8 border-0 shadow-soft overflow-hidden">
              <div className="relative bg-gradient-to-br from-primary via-indigo to-secondary text-white">
                {/* decorative glow */}
                <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-20 -left-8 w-52 h-52 rounded-full bg-secondary/30 blur-2xl" />

                <CardContent className="relative py-6 px-5 sm:px-7">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    {/* Progress ring + level */}
                    <div className="flex items-center gap-4">
                      <ProgressRing value={overallPct} />
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
                          <Gem className="w-3.5 h-3.5" />
                          Nivel
                        </div>
                        <div className="text-3xl font-extrabold leading-none">{level}</div>
                        <div className="mt-2 w-28">
                          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white transition-all duration-700"
                              style={{ width: `${xpIntoLevel}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-white/70">
                            {xpIntoLevel}/100 XP al siguiente nivel
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stat chips */}
                    <div className="grid grid-cols-3 gap-3 sm:ml-auto sm:gap-4">
                      <HeroStat icon={CheckCircle2} value={completedCount} label="Completadas" />
                      <HeroStat icon={Target} value={allMissions.length} label="Misiones" />
                      <HeroStat icon={Zap} value={totalXpEarned} label="XP ganado" />
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* Daily Missions */}
            <SectionHeader
              icon={Flame}
              iconClass="text-orange-500"
              title="Misiones Diarias"
              badge="Se reinician en 24h"
              badgeVariant="secondary"
              done={DAILY_MISSIONS.filter(m => m.current >= m.target).length}
              total={DAILY_MISSIONS.length}
            />
            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {DAILY_MISSIONS.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>

            {/* Weekly Missions */}
            <SectionHeader
              icon={Calendar}
              iconClass="text-primary"
              title="Misiones Semanales"
              badge="Se reinician el lunes"
              badgeVariant="outline"
              done={WEEKLY_MISSIONS.filter(m => m.current >= m.target).length}
              total={WEEKLY_MISSIONS.length}
            />
            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {WEEKLY_MISSIONS.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          </div>
        </ScrollArea>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const size = 76;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold leading-none">{value}%</span>
        <span className="text-[10px] text-white/70">progreso</span>
      </div>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-white/15 backdrop-blur-sm px-3 py-3 text-center">
      <Icon className="w-4 h-4 mx-auto mb-1 text-white/80" />
      <div className="text-xl font-extrabold leading-none">{value}</div>
      <div className="text-[11px] text-white/75 mt-1">{label}</div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  iconClass,
  title,
  badge,
  badgeVariant,
  done,
  total,
}: {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  badge: string;
  badgeVariant: "secondary" | "outline";
  done: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-card shadow-soft ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{done} de {total} completadas</p>
      </div>
      <Badge variant={badgeVariant} className="ml-auto whitespace-nowrap">
        {badge}
      </Badge>
    </div>
  );
}

function MissionCard({ mission }: { mission: Mission }) {
  const Icon = mission.icon;
  const progress = Math.min((mission.current / mission.target) * 100, 100);
  const isComplete = mission.current >= mission.target;
  const styles = CATEGORY_STYLES[mission.category];

  return (
    <Card
      className={`group relative overflow-hidden border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft ${
        isComplete
          ? "border-secondary/30 bg-secondary/5"
          : "border-border hover:border-primary/30"
      }`}
    >
      {/* accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${
          isComplete ? "from-secondary to-turquoise" : styles.gradient
        }`}
      />
      <CardContent className="py-4 pl-5 pr-4">
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ring-1 ${
              isComplete
                ? "bg-secondary/15 ring-secondary/30"
                : `${styles.soft} ${styles.ring}`
            }`}
          >
            {isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-secondary" />
            ) : (
              <Icon className={`w-5 h-5 ${styles.text}`} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <p
                className={`font-semibold leading-tight ${
                  isComplete ? "text-secondary" : "text-foreground"
                }`}
              >
                {mission.title}
              </p>
              <Badge
                variant={isComplete ? "secondary" : "outline"}
                className="shrink-0 gap-0.5 font-bold"
              >
                <Zap className="w-3 h-3" />
                {mission.xp}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {mission.description}
            </p>

            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${
                    isComplete ? "from-secondary to-turquoise" : styles.gradient
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span
                className={`text-xs font-semibold whitespace-nowrap tabular-nums ${
                  isComplete ? "text-secondary" : "text-muted-foreground"
                }`}
              >
                {mission.current}/{mission.target}
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
