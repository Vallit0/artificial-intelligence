import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProspectingCarousel from "@/components/prospecting/ProspectingCarousel";
 import MobileNavigation from "@/components/MobileNavigation";
import logoSenoriales from "@/assets/logo-senoriales.png";

const Prospecting = () => {
  const navigate = useNavigate();

  const handleStartPractice = (scenarioId: number, agentId?: string) => {
    // Navigate to practice page with the prospecting scenario and optional agent ID
    const params = new URLSearchParams();
    params.set("prospecting", scenarioId.toString());
    if (agentId) {
      params.set("agent", agentId);
    }
    navigate(`/practice?${params.toString()}`);
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
       <MobileNavigation />
    </div>
  );
};

export default Prospecting;
