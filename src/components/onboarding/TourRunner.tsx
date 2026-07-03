import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api-client";
import { RUN_TOUR_EVENT, consumePendingTour } from "@/lib/tutorial";
import { getTour } from "@/lib/tutorialTours";

/**
 * Runner ÚNICO de tutoriales guiados (react-joyride), montado una sola vez en
 * App. Reemplaza a los antiguos OnboardingTour/AdminTour: corre cualquier tour
 * del registro (por pantalla, segmentado) y también los auto-arranques.
 *
 * Al pedir un tour (startTour(id) → RUN_TOUR_EVENT):
 *   1. Si no estás en su ruta, navega ahí.
 *   2. Espera a que el primer anclaje (`data-tour`) exista en el DOM —
 *      las pantallas con datos async (Progreso, Prospección) montan tarde.
 *   3. Arranca Joyride con los pasos de ese tour.
 *
 * Auto-arranque (una vez por sesión):
 *   - En /practice, si el perfil trae `tutorialCompleted === false` (primer
 *     login) → corre el tour "practice" y persiste el flag al terminar.
 *   - En /admin, si no está el flag en localStorage → corre "admin-overview".
 */

const ADMIN_DONE_KEY = "senoriales:admin-tutorial-done";

// Espera (poll) a que aparezca el selector; arranca igual pasado el timeout.
function waitForTarget(selector: string, cb: () => void): () => void {
  let tries = 0;
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    if (typeof document !== "undefined" && document.querySelector(selector)) {
      cb();
      return;
    }
    if (tries++ > 26) {
      cb(); // ~4s: arranca de todos modos (Joyride avisará si falta)
      return;
    }
    timer = setTimeout(tick, 150);
  };
  timer = setTimeout(tick, 150);
  return () => clearTimeout(timer);
}

const TourRunner = () => {
  const { user, patchUser } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tourKey, setTourKey] = useState(0);

  // id del tour que espera a que su ruta/DOM esté listo.
  const [pendingId, setPendingId] = useState<string | null>(null);
  // callback a ejecutar al terminar (p.ej. persistir flag de primer login).
  const onFinishRef = useRef<null | (() => void)>(null);
  // guardas para no auto-arrancar dos veces por sesión.
  const autoRan = useRef<{ practice: boolean; admin: boolean }>({
    practice: false,
    admin: false,
  });
  const cancelWaitRef = useRef<null | (() => void)>(null);

  // Lanza un tour: fija pasos, espera el primer anclaje y arranca.
  const launch = (id: string, onFinish?: () => void) => {
    const tour = getTour(id);
    if (!tour) return;
    const stepList = tour.steps(isMobile);
    if (stepList.length === 0) return;
    onFinishRef.current = onFinish ?? null;
    setSteps(stepList);
    setRun(false);
    cancelWaitRef.current?.();
    const firstTarget =
      typeof stepList[0].target === "string" ? stepList[0].target : "body";
    cancelWaitRef.current = waitForTarget(firstTarget, () => {
      setTourKey((k) => k + 1);
      setRun(true);
    });
  };

  // 1) Petición manual de un tour concreto.
  useEffect(() => {
    // Consume cualquier petición previa a que montáramos.
    const early = consumePendingTour();
    if (early) requestTour(early);

    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) requestTour(id);
    };
    window.addEventListener(RUN_TOUR_EVENT, handler);
    return () => {
      window.removeEventListener(RUN_TOUR_EVENT, handler);
      cancelWaitRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestTour = (id: string) => {
    const tour = getTour(id);
    if (!tour) return;
    if (location.pathname !== tour.route) {
      setPendingId(id); // la navegación disparará el arranque
      navigate(tour.route);
    } else {
      launch(id);
    }
  };

  // 2) Cuando cambia la ruta, si hay un tour pendiente para esta ruta, arranca.
  useEffect(() => {
    if (!pendingId) return;
    const tour = getTour(pendingId);
    if (tour && tour.route === location.pathname) {
      launch(pendingId);
      setPendingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, pendingId]);

  // 3) Auto-arranque por ruta (primer login / primera visita de admin).
  useEffect(() => {
    if (run || pendingId) return;

    if (
      location.pathname === "/practice" &&
      !autoRan.current.practice &&
      user &&
      user.tutorialCompleted === false
    ) {
      autoRan.current.practice = true;
      launch("practice", () => {
        patchUser({ tutorialCompleted: true });
        api
          .post("/api/users/me/complete-tutorial")
          .catch((err) => console.warn("complete-tutorial failed:", err));
      });
      return;
    }

    if (
      location.pathname === "/admin" &&
      !autoRan.current.admin &&
      typeof window !== "undefined" &&
      !localStorage.getItem(ADMIN_DONE_KEY)
    ) {
      autoRan.current.admin = true;
      launch("admin-overview", () => {
        localStorage.setItem(ADMIN_DONE_KEY, "1");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      const cb = onFinishRef.current;
      onFinishRef.current = null;
      cb?.();
    }
  };

  if (!run || steps.length === 0) return null;

  return (
    <Joyride
      key={tourKey}
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      disableScrolling
      scrollToFirstStep={false}
      callback={handleCallback}
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "¡Listo!",
        next: "Siguiente",
        skip: "Saltar",
      }}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          textColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--background))",
          arrowColor: "hsl(var(--background))",
          zIndex: 10000,
        },
      }}
    />
  );
};

export default TourRunner;
