#!/usr/bin/env node
// ============================================
// Stress escalonado del FLUJO DE EXAMEN FINAL (Nivel 1 Prospección + Nivel 2 Objeciones)
// ============================================
// Ejercita el camino real y pesado en DB de ambos exámenes:
//   POST /api/sessions  →  PATCH /api/sessions/:id  →  POST .../transcript
//   →  POST /api/elevenlabs/agent-evaluation  →  unlock-level2 / complete-course
//
// Estrategia "escalonado hasta romper": sube la concurrencia por etapas
// (50→100→200→… configurable) y corta cuando una etapa cruza el SLA
// (error-rate o p95). Reporta el último escalón sano = capacidad estimada.
//
// Aislamiento: usuarios `exam-stress-<runId>-<i>@loadtest.local`, firstName
// 'STRESSTEST'. NO llama a ElevenLabs/OpenAI: agent-evaluation recibe el
// breakdown directo (el scoring es server-side, sin red externa).
//
// IMPORTANTE sobre el login: /auth/login está rate-limited a 10/15min/IP en
// dev/prod. Por eso se siembra un POOL pequeño de usuarios (default 8) y se
// loguea cada uno UNA vez; todos los workers rotan esos tokens. La carga viene
// de las iteraciones paralelas, no de tener un token por worker.
//
// Uso:
//   STRESS_BASE_URL=http://localhost:3000 \
//   STRESS_ADMIN_EMAIL=admin@gmail.com \
//   STRESS_ADMIN_PASSWORD='admin' \
//   node stress/stress-exam.mjs [--pool=8] [--stages=50,100,200,400,600,900] \
//        [--stage-secs=20] [--break-error-rate=0.02] [--break-p95=2000] [--no-cleanup] [--dry-run]
//
// Salida: stdout + stress/reports/stress-exam-<runId>.json

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// Config
// ============================================

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const BASE_URL = (process.env.STRESS_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.STRESS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STRESS_ADMIN_PASSWORD;
const POOL_SIZE = parseInt(args.pool || '8', 10);
const STAGES = String(args.stages || '50,100,200,400,600,900')
  .split(',')
  .map((s) => parseInt(s, 10))
  .filter((n) => Number.isFinite(n) && n > 0);
const STAGE_SECS = parseInt(args['stage-secs'] || '20', 10);
const BREAK_ERROR_RATE = parseFloat(args['break-error-rate'] || '0.02'); // 2%
const BREAK_P95 = parseInt(args['break-p95'] || '2000', 10); // ms
const DO_CLEANUP = args['no-cleanup'] !== true;
const DRY_RUN = args['dry-run'] === true;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('FALTA: STRESS_ADMIN_EMAIL y STRESS_ADMIN_PASSWORD');
  process.exit(2);
}
if (POOL_SIZE > 9) {
  console.error(`POOL_SIZE=${POOL_SIZE} supera el rate-limit de login (10/15min/IP). Usá --pool<=8.`);
  process.exit(2);
}

const RUN_ID = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const PASSWORD_FOR_USERS = 'StressExam123!@#';
const STRESS_FIRSTNAME = 'STRESSTEST';
const STRESS_LASTNAME = `Exam-${RUN_ID}`;

console.log(`\n=== Stress Examen Final — runId=${RUN_ID} ===`);
console.log(`BASE_URL=${BASE_URL}`);
console.log(`POOL=${POOL_SIZE} STAGES=[${STAGES.join(', ')}] STAGE_SECS=${STAGE_SECS}`);
console.log(`Break si error-rate>${(BREAK_ERROR_RATE * 100).toFixed(1)}% o p95>${BREAK_P95}ms`);
console.log(`Cleanup: ${DO_CLEANUP ? 'SÍ' : 'NO'}  Dry-run: ${DRY_RUN ? 'SÍ' : 'NO'}\n`);

if (DRY_RUN) {
  console.log('DRY RUN — no se hacen requests. Saliendo.');
  process.exit(0);
}

// ============================================
// HTTP helpers + métricas globales por endpoint
// ============================================

const samples = new Map(); // label -> { latencies:[], statusCounts:Map, errors }

function bucket(label) {
  if (!samples.has(label)) samples.set(label, { latencies: [], statusCounts: new Map(), errors: 0 });
  return samples.get(label);
}

async function http(method, path, { token, body, label } = {}) {
  const url = `${BASE_URL}${path}`;
  const lbl = label || `${method} ${path.split('?')[0].replace(/\/[0-9a-f-]{36}/g, '/:id')}`;
  const b = bucket(lbl);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const dt = performance.now() - start;
    b.latencies.push(dt);
    b.statusCounts.set(res.status, (b.statusCounts.get(res.status) || 0) + 1);
    let parsed = null;
    try { parsed = await res.json(); } catch { parsed = null; }
    if (res.status >= 400) {
      b.errors++;
      return { ok: false, status: res.status, body: parsed, dt };
    }
    return { ok: true, status: res.status, body: parsed, dt };
  } catch (err) {
    const dt = performance.now() - start;
    b.latencies.push(dt);
    b.errors++;
    return { ok: false, status: 0, body: { error: err.message }, dt };
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

function summarize() {
  const out = {};
  for (const [label, b] of samples.entries()) {
    const sorted = [...b.latencies].sort((a, c) => a - c);
    const avg = sorted.length ? sorted.reduce((a, c) => a + c, 0) / sorted.length : null;
    out[label] = {
      count: sorted.length,
      errors: b.errors,
      statusCounts: Object.fromEntries(b.statusCounts),
      avgMs: avg !== null ? Math.round(avg) : null,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      maxMs: sorted.length ? Math.round(sorted[sorted.length - 1]) : null,
    };
  }
  return out;
}

function printEndpointSummary() {
  const s = summarize();
  console.log('\n=== Resumen por endpoint (acumulado) ===');
  const rows = Object.entries(s).sort((a, b) => b[1].count - a[1].count);
  const pad = (str, n) => String(str).padEnd(n);
  console.log(pad('endpoint', 48), pad('n', 7), pad('avg', 6), pad('p50', 6), pad('p95', 6), pad('p99', 6), pad('max', 7), 'status');
  for (const [label, m] of rows) {
    console.log(
      pad(label, 48), pad(m.count, 7), pad(m.avgMs, 6), pad(m.p50, 6),
      pad(m.p95, 6), pad(m.p99, 6), pad(m.maxMs, 7),
      Object.entries(m.statusCounts).map(([k, v]) => `${k}:${v}`).join(' '),
      m.errors ? `ERR:${m.errors}` : ''
    );
  }
  return s;
}

// ============================================
// Breakdown helper (suma controlada, 0-20 por rubro)
// ============================================
function breakdownFor(total) {
  const base = Math.floor(total / 5);
  const rem = total - base * 5;
  return {
    apertura: base,
    escucha_activa: base,
    manejo_objeciones: base,
    propuesta_valor: base,
    cierre: base + rem,
  };
}

// ============================================
// Una iteración completa del flujo de examen
// ============================================
// Devuelve { reqs, errors, latencies[] } de esta iteración para agregarlos a la etapa.
async function examFlowIteration(token, examType, stageLatencies) {
  let reqs = 0;
  let errors = 0;
  const track = (r) => {
    reqs++;
    if (!r.ok) errors++;
    stageLatencies.push(r.dt);
    return r;
  };

  // 1. Crear sesión de examen
  const create = track(await http('POST', '/api/sessions', {
    token,
    body: { examType, durationSeconds: 0 },
    label: 'POST /api/sessions',
  }));
  const sessionId = create.body?.id;
  if (!sessionId) return { reqs, errors, latencies: [] }; // sin sesión no seguimos

  // 2. PATCH duración + latencia (como hace la página al colgar)
  track(await http('PATCH', `/api/sessions/${sessionId}`, {
    token,
    body: { durationSeconds: 120 + Math.floor(reqs * 7), connectMs: 700, ttfaSamplesMs: [1100, 1300, 1250] },
    label: 'PATCH /api/sessions/:id',
  }));

  // 3. Transcript
  track(await http('POST', `/api/sessions/${sessionId}/transcript`, {
    token,
    body: {
      transcript: [
        { role: 'user', content: 'Buenas tardes, le hablo de Señoriales.', timestamp: 1 },
        { role: 'agent', content: 'Cuénteme más.', timestamp: 2 },
        { role: 'user', content: 'Le ofrezco el plan Legado de Vida.', timestamp: 3 },
      ],
    },
    label: 'POST /api/sessions/:id/transcript',
  }));

  // 4. Evaluación del agente (scoring server-side). Mezcla aprobados/reprobados.
  const total = 60 + Math.floor(Math.random() * 40); // 60..99
  track(await http('POST', '/api/elevenlabs/agent-evaluation', {
    token,
    body: { sessionId, feedback: `Stress eval ${RUN_ID}`, breakdown: breakdownFor(total) },
    label: 'POST /api/elevenlabs/agent-evaluation',
  }));

  // 5. Progresión (idempotente). Sólo una fracción de las veces para no dominar
  //    el perfil de carga con writes al user.
  if (Math.random() < 0.3) {
    if (examType === 'prospeccion') {
      track(await http('POST', '/api/users/me/unlock-level2', { token, body: {}, label: 'POST /api/users/me/unlock-level2' }));
    } else {
      track(await http('POST', '/api/users/me/complete-course', { token, body: {}, label: 'POST /api/users/me/complete-course' }));
    }
  }

  return { reqs, errors, latencies: [] };
}

// ============================================
// Ejecuta una ETAPA: `concurrency` workers en bucle por `secs` segundos.
// ============================================
async function runStage(concurrency, secs, tokens) {
  const stageLatencies = [];
  let reqs = 0;
  let errors = 0;
  let iterations = 0;
  const endAt = Date.now() + secs * 1000;
  const t0 = performance.now();

  await Promise.all(
    Array.from({ length: concurrency }, async (_, w) => {
      let n = 0;
      while (Date.now() < endAt) {
        const token = tokens[(w + n) % tokens.length];
        const examType = (w + n) % 2 === 0 ? 'prospeccion' : 'objeciones';
        const r = await examFlowIteration(token, examType, stageLatencies);
        reqs += r.reqs;
        errors += r.errors;
        iterations++;
        n++;
      }
    })
  );

  const wallSecs = (performance.now() - t0) / 1000;
  const sorted = [...stageLatencies].sort((a, b) => a - b);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const avg = sorted.length ? Math.round(sorted.reduce((a, c) => a + c, 0) / sorted.length) : null;
  const errorRate = reqs ? errors / reqs : 0;
  const rps = Math.round(reqs / wallSecs);

  return { concurrency, reqs, errors, errorRate, iterations, avg, p95, p99, rps, wallSecs: Math.round(wallSecs) };
}

// ============================================
// Boot: login admin + sede + sembrar pool + login pool
// ============================================

console.log('[boot] Login admin...');
const loginRes = await http('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, label: 'POST /auth/login (admin)' });
if (!loginRes.ok) {
  console.error('Login admin falló:', loginRes.status, loginRes.body);
  process.exit(3);
}
const ADMIN_TOKEN = loginRes.body.accessToken;
console.log('[boot] OK');

console.log('[boot] Buscando sede activa...');
const sedesRes = await http('GET', '/api/sedes', { label: 'GET /api/sedes' });
if (!sedesRes.ok || !Array.isArray(sedesRes.body) || sedesRes.body.length === 0) {
  console.error('No hay sedes activas:', sedesRes.status, sedesRes.body);
  process.exit(4);
}
const SEDE_ID = sedesRes.body[0].id;
console.log(`[boot] Sede="${sedesRes.body[0].name}" (${SEDE_ID})`);

console.log(`[boot] Sembrando pool de ${POOL_SIZE} usuarios...`);
const poolUsers = []; // { id, email }
for (let i = 0; i < POOL_SIZE; i++) {
  const email = `exam-stress-${RUN_ID}-${i}@loadtest.local`;
  const r = await http('POST', '/api/admin/users', {
    token: ADMIN_TOKEN,
    body: { email, password: PASSWORD_FOR_USERS, firstName: STRESS_FIRSTNAME, lastName: STRESS_LASTNAME, role: 'learner', sedeId: SEDE_ID },
    label: 'POST /api/admin/users (seed)',
  });
  if (r.ok && r.body?.user?.id) poolUsers.push({ id: r.body.user.id, email });
  else console.warn(`  seed user ${i} falló: ${r.status} ${JSON.stringify(r.body)}`);
}
console.log(`[boot] Sembrados ${poolUsers.length}/${POOL_SIZE}`);

console.log('[boot] Login del pool (1 por usuario, respeta rate-limit)...');
const tokens = [];
for (const u of poolUsers) {
  const r = await http('POST', '/auth/login', { body: { email: u.email, password: PASSWORD_FOR_USERS }, label: 'POST /auth/login (pool)' });
  if (r.ok && r.body?.accessToken) tokens.push(r.body.accessToken);
  else console.warn(`  login ${u.email} falló: ${r.status} ${JSON.stringify(r.body)}`);
}
console.log(`[boot] Tokens obtenidos: ${tokens.length}\n`);

if (tokens.length === 0) {
  console.error('Sin tokens de pool — no se puede correr el flujo. ¿Rate-limit de login (429)?');
  if (DO_CLEANUP) await cleanup();
  process.exit(5);
}

// ============================================
// Rampa escalonada hasta romper
// ============================================

console.log('=== Rampa escalonada ===');
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('conc', 6), pad('reqs', 8), pad('iters', 7), pad('rps', 6), pad('avg', 6), pad('p95', 7), pad('p99', 7), pad('err%', 7), 'verdict');

const stageReports = [];
let lastHealthy = 0;
let brokeAt = null;

for (const concurrency of STAGES) {
  const rep = await runStage(concurrency, STAGE_SECS, tokens);
  const broke = rep.errorRate > BREAK_ERROR_RATE || (rep.p95 !== null && rep.p95 > BREAK_P95);
  const verdict = broke
    ? `ROTO (${rep.errorRate > BREAK_ERROR_RATE ? `err ${(rep.errorRate * 100).toFixed(1)}%` : `p95 ${rep.p95}ms`})`
    : 'ok';
  console.log(
    pad(concurrency, 6), pad(rep.reqs, 8), pad(rep.iterations, 7), pad(rep.rps, 6),
    pad(rep.avg, 6), pad(rep.p95, 7), pad(rep.p99, 7), pad((rep.errorRate * 100).toFixed(2), 7), verdict
  );
  stageReports.push({ ...rep, broke });
  if (broke) { brokeAt = concurrency; break; }
  lastHealthy = concurrency;
}

console.log('');
if (brokeAt !== null) {
  console.log(`🔴 Punto de quiebre en concurrencia=${brokeAt}. Último escalón sano: ${lastHealthy}.`);
} else {
  console.log(`🟢 No se alcanzó el quiebre hasta concurrencia=${STAGES[STAGES.length - 1]}. Subí --stages para empujar más.`);
}

// ============================================
// Cleanup
// ============================================

async function cleanup() {
  console.log(`\n[cleanup] Borrando ${poolUsers.length} usuarios del pool (cascade borra sus sesiones)...`);
  let deleted = 0;
  for (const u of poolUsers) {
    const r = await http('DELETE', `/api/admin/users/${u.id}`, { token: ADMIN_TOKEN, label: 'DELETE /api/admin/users/:id' });
    if (r.ok) deleted++;
  }
  console.log(`[cleanup] Borrados ${deleted}/${poolUsers.length}`);
  return deleted;
}

let cleanupDeleted = 0;
if (DO_CLEANUP) cleanupDeleted = await cleanup();

// ============================================
// Reporte final
// ============================================

const endpointSummary = printEndpointSummary();

const report = {
  runId: RUN_ID,
  baseUrl: BASE_URL,
  config: { POOL_SIZE, STAGES, STAGE_SECS, BREAK_ERROR_RATE, BREAK_P95 },
  sede: { id: SEDE_ID, name: sedesRes.body[0].name },
  poolTokens: tokens.length,
  stages: stageReports,
  breakpoint: brokeAt,
  lastHealthyConcurrency: lastHealthy,
  cleanup: { attempted: DO_CLEANUP ? poolUsers.length : 0, deleted: cleanupDeleted },
  endpoints: endpointSummary,
  finishedAt: new Date().toISOString(),
};

const reportPath = join(__dirname, 'reports', `stress-exam-${RUN_ID}.json`);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReporte guardado en: ${reportPath}`);
