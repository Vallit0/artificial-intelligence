-- Cleanup quirúrgico de stress test — SOLO si el cleanup via API falló.
-- Doble condición: email pattern + first_name='STRESSTEST'.
--
-- Ejecutar dentro del contenedor de DB:
--   docker exec -i artificial-intelligence-db-1 psql -U senoriales -d senoriales < tests/load/node/cleanup.sql

BEGIN;

-- Preview: cuántos usuarios stress hay
SELECT COUNT(*) AS stress_users_found
FROM users
WHERE email LIKE 'stress-%@loadtest.local'
  AND first_name = 'STRESSTEST';

-- Borrado (cascade se encarga de user_roles, coach_permissions, refresh_tokens,
-- practice_sessions, user_scenario_progress, lti_sessions, student_grades,
-- password_reset_tokens, advisor_memories, session_summaries, citas)
DELETE FROM users
WHERE email LIKE 'stress-%@loadtest.local'
  AND first_name = 'STRESSTEST';

-- Limpieza de filas huérfanas (AbAssignment y UserScenarioAccess no tienen FK)
-- — sólo borra las que apunten a IDs que ya no existen.
DELETE FROM ab_assignments
WHERE user_id NOT IN (SELECT id FROM users);

DELETE FROM user_scenario_access
WHERE user_id NOT IN (SELECT id FROM users);

-- Verificación post-borrado
SELECT COUNT(*) AS stress_users_remaining
FROM users
WHERE email LIKE 'stress-%@loadtest.local'
  AND first_name = 'STRESSTEST';

COMMIT;
