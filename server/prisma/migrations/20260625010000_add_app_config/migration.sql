-- CreateTable: configuración global de la plataforma (singleton). Los defaults
-- replican los valores que antes estaban fijos en código.
CREATE TABLE "app_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "call_duration_prospeccion_sec" INTEGER NOT NULL DEFAULT 300,
    "call_duration_objeciones_sec" INTEGER NOT NULL DEFAULT 600,
    "pass_threshold_prospeccion" INTEGER NOT NULL DEFAULT 75,
    "pass_threshold_objeciones" INTEGER NOT NULL DEFAULT 80,
    "certificate_instructor_name" TEXT,
    "certificate_director_name" TEXT,
    "certificate_course_name" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);
