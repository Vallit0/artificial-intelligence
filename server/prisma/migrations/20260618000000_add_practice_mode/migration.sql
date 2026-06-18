-- AlterTable: persiste el modo de práctica por sesión para desglosar el tiempo
-- en analítica. Valores esperados: 'cliente', 'cliente_prospeccion' (sub-modo
-- de Cliente), 'asesor', 'objeciones', 'coach'. NULL = sesiones previas a esta
-- feature (Sin clasificar); no se backfillea porque el modo no se registraba.
ALTER TABLE "practice_sessions" ADD COLUMN "practice_mode" TEXT;

-- Index para los group-by de analítica por modo.
CREATE INDEX "practice_sessions_practice_mode_idx" ON "practice_sessions"("practice_mode");
