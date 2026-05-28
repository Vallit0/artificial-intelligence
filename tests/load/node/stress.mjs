#!/usr/bin/env node
// Stress test para la gestión de usuarios + endpoints adyacentes.
// Aislamiento: emails `stress-<runId>-<i>@loadtest.local` + firstName='STRESSTEST'.
// NO toca ElevenLabs / OpenAI / WHAPI / Resend / LTI launches.
//
// Uso:
//   STRESS_BASE_URL=https://centro-de-negocios.org \
//   STRESS_ADMIN_EMAIL=admin@gmail.com \
//   STRESS_ADMIN_PASSWORD='admin' \
//   node tests/load/node/stress.mjs [--users=200] [--bulk=50] [--read-secs=60] [--concurrency=20] [--no-cleanup]
//
// Salida: stdout + tests/load/node/reports/stress-<runId>.json

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

const BASE_URL = (process.env.STRESS_BASE_URL || 'https://centro-de-negocios.org').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.STRESS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STRESS_ADMIN_PASSWORD;
const USER_COUNT = parseInt(args.users || '200', 10);
const BULK_SIZE = parseInt(args.bulk || '50', 10);
const BULK_COUNT = parseInt(args['bulks'] || '2', 10);
const READ_SECS = parseInt(args['read-secs'] || '60', 10);
const CONCURRENCY = parseInt(args.concurrency || '20', 10);
const DO_CLEANUP = args['no-cleanup'] !== true;
const DRY_RUN = args['dry-run'] === true;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('FALTA: STRESS_ADMIN_EMAIL y STRESS_ADMIN_PASSWORD');
  process.exit(2);
}

const RUN_ID = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const PASSWORD_FOR_USERS = 'StressTest123!@#';
const STRESS_FIRSTNAME = 'STRESSTEST';
const STRESS_LASTNAME = `Run-${RUN_ID}`;

console.log(`\n=== Stress Test — runId=${RUN_ID} ===`);
console.log(`BASE_URL=${BASE_URL}`);
console.log(`USER_COUNT=${USER_COUNT} BULK_SIZE=${BULK_SIZE} x${BULK_COUNT} READ_SECS=${READ_SECS} CONCURRENCY=${CONCURRENCY}`);
console.log(`Cleanup automático: ${DO_CLEANUP ? 'SÍ' : 'NO'}  Dry-run: ${DRY_RUN ? 'SÍ' : 'NO'}\n`);

if (DRY_RUN) {
  console.log('DRY RUN — no se hacen requests. Saliendo.');
  process.exit(0);
}

// ============================================
// HTTP helpers + métricas
// ============================================

const samples = new Map(); // endpoint label -> { latencies: number[], statusCounts: Map, errors: number }

function bucket(label) {
  if (!samples.has(label)) samples.set(label, { latencies: [], statusCounts: new Map(), errors: 0 });
  return samples.get(label);
}

async function http(method, path, { token, body, label } = {}) {
  const url = `${BASE_URL}${path}`;
  const lbl = label || `${method} ${path.split('?')[0].replace(/\/[0-9a-f-]{36}/g, '/:id')}`;
  const b = bucket(lbl);
  const start = performance.now();
  let res, parsed;
  try {
    res = await fetch(url, {
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
    if (res.status >= 400) {
      try { parsed = await res.json(); } catch { parsed = await res.text().catch(() => null); }
      return { ok: false, status: res.status, body: parsed, dt };
    }
    try { parsed = await res.json(); } catch { parsed = null; }
    return { ok: true, status: res.status, body: parsed, dt };
  } catch (err) {
    const dt = performance.now() - start;
    b.latencies.push(dt);
    b.errors++;
    return { ok: false, status: 0, body: { error: err.message }, dt };
  }
}

// Pool de concurrencia: ejecuta `items` con paralelismo `n`.
async function pool(items, n, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = await worker(items[idx], idx); }
      catch (err) { results[idx] = { error: err.message }; }
    }
  });
  await Promise.all(runners);
  return results;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

function summarize() {
  const out = {};
  for (const [label, b] of samples.entries()) {
    const sorted = [...b.latencies].sort((a, b) => a - b);
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

function printSummary() {
  const s = summarize();
  console.log('\n=== Resumen por endpoint ===');
  const rows = Object.entries(s).sort((a, b) => b[1].count - a[1].count);
  const pad = (str, n) => String(str).padEnd(n);
  console.log(pad('endpoint', 56), pad('n', 6), pad('avg', 6), pad('p50', 6), pad('p95', 6), pad('p99', 6), pad('max', 6), 'status');
  for (const [label, m] of rows) {
    console.log(
      pad(label, 56),
      pad(m.count, 6),
      pad(m.avgMs, 6),
      pad(m.p50, 6),
      pad(m.p95, 6),
      pad(m.p99, 6),
      pad(m.maxMs, 6),
      Object.entries(m.statusCounts).map(([k, v]) => `${k}:${v}`).join(' '),
      m.errors ? `ERR:${m.errors}` : ''
    );
  }
  return s;
}

// ============================================
// Boot: login admin + fetch sede
// ============================================

console.log('[boot] Login admin...');
const loginRes = await http('POST', '/auth/login', {
  body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  label: 'POST /auth/login (admin)',
});
if (!loginRes.ok) {
  console.error('Login del admin falló:', loginRes.status, loginRes.body);
  process.exit(3);
}
const ADMIN_TOKEN = loginRes.body.accessToken;
console.log('[boot] OK — token obtenido');

console.log('[boot] Buscando sede activa...');
const sedesRes = await http('GET', '/api/sedes', { label: 'GET /api/sedes (public)' });
if (!sedesRes.ok || !Array.isArray(sedesRes.body) || sedesRes.body.length === 0) {
  console.error('No hay sedes activas:', sedesRes);
  process.exit(4);
}
const SEDE_ID = sedesRes.body[0].id;
console.log(`[boot] Sede="${sedesRes.body[0].name}" (${SEDE_ID})\n`);

// ============================================
// Fase 1: Read-storm de endpoints públicos + admin
// ============================================

const readEndpoints = [
  // públicos (sin token)
  { method: 'GET', path: '/api/scenarios', token: null },
  { method: 'GET', path: '/api/sedes', token: null },
  // admin lectura
  { method: 'GET', path: '/api/admin/students', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/sedes', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/coaches', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/agent-configs', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/prospecting-scenarios', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/analytics', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/lti-platforms', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/lti/courses', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/lti/pending-matches', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/agent-latency?limit=20', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/admin/latency-probe/ping', token: ADMIN_TOKEN },
  // authed (admin token sirve aquí también)
  { method: 'GET', path: '/auth/me', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/stats', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/progress', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/sessions', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/analytics/dashboard', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/analytics/competencies', token: ADMIN_TOKEN },
  { method: 'GET', path: '/api/prospecting-scenarios/me', token: ADMIN_TOKEN },
];

console.log(`[fase1] Read-storm por ${READ_SECS}s con ${CONCURRENCY} workers...`);
const fase1Start = Date.now();
let f1Requests = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (Date.now() - fase1Start < READ_SECS * 1000) {
    const ep = readEndpoints[Math.floor(Math.random() * readEndpoints.length)];
    await http(ep.method, ep.path, { token: ep.token });
    f1Requests++;
  }
}));
console.log(`[fase1] OK — ${f1Requests} requests en ${READ_SECS}s (${Math.round(f1Requests / READ_SECS)} req/s)\n`);

// ============================================
// Fase 2: Creación single de N usuarios
// ============================================

console.log(`[fase2] Creando ${USER_COUNT} usuarios single (concurrencia ${CONCURRENCY})...`);
const createdIds = [];
const createIndices = Array.from({ length: USER_COUNT }, (_, i) => i);
await pool(createIndices, CONCURRENCY, async (i) => {
  const email = `stress-${RUN_ID}-${i}@loadtest.local`;
  const r = await http('POST', '/api/admin/users', {
    token: ADMIN_TOKEN,
    body: {
      email,
      password: PASSWORD_FOR_USERS,
      firstName: STRESS_FIRSTNAME,
      lastName: STRESS_LASTNAME,
      role: 'learner',
      sedeId: SEDE_ID,
    },
  });
  if (r.ok && r.body?.user?.id) createdIds.push(r.body.user.id);
});
console.log(`[fase2] Creados ${createdIds.length}/${USER_COUNT}\n`);

// ============================================
// Fase 3: Bulk creation
// ============================================

console.log(`[fase3] Bulk: ${BULK_COUNT} lotes de ${BULK_SIZE} usuarios...`);
let bulkCreatedTotal = 0;
for (let b = 0; b < BULK_COUNT; b++) {
  const users = Array.from({ length: BULK_SIZE }, (_, i) => ({
    email: `stress-${RUN_ID}-bulk${b}-${i}@loadtest.local`,
    password: PASSWORD_FOR_USERS,
    firstName: STRESS_FIRSTNAME,
    lastName: `${STRESS_LASTNAME}-B${b}`,
  }));
  const r = await http('POST', '/api/admin/users/bulk', {
    token: ADMIN_TOKEN,
    body: { users, sedeId: SEDE_ID },
  });
  if (r.ok && r.body?.summary) {
    bulkCreatedTotal += r.body.summary.created || 0;
    console.log(`  bulk ${b}: created=${r.body.summary.created} failed=${r.body.summary.failed}`);
  } else {
    console.log(`  bulk ${b}: FAIL ${r.status}`, r.body?.error || '');
  }
}
console.log(`[fase3] Total bulk creados: ${bulkCreatedTotal}\n`);

// ============================================
// Fase 4: Mutaciones sobre usuarios creados
// ============================================

console.log(`[fase4] Mutaciones sobre ${createdIds.length} usuarios (rename + reset password + toggle examen + grade)...`);
await pool(createdIds, CONCURRENCY, async (id, idx) => {
  await http('PATCH', `/api/admin/users/${id}/name`, {
    token: ADMIN_TOKEN,
    body: { firstName: STRESS_FIRSTNAME, lastName: `${STRESS_LASTNAME}-renamed` },
  });
  await http('PATCH', `/api/admin/users/${id}/password`, {
    token: ADMIN_TOKEN,
    body: { password: 'NewStressPass1!' },
  });
  await http('PATCH', `/api/admin/users/${id}/examen-final`, {
    token: ADMIN_TOKEN,
    body: { enabled: idx % 2 === 0 },
  });
  await http('POST', '/api/admin/grades', {
    token: ADMIN_TOKEN,
    body: { userId: id, finalGrade: 75 + (idx % 25), notes: `stress test ${RUN_ID}` },
  });
});
console.log(`[fase4] OK\n`);

// ============================================
// Fase 5: Bulk toggle examen-final
// ============================================

if (createdIds.length > 0) {
  console.log(`[fase5] Bulk toggle examen-final sobre ${Math.min(createdIds.length, 500)} usuarios...`);
  const chunk = createdIds.slice(0, 500);
  await http('PATCH', '/api/admin/users/bulk/examen-final', {
    token: ADMIN_TOKEN,
    body: { userIds: chunk, enabled: true },
  });
  await http('PATCH', '/api/admin/users/bulk/examen-final', {
    token: ADMIN_TOKEN,
    body: { userIds: chunk, enabled: false },
  });
  console.log(`[fase5] OK\n`);
}

// ============================================
// Fase 6: Sondeo de auth (limitado por rate limit 10/15min/IP)
// ============================================

console.log(`[fase6] Login probe — máx 5 attempts para no quemar el rate limit...`);
const sampleEmails = createdIds.slice(0, 5).map((_, i) => `stress-${RUN_ID}-${i}@loadtest.local`);
for (const email of sampleEmails) {
  await http('POST', '/auth/login', {
    body: { email, password: 'NewStressPass1!' },
    label: 'POST /auth/login (learner)',
  });
}
console.log(`[fase6] OK\n`);

// ============================================
// Cleanup: borrar todos los usuarios stress por API
// ============================================

let cleanupReport = { attempted: 0, deleted: 0, failed: 0, orphans: [] };
if (DO_CLEANUP) {
  console.log(`[cleanup] Borrando usuarios stress vía API...`);

  // Refrescar lista por si los bulk crearon más
  const studentsRes = await http('GET', '/api/admin/students', { token: ADMIN_TOKEN, label: 'GET /admin/students (cleanup-list)' });
  const allStressIds = new Set(createdIds);
  if (studentsRes.ok && Array.isArray(studentsRes.body)) {
    for (const s of studentsRes.body) {
      if (
        typeof s.email === 'string' &&
        s.email.startsWith(`stress-${RUN_ID}-`) &&
        s.email.endsWith('@loadtest.local') &&
        s.firstName === STRESS_FIRSTNAME
      ) {
        allStressIds.add(s.id);
      }
    }
  }

  const toDelete = Array.from(allStressIds);
  cleanupReport.attempted = toDelete.length;
  console.log(`[cleanup] Eliminando ${toDelete.length} usuarios...`);

  await pool(toDelete, CONCURRENCY, async (id) => {
    const r = await http('DELETE', `/api/admin/users/${id}`, { token: ADMIN_TOKEN });
    if (r.ok) cleanupReport.deleted++;
    else {
      cleanupReport.failed++;
      cleanupReport.orphans.push({ id, status: r.status, err: r.body?.error });
    }
  });
  console.log(`[cleanup] Borrados ${cleanupReport.deleted}/${toDelete.length}, fallos ${cleanupReport.failed}\n`);
}

// ============================================
// Reporte final
// ============================================

const finalSummary = printSummary();

const report = {
  runId: RUN_ID,
  baseUrl: BASE_URL,
  config: { USER_COUNT, BULK_SIZE, BULK_COUNT, READ_SECS, CONCURRENCY },
  sede: { id: SEDE_ID, name: sedesRes.body[0].name },
  fase1: { requests: f1Requests, secs: READ_SECS },
  fase2: { attempted: USER_COUNT, created: createdIds.length },
  fase3: { bulks: BULK_COUNT, perBulk: BULK_SIZE, created: bulkCreatedTotal },
  fase4: { mutated: createdIds.length },
  cleanup: cleanupReport,
  endpoints: finalSummary,
  finishedAt: new Date().toISOString(),
};

const reportPath = join(__dirname, 'reports', `stress-${RUN_ID}.json`);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReporte guardado en: ${reportPath}`);

if (cleanupReport.failed > 0) {
  console.log(`\n⚠️  Quedaron ${cleanupReport.failed} usuarios sin borrar. Corré:`);
  console.log(`   node tests/load/node/cleanup.mjs (limpia por patrón)`);
  console.log(`   o ejecutá tests/load/node/cleanup.sql en la DB`);
  process.exit(1);
}
