// ============================================
// Diagnóstico de enrutado de agentes ElevenLabs
// --------------------------------------------
// Simula resolveAgentId (DB -> env -> default) para cada secretName que el
// frontend puede pedir, y marca cuáles caen al agente por defecto (Coach).
// Corre DENTRO del contenedor del server (donde la DB es alcanzable):
//
//   docker compose exec app node server/scripts/diag-agent-routing.mjs
//   # o, si el cwd ya es /app/server:  node scripts/diag-agent-routing.mjs
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mantener en sync con ProspectingCarousel.tsx + Practice.tsx (sufijo _NIVEL2).
const REQUESTED = [
  'ELEVENLABS_AGENT_PROSPECTING_PAREJA',
  'ELEVENLABS_AGENT_PROSPECTING_FRUTAS',
  'ELEVENLABS_AGENT_FAMILIA',
  'ELEVENLABS_AGENT_PROSPECTING_NEUMATICOS',
  'ELEVENLABS_AGENT_PROSPECTING_RESTAURANTE',
  'ELEVENLABS_AGENT_PROSPECTING_PARQUEO',
  'ELEVENLABS_AGENT_PROSPECTING_CAMINANDO',
  'ELEVENLABS_AGENT_STAND1',
  'ELEVENLABS_AGENT_STAND2',
  'ELEVENLABS_AGENT_PROSPECTING_CEMENTERIO',
  'ELEVENLABS_AGENT_COACH',
  'ELEVENLABS_AGENT_ROLEPLAY_CLIENTE',
  'ELEVENLABS_AGENT_ROLEPLAY_ASESOR',
  'ELEVENLABS_AGENT_COACH_NIVEL2',
  'ELEVENLABS_AGENT_ROLEPLAY_CLIENTE_NIVEL2',
  'ELEVENLABS_AGENT_ROLEPLAY_ASESOR_NIVEL2',
];

try {
  const ac = await prisma.agentConfig.findMany({
    select: { secretName: true, agentId: true, isActive: true },
  });
  const acMap = new Map(ac.map((r) => [r.secretName, r]));
  const def = process.env.ELEVENLABS_AGENT_ID || '(unset)';

  console.log('DEFAULT (ELEVENLABS_AGENT_ID):', def);
  console.log(`\nAgentConfig rows en DB: ${ac.length}`);
  for (const r of ac) {
    console.log('  ', r.secretName, '->', r.agentId, r.isActive ? '' : '(INACTIVE)');
  }

  console.log('\n=== Simulación resolveAgentId (DB -> env -> default) ===');
  for (const s of REQUESTED) {
    const db = acMap.get(s);
    let resolved;
    let src;
    if (db && db.isActive && db.agentId) {
      resolved = db.agentId;
      src = 'DB';
    } else if (process.env[s]) {
      resolved = process.env[s];
      src = 'ENV';
    } else {
      resolved = def;
      src = 'FALLBACK->DEFAULT';
    }
    const flag = src === 'FALLBACK->DEFAULT' ? '  <<< ENRUTADO INCORRECTO' : '';
    console.log(`  ${s.padEnd(44)} ${src.padEnd(20)} ${resolved}${flag}`);
  }

  const pc = await prisma.prospectingScenarioConfig.findMany({
    select: { secretName: true, systemPrompt: true, isActiveGlobal: true },
  });
  console.log('\n=== prospectingScenarioConfig (override de prompt por secretName) ===');
  for (const r of pc) {
    const tag = r.systemPrompt ? `[prompt ${r.systemPrompt.length} chars]` : '[sin prompt]';
    console.log('  ', r.secretName, tag, r.isActiveGlobal ? '' : '(no global)');
  }
} catch (e) {
  console.error('DB ERROR:', e.message);
} finally {
  await prisma.$disconnect();
}
