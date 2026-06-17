-- Flujo de auto-registro con aprobación.
-- Los usuarios que se auto-registran nacen `pending` y no pueden iniciar
-- sesión hasta que un admin global o el coach de su sede los apruebe.

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "users" ADD COLUMN "approved_by" TEXT;
ALTER TABLE "users" ADD COLUMN "approved_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "rejected_reason" TEXT;

-- Backfill: todos los usuarios preexistentes son de antes del flujo de
-- aprobación; márcalos approved para que no queden bloqueados al loguear.
-- El default 'pending' aplica sólo a los registros nuevos a partir de aquí.
UPDATE "users" SET "status" = 'approved';

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
