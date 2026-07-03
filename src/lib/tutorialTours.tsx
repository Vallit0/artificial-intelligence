// ============================================
// Registro de tutoriales guiados (react-joyride)
// ============================================
// Cada "tour" es un recorrido independiente sobre UNA pantalla, segmentado por
// funcionalidad. Se agrupan en dos pistas: "user" (asesor) y "admin".
//
// El menú (TutorialCenter) los lista y, al elegir uno, dispara startTour(id).
// El runner global (TourRunner) navega a la ruta del tour y corre Joyride con
// sus pasos. Los anclajes (`data-tour="..."`) viven en cada pantalla/componente.
//
// Nota de mensaje: el producto entrena para PROTEGER FAMILIAS, no para "vender".
// Los textos se redactan en ese marco.

import type { Step } from "react-joyride";

export type TutorialGroup = "user" | "admin";

export interface TutorialTour {
  id: string;
  group: TutorialGroup;
  /** Ruta donde corre el tour (el runner navega ahí si hace falta). */
  route: string;
  emoji: string;
  label: string;
  description: string;
  /** true = requiere sesión (ruta protegida). */
  auth?: boolean;
  /** Pasos de Joyride; función de isMobile porque el nav difiere. */
  steps: (isMobile: boolean) => Step[];
}

// Todos los pasos comparten estas opciones base.
const base = (s: Omit<Step, "disableBeacon">): Step => ({ disableBeacon: true, ...s });

const navTarget = (isMobile: boolean) =>
  isMobile ? '[data-tour="nav-mobile"]' : '[data-tour="nav-desktop"]';

// ---------------------------------------------------------------------------
// PISTA USUARIO (asesor)
// ---------------------------------------------------------------------------
export const USER_TOURS: TutorialTour[] = [
  {
    id: "practice",
    group: "user",
    route: "/practice",
    emoji: "🎧",
    label: "Sala de Práctica",
    description: "Los modos de entrenamiento y cómo navegar la plataforma.",
    steps: (isMobile) => [
      base({
        target: '[data-tour="practice-main"]',
        title: "Tu sala de práctica 🎧",
        content:
          "Acá entrenás en tiempo real con un cliente impulsado por IA. Practicás la conversación para proteger a más familias, igual que en una cita real.",
        placement: "center",
      }),
      base({
        target: '[data-tour="practice-modes"]',
        title: "Elegí cómo practicar",
        content:
          "Cada tarjeta es un modo: el Coach te da feedback en vivo, el Role-Play te pone frente a un cliente, y desde acá también entrás a Prospección y al Examen Final.",
        placement: "top",
      }),
      base({
        target: navTarget(isMobile),
        title: "Tu menú de navegación",
        content:
          "Desde acá te movés entre Prospección, la Llamada de práctica, el Examen Final y Mi Progreso.",
        placement: isMobile ? "top" : "right",
      }),
      base({
        target: '[data-tour="user-menu"]',
        title: "Tu cuenta",
        content:
          "Gestionás tu perfil, cambiás tu contraseña y cerrás sesión cuando termines.",
        placement: "bottom",
      }),
    ],
  },
  {
    id: "prospecting",
    group: "user",
    route: "/prospecting",
    emoji: "🚶",
    label: "Prospección",
    description: "Escenarios de abordaje en calle y en campo.",
    auth: true,
    steps: () => [
      base({
        target: '[data-tour="prospecting-header"]',
        title: "Escenarios de prospección 🚶",
        content:
          "Practicá el abordaje en la calle y en campo: cómo iniciar la conversación con un prospecto real.",
        placement: "center",
      }),
      base({
        target: '[data-tour="prospecting-carousel"]',
        title: "Elegí un escenario",
        content:
          "Deslizá entre los casos (supermercado, centro comercial, restaurante, parqueo...) y tocá el que quieras practicar.",
        placement: "bottom",
      }),
      base({
        target: '[data-tour="prospecting-start"]',
        title: "Iniciá la práctica",
        content:
          "Con un escenario seleccionado, tocá «Iniciar Práctica» para ver la vista previa y arrancar la conversación.",
        placement: "top",
      }),
    ],
  },
  {
    id: "progress",
    group: "user",
    route: "/progress",
    emoji: "📊",
    label: "Mi Progreso",
    description: "KPIs, avance de certificación, logros y sesiones.",
    auth: true,
    steps: () => [
      base({
        target: '[data-tour="progress-kpis"]',
        title: "Tu progreso, medido 📊",
        content:
          "De un vistazo ves tu tiempo total de práctica, sesiones, racha de días y promedio de estrellas.",
        placement: "bottom",
      }),
      base({
        target: '[data-tour="progress-cert"]',
        title: "Avance hacia tu certificación",
        content:
          "Esta barra mide el tiempo de Role-Play Cliente que necesitás acumular para certificarte.",
        placement: "top",
      }),
      base({
        target: '[data-tour="progress-logros"]',
        title: "Logros",
        content:
          "Vas desbloqueando insignias a medida que practicás y aprobás tus exámenes.",
        placement: "top",
      }),
      base({
        target: '[data-tour="progress-recientes"]',
        title: "Sesiones recientes",
        content:
          "Tocá cualquier sesión para volver a escuchar su repaso y revisar tu puntaje.",
        placement: "top",
      }),
    ],
  },
  {
    id: "examen",
    group: "user",
    route: "/quests",
    emoji: "🎓",
    label: "Examen Final",
    description: "Cómo funciona tu evaluación final y sus criterios.",
    auth: true,
    steps: () => [
      base({
        target: '[data-tour="examen-header"]',
        title: "Examen Final 🎓",
        content:
          "Tu evaluación final: una conversación con un cliente donde aplicás todo lo aprendido.",
        placement: "center",
      }),
      base({
        target: '[data-tour="examen-criterios"]',
        title: "Criterios de evaluación",
        content:
          "Te evaluamos en apertura, escucha activa, manejo de objeciones, propuesta de valor y técnica de cierre.",
        placement: "top",
      }),
      base({
        target: '[data-tour="examen-start"]',
        title: "Comenzá cuando estés listo",
        content:
          "Buscá un lugar tranquilo, revisá tu micrófono y tocá «Comenzar Examen». Una vez iniciado no se puede pausar.",
        placement: "top",
      }),
    ],
  },
];

// ---------------------------------------------------------------------------
// PISTA ADMINISTRADOR
// ---------------------------------------------------------------------------
export const ADMIN_TOURS: TutorialTour[] = [
  {
    id: "admin-overview",
    group: "admin",
    route: "/admin",
    emoji: "🛡️",
    label: "Panel — Visión general",
    description: "Recorrido por todas las áreas del panel de administración.",
    auth: true,
    steps: () => [
      base({
        target: '[data-tour="admin-header"]',
        title: "Panel de Administrador 🛡️",
        content:
          "Desde acá gestionás estudiantes, sedes, coaches, divisiones, escenarios y las analíticas de toda la plataforma.",
        placement: "center",
      }),
      base({
        target: '[data-tour="admin-tabs"]',
        title: "Áreas del panel",
        content:
          "Cada pestaña es un área: Estudiantes, Pendientes, Sedes, Divisiones, Coaches, Analíticas, Agentes IA, Prospección y Configuración.",
        placement: "bottom",
      }),
    ],
  },
  {
    id: "admin-students",
    group: "admin",
    route: "/admin",
    emoji: "👥",
    label: "Gestión de Estudiantes",
    description: "Habilitar exámenes, asignar coach y emitir certificados.",
    auth: true,
    steps: () => [
      base({
        target: '[data-tour="admin-new-user"]',
        title: "Crear usuarios",
        content:
          "Creá un estudiante o un coach nuevo. Para muchos a la vez, usá «Carga Masiva» con la plantilla de Excel.",
        placement: "bottom",
      }),
      base({
        target: '[data-tour="admin-students-table"]',
        title: "Gestión de estudiantes",
        content:
          "Para cada asesor podés habilitar sus exámenes, asignarle coach y división, editar su cuenta, calificarlo y emitir sus certificados por nivel.",
        placement: "top",
      }),
    ],
  },
  {
    id: "coach-center",
    group: "admin",
    route: "/coach-center",
    emoji: "🗓️",
    label: "Coach Center",
    description: "El calendario de citas de los asesores.",
    auth: true,
    steps: () => [
      base({
        target: '[data-tour="coach-header"]',
        title: "Coach Center 🗓️",
        content:
          "El calendario de citas de tus asesores: acá organizás y das seguimiento a sus reuniones.",
        placement: "center",
      }),
      base({
        target: '[data-tour="coach-calendar"]',
        title: "Agenda semanal",
        content:
          "Filtrá por director y prioridad, navegá entre semanas y creá una cita nueva con «+ Nueva Cita».",
        placement: "bottom",
      }),
    ],
  },
];

export const ALL_TOURS: TutorialTour[] = [...USER_TOURS, ...ADMIN_TOURS];

export function getTour(id: string): TutorialTour | undefined {
  return ALL_TOURS.find((t) => t.id === id);
}

export function toursForGroup(group: TutorialGroup): TutorialTour[] {
  return ALL_TOURS.filter((t) => t.group === group);
}
