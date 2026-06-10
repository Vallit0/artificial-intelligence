-- AlterTable: distingue los dos exámenes finales (ambos con scenario_id NULL).
-- null = práctica normal; 'prospeccion' = Examen Final Prospección (Nivel 1);
-- 'objeciones' = Examen Final Manejo de Objeciones (Nivel 2).
ALTER TABLE "practice_sessions" ADD COLUMN "exam_type" TEXT;
