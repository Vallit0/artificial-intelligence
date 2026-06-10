-- AlterTable: marca de finalización del programa (examen final Nivel 2)
ALTER TABLE "users" ADD COLUMN "course_completed" BOOLEAN NOT NULL DEFAULT false;
