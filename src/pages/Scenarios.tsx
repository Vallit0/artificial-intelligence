import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useScenarios } from "@/hooks/useScenarios";
import { useAuth } from "@/hooks/useAuth";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import RightSidebar from "@/components/scenarios/RightSidebar";
import LessonPath from "@/components/scenarios/LessonPath";
import { ScrollArea } from "@/components/ui/scroll-area";
import { startOfWeek, endOfWeek, isWithinInterval, startOfDay, differenceInCalendarDays } from "date-fns";

export default function Scenarios() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scenarios, isLoading, error } = useScenarios();
  const { sessions } = usePracticeSessions();

  const handleSelectScenario = (scenarioId: string) => {
    navigate(`/practice?scenario=${scenarioId}`);
  };

  // Calculate practice days for the current week
  const practiceDays = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const daysWithPractice = sessions
      .filter((session) => {
        const sessionDate = new Date(session.created_at);
        return isWithinInterval(sessionDate, { start: weekStart, end: weekEnd });
      })
      .map((session) => startOfDay(new Date(session.created_at)));

    // Remove duplicates (multiple sessions on the same day)
    const uniqueDays = daysWithPractice.filter(
      (day, index, self) =>
        index === self.findIndex((d) => d.getTime() === day.getTime())
    );

    return uniqueDays;
  }, [sessions]);

  // Calculate streak (consecutive days of practice ending today or yesterday)
  const streak = useMemo(() => {
    if (sessions.length === 0) return 0;

    const today = startOfDay(new Date());
    const sortedDates = sessions
      .map((s) => startOfDay(new Date(s.created_at)))
      .filter((d, i, self) => i === self.findIndex((x) => x.getTime() === d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    if (sortedDates.length === 0) return 0;

    // Check if the most recent practice was today or yesterday
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

  // Calculate crowns (earned by completing sections - for now, placeholder)
  // In production, this would track completed scenarios/sections
  const crowns = 0;

  const userStats = {
    streak,
    crowns,
  };

  // Mock scenario progress (in production, calculate from practice_sessions)
  const getScenarioProgress = (scenarioId: string) => {
    const mockProgress: Record<string, number> = {};
    return mockProgress[scenarioId] || 0;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Left Sidebar - Fixed */}
      <LeftSidebar />

      {/* Right Sidebar - Fixed (Desktop XL only) */}
      <RightSidebar
        streak={userStats.streak}
        crowns={userStats.crowns}
        practiceDays={practiceDays}
      />

      {/* Main Content - Centered */}
      <main className="lg:ml-56 xl:mr-80 min-h-screen">
        <ScrollArea className="h-screen">
          <div className="max-w-xl mx-auto px-3 sm:px-4 py-4 sm:py-6 relative">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4 py-12">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-20 h-20 rounded-full bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : error ? (
              <Card className="border-destructive mt-8">
                <CardContent className="flex items-center gap-3 py-6">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-destructive">{error}</p>
                </CardContent>
              </Card>
            ) : (
              <LessonPath
                scenarios={scenarios}
                onSelectScenario={handleSelectScenario}
              />
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border py-2 px-2 lg:hidden shadow-lg z-30">
        <div className="flex items-center justify-around">
          <MobileNavItem icon="users" label="Prospectar" href="/prospecting" />
          <MobileNavItem icon="mic" label="Practicar" href="/practice" />
          <MobileNavItem icon="target" label="Evaluación" href="/quests" />
          <MobileNavItem icon="chart" label="Progreso" href="/progress" />
        </div>
      </nav>
    </div>
  );
}

// Mobile navigation item component
function MobileNavItem({
  icon,
  label,
  href,
  active,
  disabled,
}: {
  icon: string;
  label: string;
  href: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const navigate = useNavigate();

  const getIcon = () => {
    switch (icon) {
      case "home":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        );
      case "users":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case "mic":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        );
      case "target":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <circle cx="12" cy="12" r="6" strokeWidth={2} />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        );
      case "chart":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (disabled) {
    return (
      <div
        className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl opacity-40 cursor-not-allowed"
      >
        {getIcon()}
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate(href)}
      className={cn(
        "flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-200",
        active 
          ? "text-secondary bg-secondary/10" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {getIcon()}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
