import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProspectingScenarioCard, { ProspectingScenario } from "./ProspectingScenarioCard";
import ProspectingPreviewModal from "./ProspectingPreviewModal";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

// Export scenarios with agent IDs for prospecting
export const prospectingScenarios: (ProspectingScenario & { agentId?: string })[] = [
  {
    id: 1,
    title: "Pareja en la Fila de Caja",
    description: "En la fila de Caja del supermercado se encuentra una pareja de aproximadamente 28 y 30 años, su carreta de compras va llena.",
    location: "Supermercado",
    targetAge: "28-30 años",
    icon: "supermarket",
    videoUrl: "/videos/prospecting/scenario-1-pareja.mp4",
    agentId: "ELEVENLABS_AGENT_PROSPECTING_PAREJA", // Secret name for this agent
  },
  {
    id: 2,
    title: "Señora en Frutas y Verduras",
    description: "En el área de frutas y verduras del supermercado se encuentra una señora de 40 años, ella se encuentra viendo las diferentes opciones para su compra.",
    location: "Supermercado",
    targetAge: "40 años",
    icon: "supermarket",
    videoUrl: "/videos/prospecting/scenario-2-frutas.mp4",
    agentId: "ELEVENLABS_AGENT_PROSPECTING_FRUTAS",
  },
  {
    id: 3,
    title: "Señor en Neumáticos",
    description: "En el área de neumáticos y accesorios para vehículos se encuentra un señor de 50 años, está realizando una revisión de las diferentes marcas de neumáticos y comparando precios.",
    location: "Supermercado",
    targetAge: "50 años",
    icon: "supermarket",
    videoUrl: "/videos/prospecting/scenario-3-neumaticos.mp4",
  },
  {
    id: 4,
    title: "Profesional en Restaurante",
    description: "Un señor de 30 años se encuentra en un restaurante de comida rápida tomando un café, él tiene sobre su mesa una Laptop y agenda, las cuales se puede apreciar está realizando temas laborales.",
    location: "Restaurante",
    targetAge: "30 años",
    icon: "restaurant",
    videoUrl: "/videos/prospecting/scenario-4-restaurante.mp4",
  },
  {
    id: 5,
    title: "Señor en el Parqueo",
    description: "Un señor de 35 años se encuentra cercano a su vehículo dentro de un parqueo, se encuentra él cargando unas cosas en la parte de atrás.",
    location: "Parqueo",
    targetAge: "35 años",
    icon: "parking",
    videoUrl: "/videos/prospecting/scenario-5-parqueo.mp4",
  },
  {
    id: 6,
    title: "Profesional Caminando",
    description: "Usted va caminando en busca de una cafetería para su almuerzo, frente a usted viene caminando una señorita de 28 años aproximadamente, la imagen de ella refleja ser profesional.",
    location: "Calle",
    targetAge: "28 años",
    icon: "street",
    videoUrl: "/videos/prospecting/scenario-6-profesional-caminando.mp4",
  },
  {
    id: 7,
    title: "Familia en Stand",
    description: "Usted se encuentra en un Stand de la empresa dentro de un centro comercial, a cierta distancia observa que pasarán frente a usted una pequeña familia de 3 (esposa, esposo e hijo de 5 años).",
    location: "Centro Comercial",
    targetAge: "Familia joven",
    icon: "mall",
    videoUrl: "/videos/prospecting/scenario-7-familia-stand.mp4",
  },
  {
    id: 8,
    title: "Señora de Compras (Stand 1)",
    description: "Usted se encuentra en un Stand de la empresa dentro de un centro comercial, a cierta distancia observa que pasará frente a usted una señora de 40 años, que refleja que viene de realizar varias compras.",
    location: "Centro Comercial",
    targetAge: "40 años",
    icon: "mall",
    videoUrl: "/videos/prospecting/scenario-8-senora-compras.mp4",
  },
  {
    id: 9,
    title: "Señora de Compras (Stand 2)",
    description: "Usted se encuentra en un Stand de la empresa dentro de un centro comercial, a cierta distancia observa que pasará frente a usted una señora de 40 años, que refleja que viene de realizar varias compras.",
    location: "Centro Comercial",
    targetAge: "40 años",
    icon: "mall",
  },
  {
    id: 10,
    title: "Pareja en Cementerio",
    description: "Usted se encuentra dentro de Cementerio Los Parques, en uno de los jardines se observa a una pareja joven de aproximadamente 30 años, la dama está con su perro, mientras colocan flores en una lápida.",
    location: "Cementerio Los Parques",
    targetAge: "30 años",
    icon: "cemetery",
    videoUrl: "/videos/prospecting/scenario-10-cementerio.mp4",
  },
];

interface ProspectingCarouselProps {
  onStartPractice?: (scenarioId: number, agentId?: string) => void;
}

const ProspectingCarousel = ({ onStartPractice }: ProspectingCarouselProps) => {
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [previewScenario, setPreviewScenario] = useState<(ProspectingScenario & { agentId?: string }) | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    setCount(api.scrollSnapList().length);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  const scrollPrev = useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = useCallback(() => {
    api?.scrollNext();
  }, [api]);

  // Open preview modal when clicking "Iniciar Práctica"
  const handleOpenPreview = () => {
    if (selectedScenario !== null) {
      const scenario = prospectingScenarios.find(s => s.id === selectedScenario);
      if (scenario) {
        setPreviewScenario(scenario);
        setShowPreviewModal(true);
      }
    }
  };

  // Start practice from modal
  const handleStartFromModal = (scenarioId: number) => {
    setShowPreviewModal(false);
    if (onStartPractice && previewScenario) {
      onStartPractice(scenarioId, previewScenario.agentId);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          Escenarios de Prospección
        </h2>
        <p className="text-sm text-muted-foreground">
          Selecciona un escenario y practica cómo abordar a un prospecto
        </p>
      </div>

      {/* Carousel */}
      <div className="relative">
        <Carousel
          setApi={setApi}
          opts={{
            align: "center",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {prospectingScenarios.map((scenario) => (
              <CarouselItem key={scenario.id} className="pl-2 md:pl-4 basis-[85%] sm:basis-[45%] lg:basis-[33%]">
                <ProspectingScenarioCard
                  scenario={scenario}
                  isSelected={selectedScenario === scenario.id}
                  onClick={() => setSelectedScenario(scenario.id)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Navigation Arrows */}
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 hidden sm:flex h-10 w-10 rounded-full shadow-lg bg-background border-border"
          onClick={scrollPrev}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 hidden sm:flex h-10 w-10 rounded-full shadow-lg bg-background border-border"
          onClick={scrollNext}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-1.5 mt-4">
        {prospectingScenarios.map((_, index) => (
          <button
            key={index}
            onClick={() => api?.scrollTo(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-200",
              current === index
                ? "bg-primary w-6"
                : "bg-muted hover:bg-muted-foreground/50"
            )}
          />
        ))}
      </div>

      {/* Start Practice Button */}
      <div className="mt-6 flex justify-center">
        <Button
          onClick={handleOpenPreview}
          disabled={selectedScenario === null}
          className={cn(
            "h-12 px-8 rounded-xl text-base font-bold gap-2 transition-all duration-300",
            "shadow-[0_4px_0_0_hsl(var(--primary)/0.4)] hover:shadow-[0_2px_0_0_hsl(var(--primary)/0.4)] hover:translate-y-[2px]",
            selectedScenario === null && "opacity-50"
          )}
        >
          <Play className="w-5 h-5" />
          Iniciar Práctica
        </Button>
      </div>

      {/* Selected scenario info */}
      {selectedScenario !== null && (
        <div className="mt-4 text-center animate-fade-in">
          <p className="text-sm text-muted-foreground">
            Escenario seleccionado: <span className="font-semibold text-foreground">
              {prospectingScenarios.find(s => s.id === selectedScenario)?.title}
            </span>
          </p>
        </div>
      )}

      {/* Preview Modal */}
      <ProspectingPreviewModal
        scenario={previewScenario}
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        onStartPractice={handleStartFromModal}
      />
    </div>
  );
};

export default ProspectingCarousel;
