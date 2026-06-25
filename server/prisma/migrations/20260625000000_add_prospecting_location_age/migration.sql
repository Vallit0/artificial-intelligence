-- AlterTable: ubicación y edad objetivo del carrusel editables por escenario de
-- prospección. NULL = usa el valor por defecto definido en código
-- (prospectingScenarios en ProspectingCarousel.tsx). Sólo aplican a los
-- escenarios de prospección; los agentes de Nivel 1/2 los ignoran.
ALTER TABLE "prospecting_scenario_configs" ADD COLUMN "location" TEXT;
ALTER TABLE "prospecting_scenario_configs" ADD COLUMN "target_age" TEXT;
