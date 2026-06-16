-- AlterTable: marca de finalización del tour guiado del primer login.
-- Default false para todos: los usuarios existentes verán el tour como
-- reintroducción a la plataforma en su próximo login.
ALTER TABLE "users" ADD COLUMN "tutorial_completed" BOOLEAN NOT NULL DEFAULT false;
