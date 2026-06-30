# Reporte de Load Test — capa_01 (Go-Live Señoriales)

- **Fecha:** 2026-06-30
- **runId:** 20260630-164441
- **Target:** `https://dev.centro-de-negocios.org` → capa_01 (`10.4.6.20` / `46.250.172.118`, 12 vCPU / 32 GiB)
- **Stack:** 6 réplicas app + PgBouncer + Postgres 15, detrás de nginx (`least_conn`)
- **Generador de carga:** 1 sola IP (capa_02), `--users=300 --concurrency=40 --read-secs=120`
- **Reporte crudo:** `stress/reports/stress-20260630-164441.json`

---

## Veredicto

**El backend respondió bien bajo carga.** Las operaciones reales (crear/editar/borrar usuarios, lecturas, analytics) devolvieron éxito con latencias sanas (p95 mayormente < 1 s). El balanceo entre las 6 réplicas funcionó.

**La prueba NO midió el techo real de capacidad**: al salir de una sola IP, el rate-limit de nginx (`api` 100 r/s, `auth` 5 r/s) throttló gran parte del tráfico (`429`) antes de exigir al backend. Para validar los ~450 concurrentes objetivo, repetir **multi-IP** o relajando temporalmente las zonas.

**Hallazgo a corregir:** los endpoints LTI (muertos en este deploy) se cuelgan ~240–300 s y devuelven `502`.

---

## Resultados por endpoint (extracto)

### ✅ Operaciones de escritura — OK
| Endpoint | n | p50 | p95 | max | Status |
|---|---|---|---|---|---|
| POST /api/admin/users | 300 | 651 | 905 | 1223 | **201:300** |
| POST /api/admin/users/bulk | 2 | 4365 | 4365 | 4365 | 200:2 |
| DELETE /api/admin/users/:id | 400 | 20 | 117 | 141 | 200:141 · 429:259 |
| PATCH .../name | 300 | 26 | 235 | 387 | 200:133 · 429:167 |
| PATCH .../password | 300 | 26 | 589 | 795 | 200:122 · 429:178 |
| PATCH .../examen-final | 300 | 24 | 244 | 375 | 200:118 · 429:182 |
| POST /api/admin/grades | 300 | 24 | 236 | 409 | 200:122 · 429:178 |

### ✅ Lecturas — OK (p95 < 500 ms)
`/api/admin/students` (p95 465), `/api/admin/analytics` (239), `/api/sessions` (231),
`/api/analytics/dashboard` (277), `/api/stats` (214), `/auth/me` (246), `/api/scenarios` (148)
— todas **200**.

### 🔴 LTI — COLGADAS (bug)
| Endpoint | avg (ms) | Status |
|---|---|---|
| GET /api/admin/lti/courses | 264377 | **502:9 · ERR:6** |
| GET /api/admin/lti-platforms | 268107 | **502:7 · ERR:6** |
| GET /api/admin/lti/pending-matches | 255185 | **502:9** |

~4–5 min por request → timeout → 502. LTI está removido del flujo (acceso directo, sin Moodle); las rutas siguen vivas y se cuelgan (probable llamada externa a una plataforma LTI inexistente).

---

## Interpretación

1. **Latencias y éxito sanos** en todo lo que importa para el usuario real → el backend, PgBouncer y Postgres soportan la carga aplicada sin degradarse.
2. **Los `429` son rate-limit de nginx**, no fallas del backend. Aparecen porque el tráfico vino de **una sola IP**. No representan el límite real de capacidad.
3. **Balanceo confirmado** (verificado aparte): las 6 réplicas reparten parejo (`up=172.23.0.5..10`).
4. **LTI cuelga**: no afecta el go-live (nadie entra por LTI), pero hay que **eliminar esas rutas muertas** para que no cuelguen ni consuman conexiones si un admin las toca.

---

## Recomendaciones

- [ ] **Medir capacidad real**: re-correr multi-IP (laptop + 2ª VM) o subir temporalmente `api`/`auth` en `nginx/nginx.prod.conf`. Objetivo: p95 < 300 ms, 0 % 5xx (no rate-limit), sin `P2024`, CPU capa_01 < 70 %.
- [ ] **Eliminar las rutas LTI muertas** (`/api/admin/lti/*`, `lti-platforms`) que se cuelgan.
- [ ] **Limpiar los 259 usuarios de prueba**: `stress/cleanup.sql` en la DB de capa_01 (borra solo `stress-%@loadtest.local` + `STRESSTEST`).
- [ ] El **dump+restore fresco del cutover** elimina cualquier resto de datos de prueba.

## Notas de método
- Cleanup automático cortado por los `429` → quedaron 259 usuarios `STRESSTEST` (se limpian con el SQL).
- `NODE_TLS_REJECT_UNAUTHORIZED=0` usado por el test (cert vía IP privada).
