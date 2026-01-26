import { useNavigate } from "react-router-dom";
import { useScenarios } from "@/hooks/useScenarios";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import RightSidebar from "@/components/scenarios/RightSidebar";
import UnitBanner from "@/components/scenarios/UnitBanner";
import LessonPath from "@/components/scenarios/LessonPath";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Scenarios() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scenarios, isLoading, error } = useScenarios();

  const handleSelectScenario = (scenarioId: string) => {
    navigate(`/practice?scenario=${scenarioId}`);
  };

  // Mock user stats (in production, fetch from database)
  const userStats = {
    streak: 3,
    xp: 150,
    lives: 5,
  };

  // Mock scenario progress (in production, calculate from practice_sessions)
  const getScenarioProgress = (scenarioId: string) => {
    const mockProgress: Record<string, number> = {};
    return mockProgress[scenarioId] || 0;
  };

  return (
    <div className="min-h-screen bg-[hsl(229,48%,10%)]">
      {/* Left Sidebar - Fixed */}
      <LeftSidebar />

      {/* Right Sidebar - Fixed (Desktop XL only) */}
      <RightSidebar
        streak={userStats.streak}
        xp={userStats.xp}
        lives={userStats.lives}
      />

      {/* Main Content - Centered */}
      <main className="lg:ml-56 xl:mr-80 min-h-screen">
        <ScrollArea className="h-screen">
          <div className="max-w-xl mx-auto px-4 py-6">
            {/* Unit Banner */}
            <UnitBanner
              section={1}
              unit={1}
              title="Manejo de Objeciones"
            />

            {/* Content */}
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
                getProgress={getScenarioProgress}
              />
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[hsl(229,48%,10%)] border-t border-[hsl(229,40%,18%)] py-2 px-4 lg:hidden">
        <div className="flex items-center justify-around">
          <MobileNavItem icon="home" label="Aprender" href="/scenarios" active />
          <MobileNavItem icon="trophy" label="Ranking" href="/leaderboards" />
          <MobileNavItem icon="target" label="Misiones" href="/quests" />
          <MobileNavItem icon="user" label="Perfil" href="/profile" />
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
    <button
      onClick={() => navigate(href)}
      className={`flex flex-col items-center gap-1 px-3 py-1 ${
        active ? "text-sidebar-primary" : "text-sidebar-foreground/60"
      }`}
    >
      {getIcon()}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
