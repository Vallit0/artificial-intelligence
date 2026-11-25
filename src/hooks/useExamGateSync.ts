import { useEffect, useRef } from "react";

// ============================================
// Revalidación de los insumos del gate del examen
// ============================================
//
// El estado "¿puedo rendir?" depende de tres cosas que cambian FUERA de la
// pestaña del alumno:
//
//   1. `user.examenFinalEnabled` / `examenObjecionesEnabled` — un instructor
//      puede prender el toggle en cualquier momento. Vive en el contexto de
//      auth, que sobrevive a los cambios de ruta: sin refrescarlo a mano, el
//      alumno tendría que cerrar sesión y volver a entrar para ver el cambio.
//   2. `minPracticeSeconds*` (AppConfig) — el admin puede mover el umbral.
//   3. Las sesiones de práctica acumuladas, que definen el auto-desbloqueo.
//
// Este hook los revalida cuando la pestaña vuelve a estar visible/enfocada y,
// mientras siga visible, cada `intervalMs`. No refresca en segundo plano: si la
// pestaña está oculta no tiene sentido gastar requests.

const DEFAULT_INTERVAL_MS = 60_000;

export function useExamGateSync(
  refresh: () => void | Promise<void>,
  options: { intervalMs?: number; enabled?: boolean } = {},
): void {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;

  // Guardamos la última closure en un ref para no re-suscribir los listeners en
  // cada render (los callbacks de refetch cambian de identidad seguido).
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const run = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void refreshRef.current();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = window.setInterval(run, intervalMs);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs]);
}
