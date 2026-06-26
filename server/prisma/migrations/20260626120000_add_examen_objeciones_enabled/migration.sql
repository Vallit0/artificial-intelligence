-- Gate del examen final de Objeciones (Nivel 2).
--
-- Hasta ahora el examen de Objeciones no tenía candado (cualquier usuario lo
-- tomaba). Se agrega `examen_objeciones_enabled` (espejo de
-- `examen_final_enabled`, que gatea Prospección). Default false = bloqueado
-- para TODOS hasta que un admin o el coach asignado lo habilite.

ALTER TABLE "users" ADD COLUMN "examen_objeciones_enabled" BOOLEAN NOT NULL DEFAULT false;
