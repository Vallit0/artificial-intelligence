import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";

/**
 * Tour guiado específico para administradores de sitio. A diferencia del
 * OnboardingTour del alumno (que persiste el flag en el servidor), este se
 * marca como visto en localStorage: es una ayuda de la consola, no parte del
 * perfil. Auto-corre la primera vez que un admin entra al panel y puede
 * reproducirse desde el botón "Ver tutorial" de la cabecera.
 *
 * Los anclajes (`data-tour="admin-*"`) viven en Admin.tsx.
 */
export const ADMIN_TUTORIAL_EVENT = "senoriales:start-admin-tutorial";
const STORAGE_KEY = "senoriales:admin-tutorial-done";

/** Pide reproducir el tutorial de admin (lo escucha AdminTour si está montado). */
export function startAdminTutorial(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_TUTORIAL_EVENT));
  }
}

const AdminTour = () => {
  const [run, setRun] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  const start = () => {
    setTourKey((k) => k + 1);
    // Delay para que el DOM del panel esté montado antes de calcular spots.
    setTimeout(() => setRun(true), 300);
  };

  useEffect(() => {
    // Auto-run en la primera visita (flag no seteado en localStorage).
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      start();
    }
    const handler = () => start();
    window.addEventListener(ADMIN_TUTORIAL_EVENT, handler);
    return () => window.removeEventListener(ADMIN_TUTORIAL_EVENT, handler);
  }, []);

  const steps: Step[] = [
    {
      target: '[data-tour="admin-header"]',
      title: "Panel de Administrador 🛡️",
      content:
        "Desde acá gestionás a los estudiantes, las sedes, los coaches, los escenarios de prospección y las analíticas de toda la plataforma.",
      placement: "center",
      disableBeacon: true,
    },
    {
      target: '[data-tour="admin-tabs"]',
      title: "Pestañas del panel",
      content:
        "Cada pestaña es un área: Estudiantes, Pendientes de aprobación, Sedes, Coaches, Analíticas, Agentes IA y Prospección (donde editás los textos y prompts de los escenarios).",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tour="admin-new-user"]',
      title: "Crear usuarios",
      content:
        "Creá un estudiante o un coach nuevo. Para cargar muchos de una vez, usá «Carga Masiva» con una plantilla de Excel.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tour="admin-students-table"]',
      title: "Gestión de estudiantes",
      content:
        "Para cada estudiante podés habilitar el Examen Final, asignarle un coach, editar su cuenta, resetear su contraseña, calificarlo y emitir su certificado.",
      placement: "top",
      disableBeacon: true,
    },
  ];

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
    }
  };

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

export default AdminTour;
