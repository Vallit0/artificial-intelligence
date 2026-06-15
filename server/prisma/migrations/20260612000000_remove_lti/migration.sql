-- Remove LTI / Moodle integration.
--
-- The product no longer integrates with Moodle over LTI 1.3 (no OIDC launch,
-- no NRPS roster sync, no AGS grade push, no Deep Linking). All access is now
-- direct sign-in. Drop every LTI table and the LtiRole enum.
--
-- CASCADE on each table covers the inbound foreign keys (lti_sessions ->
-- users/platforms, lti_course_syncs -> platforms/sedes, lti_pending_matches
-- -> course_syncs, lti_deep_linking_states -> platforms) regardless of drop
-- order. IF EXISTS keeps this idempotent for environments where an LTI table
-- was never created.

DROP TABLE IF EXISTS "lti_deep_linking_states" CASCADE;
DROP TABLE IF EXISTS "lti_launch_states" CASCADE;
DROP TABLE IF EXISTS "lti_pending_matches" CASCADE;
DROP TABLE IF EXISTS "lti_course_syncs" CASCADE;
DROP TABLE IF EXISTS "lti_sessions" CASCADE;
DROP TABLE IF EXISTS "tool_keys" CASCADE;
DROP TABLE IF EXISTS "lti_platforms" CASCADE;

DROP TYPE IF EXISTS "LtiRole";
