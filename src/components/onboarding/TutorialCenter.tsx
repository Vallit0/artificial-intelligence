import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  TUTORIAL_CENTER_EVENT,
  consumePendingCenter,
  startTour,
} from "@/lib/tutorial";
import {
  toursForGroup,
  type TutorialGroup,
  type TutorialTour,
} from "@/lib/tutorialTours";

/**
 * Menú de tutoriales guiados. Lista los recorridos por pantalla de una pista
 * (usuario o admin). Al elegir uno, cierra el menú y dispara el tour, que corre
 * sobre la pantalla real vía TourRunner.
 *
 * Se abre con openTutorialCenter(group) — lo llaman los botones "Tutorial"
 * (usuario) y "Ver tutorial" (admin). Montado una sola vez en App.
 */

const GROUP_TITLE: Record<TutorialGroup, string> = {
  user: "Tutoriales de la plataforma",
  admin: "Tutoriales de administración",
};
const GROUP_SUBTITLE: Record<TutorialGroup, string> = {
  user: "Elegí una pantalla para ver su guía paso a paso.",
  admin: "Elegí un área del panel para ver su guía paso a paso.",
};

const TutorialCenter = () => {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<TutorialGroup>("user");

  useEffect(() => {
    const early = consumePendingCenter();
    if (early) {
      setGroup(early);
      setOpen(true);
    }
    const handler = (e: Event) => {
      const g = (e as CustomEvent<{ group: TutorialGroup }>).detail?.group;
      setGroup(g ?? "user");
      setOpen(true);
    };
    window.addEventListener(TUTORIAL_CENTER_EVENT, handler);
    return () => window.removeEventListener(TUTORIAL_CENTER_EVENT, handler);
  }, []);

  const tours = toursForGroup(group);

  const pick = (tour: TutorialTour) => {
    setOpen(false);
    // Pequeño respiro para que el modal cierre antes de arrancar el tour.
    setTimeout(() => startTour(tour.id), 250);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{GROUP_TITLE[group]}</DialogTitle>
          <DialogDescription>{GROUP_SUBTITLE[group]}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {tours.map((tour) => (
            <button
              key={tour.id}
              onClick={() => pick(tour)}
              className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card text-left transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
            >
              <span className="text-2xl leading-none mt-0.5">{tour.emoji}</span>
              <span className="min-w-0">
                <span className="block font-bold text-sm text-foreground">
                  {tour.label}
                </span>
                <span className="block text-xs text-muted-foreground leading-relaxed">
                  {tour.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialCenter;
