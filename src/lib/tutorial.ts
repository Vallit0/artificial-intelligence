// ============================================
// Bus de eventos del sistema de tutoriales guiados
// ============================================
// Dos piezas globales lo escuchan (montadas una sola vez en App):
//   - TutorialCenter: el menú que lista los tutoriales por pantalla.
//   - TourRunner: corre Joyride para un tour concreto (navega a su ruta).
//
// Los botones del producto abren el MENÚ (no un tour fijo), para que el usuario
// elija qué pantalla quiere ver:
//   - Botón "Tutorial" (nav)        → startTutorial()      → menú de usuario.
//   - Botón "Ver tutorial" (admin)  → startAdminTutorial() → menú de admin.

import type { TutorialGroup } from "@/lib/tutorialTours";

export const TUTORIAL_CENTER_EVENT = "senoriales:open-tutorial-center";
export const RUN_TOUR_EVENT = "senoriales:run-tour";

let pendingCenter: TutorialGroup | null = null;
let pendingTour: string | null = null;

/** Abre el centro de tutoriales para una pista (usuario o admin). */
export function openTutorialCenter(group: TutorialGroup = "user"): void {
  pendingCenter = group;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(TUTORIAL_CENTER_EVENT, { detail: { group } })
    );
  }
}

/** Consume la pista pendiente (por si el listener se montó tarde). */
export function consumePendingCenter(): TutorialGroup | null {
  const g = pendingCenter;
  pendingCenter = null;
  return g;
}

/** Back-compat: el botón "Tutorial" del nav abre el menú de usuario. */
export function startTutorial(): void {
  openTutorialCenter("user");
}

/** El botón "Ver tutorial" del panel abre el menú de administrador. */
export function startAdminTutorial(): void {
  openTutorialCenter("admin");
}

/** Pide correr un tour concreto por id (lo atiende TourRunner). */
export function startTour(id: string): void {
  pendingTour = id;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RUN_TOUR_EVENT, { detail: { id } }));
  }
}

/** Consume el tour pendiente (por si el listener se montó tarde). */
export function consumePendingTour(): string | null {
  const id = pendingTour;
  pendingTour = null;
  return id;
}
