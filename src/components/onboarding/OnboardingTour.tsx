import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api-client";

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

  // Esperamos a que el perfil cargue y el flag esté explícitamente en false.
  // Si es undefined (respuesta vieja sin el campo) no corremos el tour para no
  // molestar; el siguiente /auth/me ya traerá el valor real.
  const shouldRun = !!user && user.tutorialCompleted === false;

  useEffect(() => {
    if (!shouldRun) {
      setRun(false);
      return;
    }
    // Pequeño delay para que el DOM de /practice termine de montar antes de
    // que Joyride calcule las posiciones de los spotlights.
    const t = setTimeout(() => setRun(true), 600);
    return () => clearTimeout(t);
  }, [shouldRun]);

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
      markComplete();
    }
  };

  if (!shouldRun) return null;

  return (
    <Joyride
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
