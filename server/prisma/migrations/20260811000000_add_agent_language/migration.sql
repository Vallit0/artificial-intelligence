-- Idioma global de los agentes de voz (ElevenLabs). 'es' = comportamiento
-- histórico (agentes en español). 'en' = la app manda el override
-- `overrides.agent.language = "en"` al iniciar cada conversación, con lo que
-- ASR/TTS y el agente pasan a inglés. Requiere que cada agente tenga habilitado
-- el override de "Language" en su pestaña Security de ElevenLabs.
ALTER TABLE "app_config"
  ADD COLUMN "agent_language" TEXT NOT NULL DEFAULT 'es';
