-- Tiempo mínimo de práctica (segundos) requerido antes de habilitar cada examen.
-- 0 = sin requisito (comportamiento previo). Se suma al toggle por-estudiante.
ALTER TABLE "app_config"
  ADD COLUMN "min_practice_seconds_prospeccion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "min_practice_seconds_objeciones" INTEGER NOT NULL DEFAULT 0;
