-- AlterTable: nombre/descripción/video del carrusel editables por escenario de
-- prospección. NULL = usa el valor por defecto definido en código
-- (prospectingScenarios en ProspectingCarousel.tsx). Sólo aplican a los
-- escenarios de prospección; los agentes de Nivel 1/2 los ignoran.
ALTER TABLE "prospecting_scenario_configs" ADD COLUMN "description" TEXT;
ALTER TABLE "prospecting_scenario_configs" ADD COLUMN "video_url" TEXT;
