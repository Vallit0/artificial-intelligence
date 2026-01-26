import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useScenarios } from "@/hooks/useScenarios";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import UserMenu from "@/components/UserMenu";
import ScenarioNode from "@/components/scenarios/ScenarioNode";
import ScenarioPath from "@/components/scenarios/ScenarioPath";
import StatsBar from "@/components/scenarios/StatsBar";
import UnitHeader from "@/components/scenarios/UnitHeader";
import logoSenoriales from "@/assets/logo-senoriales.png";
import { Link } from "react-router-dom";

export default function Scenarios() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scenarios, isLoading, error } = useScenarios();
  const [expandedUnit, setExpandedUnit] = useState(true);

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
    // Simulating some progress for demo
    const mockProgress: Record<string, number> = {};
    return mockProgress[scenarioId] || 0;
  };

  // Get path direction for zigzag layout
  const getPathDirection = (index: number): "left" | "right" | "center" => {
    const position = index % 4;
    if (position === 0) return "center";
    if (position === 1) return "right";
    if (position === 2) return "center";
    return "left";
  };

  // Get horizontal offset for zigzag layout
  const getHorizontalOffset = (index: number): string => {
    const position = index % 4;
    if (position === 0) return "ml-0";
    if (position === 1) return "ml-16";
    if (position === 2) return "ml-0";
    return "-ml-16";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoSenoriales} alt="Logo" className="h-8" />
            <span className="font-bold text-foreground hidden sm:inline">
              Centro de Negocios
            </span>
          </Link>

          <StatsBar
            streak={userStats.streak}
            xp={userStats.xp}
            lives={userStats.lives}
          />

          <div className="flex items-center gap-2">
            {user && <UserMenu />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-md">
        {/* Unit Header */}
        <UnitHeader
          title="Manejo de Objeciones"
          description="Domina las técnicas de respuesta"
          isExpanded={expandedUnit}
          progress={20}
          onToggle={() => setExpandedUnit(!expandedUnit)}
          className="mb-8"
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-20 h-20 rounded-full bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 py-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : expandedUnit ? (
          <div className="flex flex-col items-center">
            {scenarios.map((scenario, index) => (
              <div key={scenario.id} className="flex flex-col items-center">
                {/* Path connector (except for first item) */}
                {index > 0 && (
                  <ScenarioPath direction={getPathDirection(index)} />
                )}

                {/* Scenario node with zigzag offset */}
                <div className={cn("transition-all", getHorizontalOffset(index))}>
                  <ScenarioNode
                    scenario={scenario}
                    index={index}
                    isCompleted={getScenarioProgress(scenario.id) >= 100}
                    progress={getScenarioProgress(scenario.id)}
                    onClick={() => handleSelectScenario(scenario.id)}
                  />
                </div>
              </div>
            ))}

            {/* Bottom padding */}
            <div className="h-20" />
          </div>
        ) : null}
      </main>

      {/* Bottom navigation (optional, for mobile feel) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border py-2 px-4 sm:hidden">
        <div className="flex items-center justify-around">
          <Button variant="ghost" size="sm" className="flex-col gap-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="text-xs">Inicio</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col gap-1"
            onClick={() => navigate("/progress")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs">Progreso</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex-col gap-1">
            <Settings className="w-5 h-5" />
            <span className="text-xs">Config</span>
          </Button>
        </div>
      </nav>
    </div>
  );
}
