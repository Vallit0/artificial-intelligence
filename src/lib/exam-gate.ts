// ============================================
// Gate de habilitación de exámenes (lógica compartida)
// ============================================
//
// Un examen se habilita por CUALQUIERA de estas vías (OR, no AND):
//
//   1. Toggle manual: un admin/coach prendió examenFinalEnabled /
//      examenObjecionesEnabled para ese estudiante.
//   2. Auto-desbloqueo por tiempo: el estudiante acumuló el mínimo de práctica
//      del nivel configurado en AppConfig (minPracticeSeconds*).
//   3. Bypass QA (examPracticeBypass): cuenta como requisito de práctica
//      cumplido. Default false — sólo lo tiene quien un admin marcó a mano.
//
// OJO con el mínimo en 0: `0` significa "auto-desbloqueo NO configurado", no
// "requisito cumplido". Si se tratara como cumplido, un OR literal abriría el
// examen a TODOS los estudiantes en cuanto el admin dejara el campo en 0 (que
// es el default). Con 0 sólo desbloquean el toggle manual o el bypass.

export interface ExamGateInput {
  /** Los admin globales ven el examen siempre. */
  isAdmin: boolean;
  /** Toggle por estudiante del examen de ese nivel. */
  examEnabled: boolean;
  /** users.exam_practice_bypass (QA/testing). */
  practiceBypass: boolean;
  /** Segundos de práctica acumulados del nivel (excluye intentos de examen). */
  practiceSeconds: number;
  /** Mínimo configurado en AppConfig para ese nivel. 0 = sin auto-desbloqueo. */
  minPracticeSeconds: number;
}

export interface ExamGateResult {
  /** El estudiante no puede rendir. */
  isLocked: boolean;
  /** Hay un auto-desbloqueo por tiempo configurado (mínimo > 0). */
  hasAutoUnlock: boolean;
  /** Se desbloqueó por tiempo (o por bypass), sin necesidad del toggle. */
  autoUnlocked: boolean;
  /** Segundos de práctica que faltan. 0 si ya cumplió o si no hay auto-desbloqueo. */
  remainingSeconds: number;
  /** Los mismos segundos redondeados hacia arriba a minutos. */
  remainingMinutes: number;
}

export function evaluateExamGate(input: ExamGateInput): ExamGateResult {
  const hasAutoUnlock = input.minPracticeSeconds > 0;
  const remainingSeconds = hasAutoUnlock
    ? Math.max(0, input.minPracticeSeconds - input.practiceSeconds)
    : 0;
  const autoUnlocked = input.practiceBypass || (hasAutoUnlock && remainingSeconds === 0);
  const isLocked = !input.isAdmin && !input.examEnabled && !autoUnlocked;

  return {
    isLocked,
    hasAutoUnlock,
    autoUnlocked,
    remainingSeconds,
    remainingMinutes: Math.ceil(remainingSeconds / 60),
  };
}
