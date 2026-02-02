import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProspectingCarousel from "@/components/prospecting/ProspectingCarousel";
import logoSenoriales from "@/assets/logo-senoriales.png";

const Prospecting = () => {
  const navigate = useNavigate();

  const handleStartPractice = (scenarioId: number) => {
    // Navigate to practice page with the prospecting scenario
    navigate(`/practice?prospecting=${scenarioId}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img 
            src={logoSenoriales} 
            alt="Centro de Negocios Señoriales" 
            className="h-10 w-auto"
          />
          <span className="text-lg font-bold text-foreground hidden sm:block">
            Prospección
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-8 sm:py-12 overflow-y-auto">
        <ProspectingCarousel onStartPractice={handleStartPractice} />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border py-2 px-2 lg:hidden shadow-lg">
        <div className="flex items-center justify-around">
          <MobileNavItem icon="home" label="Aprender" href="/scenarios" />
          <MobileNavItem icon="search" label="Prospectar" href="/prospecting" active />
          <MobileNavItem icon="mic" label="Practicar" href="/practice" />
          <MobileNavItem icon="chart" label="Progreso" href="/progress" />
        </div>
      </nav>
    </div>
  );
};

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
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        );
      case "search":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case "mic":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
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

  return (
    <button
      onClick={() => navigate(href)}
      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 ${
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

export default Prospecting;
