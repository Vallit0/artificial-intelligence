import { useNavigate } from "react-router-dom";
import ProspectingCarousel from "@/components/prospecting/ProspectingCarousel";
import MobileNavigation from "@/components/MobileNavigation";
import LeftSidebar from "@/components/scenarios/LeftSidebar";

const Prospecting = () => {
  const navigate = useNavigate();

  const handleStartPractice = (scenarioId: number, agentId?: string) => {
    const params = new URLSearchParams();
    params.set("prospecting", scenarioId.toString());
    if (agentId) {
      params.set("agent", agentId);
    }
    navigate(`/practice?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen flex flex-col animate-fade-in">
        <div className="flex-1 py-8 sm:py-12 overflow-y-auto">
          <ProspectingCarousel onStartPractice={handleStartPractice} />
        </div>
      </main>

      <MobileNavigation />
    </div>
  );
};

export default Prospecting;
