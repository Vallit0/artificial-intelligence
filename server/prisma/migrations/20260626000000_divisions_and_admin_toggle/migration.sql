-- Divisiones + toggle de acceso admin para coaches.
--
-- Introduce el nivel organizativo "División" dentro de la Sede: una Sede
-- tiene varias Divisiones y cada División tiene UN coach a cargo. Los
-- estudiantes se asignan a una División y heredan su coach (`users.coach_id`
-- se mantiene denormalizado/sincronizado). Además agrega el permiso
-- `can_access_admin` que da a un coach el panel admin global.

-- AlterTable: nuevo permiso de coach
ALTER TABLE "coach_permissions" ADD COLUMN "can_access_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: división del usuario
ALTER TABLE "users" ADD COLUMN "division_id" TEXT;

-- CreateTable: divisions
CREATE TABLE "divisions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "coach_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "divisions_sede_id_name_key" ON "divisions"("sede_id", "name");
CREATE INDEX "divisions_sede_id_idx" ON "divisions"("sede_id");
CREATE INDEX "divisions_coach_id_idx" ON "divisions"("coach_id");
CREATE INDEX "users_division_id_idx" ON "users"("division_id");

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: por cada coach con learners y con sede, crea una división
-- ('División de <email>' — el email es único, así que el nombre es único por
-- sede) cuyo coach es ese coach. Preserva el mapeo coach→learner actual.
INSERT INTO "divisions" ("id", "name", "sede_id", "coach_id", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text,
       'División de ' || c."email",
       c."sede_id",
       c."id",
       true,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "users" c
JOIN "user_roles" r ON r."user_id" = c."id" AND r."role" = 'coach'
WHERE c."sede_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "users" l WHERE l."coach_id" = c."id");

-- Asigna cada learner a la división de su coach actual.
UPDATE "users" l
SET "division_id" = d."id"
FROM "divisions" d
WHERE d."coach_id" = l."coach_id"
  AND l."coach_id" IS NOT NULL;
