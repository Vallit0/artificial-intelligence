// ============================================
// Disparador global del tutorial guiado (botón "Tutorial")
// ============================================
// El tour vive en OnboardingTour (react-joyride) y sus anclajes (data-tour)
// están en /practice. Un botón en el nav puede pedir reproducir el tour aunque
// el usuario ya lo haya completado.
//
// Dos caminos cubiertos:
//   1. Ya estás en /practice → OnboardingTour está montado y escucha el evento.
//   2. Estás en otra vista → el botón navega a /practice; OnboardingTour, al
//      montarse, consume el flag `pending` y arranca.

export const TUTORIAL_EVENT = "senoriales:start-tutorial";

let pending = false;

/** Pide arrancar el tutorial: setea el flag y notifica a instancias ya montadas. */
export function startTutorial(): void {
  pending = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TUTORIAL_EVENT));
  }
}

/** Consume el flag pendiente (lo usa OnboardingTour al montarse). */
export function consumePendingTutorial(): boolean {
  if (pending) {
    pending = false;
    return true;
  }
  return false;
}

/** Limpia el flag sin arrancar (cuando el evento ya fue atendido en vivo). */
export function clearPendingTutorial(): void {
  pending = false;
}
