-- Certificado de NIVEL 1 (Prospección) parametrizable.
--
-- Hasta ahora AppConfig sólo tenía los datos de un único certificado (el de
-- Nivel 2 / Objeciones, columnas `certificate_*` sin sufijo). Se agregan tres
-- columnas para el certificado de Nivel 1, simétricas a las existentes.
-- Nullable (vacío = línea de firma/curso sin nombre, igual que el de Nivel 2).

ALTER TABLE "app_config" ADD COLUMN "certificate_level1_instructor_name" TEXT;
ALTER TABLE "app_config" ADD COLUMN "certificate_level1_director_name" TEXT;
ALTER TABLE "app_config" ADD COLUMN "certificate_level1_course_name" TEXT;
