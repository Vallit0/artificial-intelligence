-- Firma manuscrita (imagen) del certificado, por firmante y por nivel.
--
-- Se guarda como data URI base64 (data:image/png;base64,...) en columnas TEXT.
-- Nullable (vacío = sólo la línea de firma, sin imagen, como hasta ahora).
-- Simétricas a las columnas `certificate_*_name` existentes.

ALTER TABLE "app_config" ADD COLUMN "certificate_instructor_signature" TEXT;
ALTER TABLE "app_config" ADD COLUMN "certificate_director_signature" TEXT;
ALTER TABLE "app_config" ADD COLUMN "certificate_level1_instructor_signature" TEXT;
ALTER TABLE "app_config" ADD COLUMN "certificate_level1_director_signature" TEXT;
