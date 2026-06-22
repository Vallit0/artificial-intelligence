import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api-client";
import { TUTORIAL_EVENT, consumePendingTutorial, clearPendingTutorial } from "@/lib/tutorial";

/**
 * Tour guiado que se dispara en el primer login (mientras
 * `user.tutorialCompleted === false`). Al terminar o saltar, marca el flag en
 * el servidor (POST /users/me/complete-tutorial) y, optimistamente, en el
 * cache local de auth vía `patchUser` — mismo patrón que unlock-level2 — para
 * que no reaparezca dentro de la misma sesión.
 *
 * Los anclajes (`data-tour="..."`) viven en LeftSidebar / MobileNavigation y
 * en Practice.tsx. Sólo resaltamos elementos que existen en el estado `idle`
 * de /practice; los controles de voz y el timer no se montan hasta iniciar una
 * llamada, así que no se incluyen como pasos.
 */
const OnboardingTour = () => {
  const { user, patchUser } = useAuth();
  const isMobile = useIsMobile();
  const [run, setRun] = useState(false);
  // Reproducción manual (botón "Tutorial"): corre el tour aunque el usuario ya
  // lo haya completado. `tourKey` fuerza un Joyride fresco en cada re-arranque.
  const [manualRun, setManualRun] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  // Esperamos a que el perfil cargue y el flag esté explícitamente en false.
  // Si es undefined (respuesta vieja sin el campo) no corremos el tour para no
  // molestar; el siguiente /auth/me ya traerá el valor real.
  const autoRun = !!user && user.tutorialCompleted === false;
  // El tour se monta/renderiza si es el primer login (autoRun) o si lo pidió el
  // botón Tutorial (manualRun).
  const shouldRun = autoRun || manualRun;

  // Arranque manual: dispara el tour desde el paso 0 con un Joyride nuevo.
  const startManual = () => {
    setTourKey((k) => k + 1);
    setManualRun(true);
    // Delay para que el DOM de /practice esté montado antes de calcular spots.
    setTimeout(() => setRun(true), 300);
  };

  // 1) Al montar (p.ej. tras navegar a /practice desde el botón), consume el
  //    flag pendiente. 2) Mientras esté montado, escucha el evento en vivo
  //    (cuando ya estabas en /practice).
  useEffect(() => {
    if (consumePendingTutorial()) startManual();
    const handler = () => {
      clearPendingTutorial();
      startManual();
    };
    window.addEventListener(TUTORIAL_EVENT, handler);
    return () => window.removeEventListener(TUTORIAL_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!autoRun) return;
    // Pequeño delay para que el DOM de /practice termine de montar antes de
    // que Joyride calcule las posiciones de los spotlights.
    const t = setTimeout(() => setRun(true), 600);
    return () => clearTimeout(t);
  }, [autoRun]);

  const steps: Step[] = [
    {
      target: '[data-tour="practice-main"]',
      title: "¡Bienvenido a Señoriales! 👋",
      content:
        "Esta es tu sala de práctica. Acá hablás en tiempo real con un cliente impulsado por IA para entrenar tus ventas, igual que en una llamada real.",
      placement: "center",
      disableBeacon: true,
    },
    {
      target: isMobile ? '[data-tour="nav-mobile"]' : '[data-tour="nav-desktop"]',
      title: "Tu menú de navegación",
      content:
        "Desde acá entrás a Prospección, a la Llamada de práctica, al Examen Final y a Mi Progreso para ver cómo vas avanzando.",
      placement: isMobile ? "top" : "right",
      disableBeacon: true,
    },
    {
      target: '[data-tour="user-menu"]',
      title: "Tu cuenta",
      content:
        "Acá gestionás tu perfil, cambiás tu contraseña y cerrás sesión cuando termines.",
      placement: "bottom",
      disableBeacon: true,
    },
  ];

  const markComplete = () => {
    // Optimista primero: que no reaparezca aunque el POST falle o tarde.
    patchUser({ tutorialCompleted: true });
    api.post("/api/users/me/complete-tutorial").catch((err) => {
      console.warn("complete-tutorial failed:", err);
    });
  };

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      setManualRun(false);
      // Sólo el primer login necesita persistir el flag; en replay manual es
      // idempotente y no molesta.
      if (autoRun) markComplete();
    }
  };

  if (!shouldRun) return null;

  return (
    <Joyride
      key={tourKey}
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      disableScrolling
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

export default OnboardingTour;
