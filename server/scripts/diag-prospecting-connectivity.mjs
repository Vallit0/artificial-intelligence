// ============================================
// Diagnóstico de CONECTIVIDAD de agentes de prospección
// --------------------------------------------
// Extiende diag-agent-routing.mjs: además de resolver a qué agentId cae cada
// escenario (DB -> env -> default), hace la MISMA llamada read-only que la app
// (GET /v1/convai/conversation/get-signed-url) para confirmar si ese agente
// realmente conecta con ElevenLabs. Resuelve la API key igual que la app:
// AgentConfig(secretName='ELEVENLABS_API_KEY') en DB primero, luego env var.
//
// Corre DENTRO del contenedor del server (donde la DB es alcanzable y la key
// de prod está resuelta):
//
//   docker compose exec app node server/scripts/diag-prospecting-connectivity.mjs
//   # o, si el cwd ya es /app/server:  node scripts/diag-prospecting-connectivity.mjs
//
// No modifica nada. Sólo lee DB + hace GETs read-only a ElevenLabs.
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SIGNED_URL = 'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url';
const TIMEOUT_MS = 12_000;

// Escenarios de prospección en el ORDEN que ve el alumno en el carrusel.
// Mantener en sync con src/components/prospecting/ProspectingCarousel.tsx.
const PROSPECTING = [
  { n: 1, title: 'Pareja en la Fila de Caja', secret: 'ELEVENLABS_AGENT_PROSPECTING_PAREJA' },
  { n: 2, title: 'Señora en Frutas y Verduras', secret: 'ELEVENLABS_AGENT_PROSPECTING_FRUTAS' },
  { n: 3, title: 'Familia en Stand', secret: 'ELEVENLABS_AGENT_FAMILIA' },
  { n: 4, title: 'Señor en Neumáticos', secret: 'ELEVENLABS_AGENT_PROSPECTING_NEUMATICOS' },
  { n: 5, title: 'Profesional en Restaurante', secret: 'ELEVENLABS_AGENT_PROSPECTING_RESTAURANTE' },
  { n: 6, title: 'Señor en el Parqueo', secret: 'ELEVENLABS_AGENT_PROSPECTING_PARQUEO' },
  { n: 7, title: 'Profesional Caminando', secret: 'ELEVENLABS_AGENT_PROSPECTING_CAMINANDO' },
  { n: 8, title: 'Señora de Compras (Stand 1)', secret: 'ELEVENLABS_AGENT_STAND1' },
  { n: 9, title: 'Persona en Cementerio', secret: 'ELEVENLABS_AGENT_PROSPECTING_CEMENTERIO' },
];

async function resolveApiKey(acMap) {
  const db = acMap.get('ELEVENLABS_API_KEY');
  if (db && db.isActive && db.agentId) return { key: db.agentId, source: 'DB' };
  if (process.env.ELEVENLABS_API_KEY) return { key: process.env.ELEVENLABS_API_KEY, source: 'ENV' };
  return { key: '', source: '(NINGUNA)' };
}

function resolveAgentId(secret, acMap, def) {
  const db = acMap.get(secret);
  if (db && db.isActive && db.agentId) return { agentId: db.agentId, src: 'DB' };
  if (process.env[secret]) return { agentId: process.env[secret], src: 'ENV' };
  return { agentId: def, src: 'FALLBACK->DEFAULT' };
}

async function probeSignedUrl(apiKey, agentId) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(`${SIGNED_URL}?agent_id=${encodeURIComponent(agentId)}`, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
      signal: ctrl.signal,
    });
    const ms = Date.now() - start;
    if (res.ok) return { ok: true, code: res.status, ms };
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail?.message || body?.detail?.status || JSON.stringify(body).slice(0, 120);
    } catch {
      detail = `HTTP ${res.status}`;
    }
    return { ok: false, code: res.status, ms, detail };
  } catch (e) {
    return { ok: false, code: 0, ms: Date.now() - start, detail: e.name === 'AbortError' ? `timeout ${TIMEOUT_MS}ms` : e.message };
  } finally {
    clearTimeout(t);
  }
}

try {
  const ac = await prisma.agentConfig.findMany({ select: { secretName: true, agentId: true, isActive: true } });
  const acMap = new Map(ac.map((r) => [r.secretName, r]));
  const def = process.env.ELEVENLABS_AGENT_ID || '(unset)';

  const { key: apiKey, source: keySource } = await resolveApiKey(acMap);
  console.log('API key resuelta desde:', keySource, apiKey ? `(…${apiKey.slice(-4)})` : '(vacía)');
  console.log('DEFAULT (ELEVENLABS_AGENT_ID):', def);
  console.log(`AgentConfig rows en DB: ${ac.length}\n`);

  if (!apiKey) {
    console.error('ERROR: no hay API key (ni DB ni env). Los probes fallarían todos con auth.');
  }

  console.log('=== Conectividad get-signed-url por escenario (orden del carrusel) ===');
  for (const s of PROSPECTING) {
    const { agentId, src } = resolveAgentId(s.secret, acMap, def);
    const misroute = src === 'FALLBACK->DEFAULT' ? ' [MISROUTE→DEFAULT]' : '';
    const probe = apiKey ? await probeSignedUrl(apiKey, agentId) : { ok: false, code: 0, ms: 0, detail: 'sin api key' };
    const status = probe.ok ? `✅ 200 (${probe.ms}ms)` : `❌ ${probe.code || 'ERR'} ${probe.detail || ''} (${probe.ms}ms)`;
    console.log(`  ${String(s.n).padStart(2)}. ${s.title.padEnd(30)} ${src.padEnd(18)} ${status}${misroute}`);
  }

  console.log('\nLeyenda:');
  console.log('  ✅ 200            → el agente conecta bien.');
  console.log('  ❌ 401            → API key inválida/revocada.');
  console.log('  ❌ 404 / not found→ el agentId no existe en ElevenLabs (agente borrado).');
  console.log('  ❌ 429            → límite de concurrencia/plan alcanzado.');
  console.log('  [MISROUTE→DEFAULT]→ el secretName no está en DB ni env: cae al agente Coach por defecto.');
} catch (e) {
  console.error('DB ERROR:', e.message);
} finally {
  await prisma.$disconnect();
}
