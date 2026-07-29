-- Bypass del tiempo mínimo de práctica para rendir exámenes (QA/testing).
--
-- El gate `min_practice_seconds_*` (AppConfig) exige que el estudiante acumule
-- cierto tiempo de práctica del nivel antes de rendir cada examen. Este flag
-- por-usuario permite saltar ESE requisito para un estudiante puntual (p. ej.
-- para testear el flujo de examen sin practicar). NO habilita el examen por sí
-- solo: `examen_final_enabled` / `examen_objeciones_enabled` siguen mandando.
-- Default false = nadie lo tiene salvo que un admin lo active explícitamente.

ALTER TABLE "users" ADD COLUMN "exam_practice_bypass" BOOLEAN NOT NULL DEFAULT false;
