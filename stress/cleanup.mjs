#!/usr/bin/env node
// Cleanup standalone — borra TODOS los usuarios stress en cualquier run.
// Doble condición para seguridad: email LIKE 'stress-%@loadtest.local' AND firstName='STRESSTEST'.
//
// Uso:
//   STRESS_BASE_URL=https://centro-de-negocios.org \
//   STRESS_ADMIN_EMAIL=admin@gmail.com \
//   STRESS_ADMIN_PASSWORD='admin' \
//   node stress/cleanup.mjs [--dry-run]

const BASE_URL = (process.env.STRESS_BASE_URL || 'https://centro-de-negocios.org').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.STRESS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STRESS_ADMIN_PASSWORD;
const DRY_RUN = process.argv.includes('--dry-run');

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('FALTA: STRESS_ADMIN_EMAIL y STRESS_ADMIN_PASSWORD');
  process.exit(2);
}

async function http(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let parsed;
  try { parsed = await res.json(); } catch { parsed = null; }
  return { ok: res.ok, status: res.status, body: parsed };
}

console.log(`[cleanup] login admin a ${BASE_URL}...`);
const login = await http('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
if (!login.ok) {
  console.error('Login falló:', login.status, login.body);
  process.exit(3);
}
const token = login.body.accessToken;

console.log('[cleanup] listando students...');
const students = await http('GET', '/api/admin/students', { token });
if (!students.ok) {
  console.error('No pude listar students:', students.status, students.body);
  process.exit(4);
}

const stressUsers = students.body.filter(
  (s) =>
    typeof s.email === 'string' &&
    s.email.startsWith('stress-') &&
    s.email.endsWith('@loadtest.local') &&
    s.firstName === 'STRESSTEST'
);

console.log(`[cleanup] encontrados ${stressUsers.length} usuarios stress.`);
if (DRY_RUN) {
  console.log('[cleanup] --dry-run, listando primeros 10:');
  stressUsers.slice(0, 10).forEach((u) => console.log(`  ${u.id}  ${u.email}`));
  process.exit(0);
}

let deleted = 0, failed = 0;
const failures = [];
const CONC = 3;
const RETRIES = 3;
let i = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (i < stressUsers.length) {
    const idx = i++;
    const u = stressUsers[idx];
    let attempt = 0, r;
    while (attempt < RETRIES) {
      r = await http('DELETE', `/api/admin/users/${u.id}`, { token });
      if (r.ok || r.status === 404) break;
      attempt++;
      await new Promise((res) => setTimeout(res, 500 * attempt));
    }
    if (r.ok || r.status === 404) deleted++;
    else { failed++; failures.push({ id: u.id, email: u.email, status: r.status, err: r.body?.error }); }
  }
}));

console.log(`\n[cleanup] borrados=${deleted} fallidos=${failed}`);
if (failures.length) {
  console.log('Primeros fallos:');
  failures.slice(0, 10).forEach((f) => console.log(' ', f));
  process.exit(1);
}
