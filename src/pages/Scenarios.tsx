import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useScenarios } from "@/hooks/useScenarios";
import { useAuth } from "@/hooks/useAuth";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
 import { AlertCircle } from "lucide-react";
 import MobileNavigation from "@/components/MobileNavigation";
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
       <MobileNavigation />
    </div>
  );
}

