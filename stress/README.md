# Stress test — gestión de usuarios

Stress test contra prod (`https://centro-de-negocios.org`) que NO toca ElevenLabs, OpenAI, WHAPI, Resend ni LTI launches. Cubre auth + lectura admin + creación/mutación/borrado de usuarios.

## Aislamiento

Todos los datos creados por el test usan:
- Email: `stress-<runId>-<i>@loadtest.local`
- `firstName`: `STRESSTEST`
- `lastName`: `Run-<runId>` (con sufijo en bulks/mutaciones)

Cleanup usa **doble condición** (`email LIKE 'stress-%@loadtest.local' AND first_name='STRESSTEST'`) para no borrar nada real si el patrón coincidiera por accidente.

## Pre-requisitos

1. **Backup** en la VM:
   ```bash
   mkdir -p ~/backups
   docker exec artificial-intelligence-db-1 pg_dump -U senoriales senoriales \
     --format=custom --clean --if-exists \
     > ~/backups/senoriales-pre-stresstest-$(date +%Y%m%d-%H%M%S).dump
   ls -lh ~/backups/
   ```
   Restore (si algo sale mal):
   ```bash
   cat <archivo>.dump | docker exec -i artificial-intelligence-db-1 \
     pg_restore -U senoriales -d senoriales --clean --if-exists
   ```

2. Node 18+ instalado localmente (usa `fetch` nativo, cero deps).

## Ejecutar (PowerShell)

```powershell
$env:STRESS_BASE_URL = "https://centro-de-negocios.org"
$env:STRESS_ADMIN_EMAIL = "admin@gmail.com"
$env:STRESS_ADMIN_PASSWORD = "admin"

# Run completo con defaults (200 single + 2x50 bulk, 60s read-storm, conc=20)
node stress/stress.mjs

# Customización
node stress/stress.mjs --users=100 --bulk=25 --bulks=2 --read-secs=30 --concurrency=10

# Sin cleanup automático (deja los users para inspección manual)
node stress/stress.mjs --no-cleanup

# Dry run (sólo imprime config, no manda requests)
node stress/stress.mjs --dry-run
```

## Cleanup manual

Si el cleanup automático falla, hay dos caminos:

```powershell
# 1. Por API (preferido — usa las cascadas de Prisma)
node stress/cleanup.mjs --dry-run   # ver qué borraría
node stress/cleanup.mjs              # borrar
```

```bash
# 2. Por SQL directo en la VM (fallback)
docker exec -i artificial-intelligence-db-1 psql -U senoriales -d senoriales \
  < stress/cleanup.sql
```

## Endpoints cubiertos

**No cubiertos a propósito:** `/api/elevenlabs/*`, `/api/memory/*`, `/api/whatsapp/*`, `/api/sessions/evaluate` (OpenAI), `/lti/*` launches, `/auth/password-reset` (Resend), `/api/admin/latency-probe` (probe completa hace voz de ElevenLabs).

| Fase | Endpoints |
|---|---|
| 1 (read-storm) | `GET /api/scenarios`, `GET /api/sedes`, `GET /api/admin/{students,sedes,coaches,agent-configs,prospecting-scenarios,analytics,lti-platforms,lti/courses,lti/pending-matches,agent-latency,latency-probe/ping}`, `GET /auth/me`, `GET /api/{stats,progress,sessions,analytics/dashboard,analytics/competencies,prospecting-scenarios/me}` |
| 2 (single create) | `POST /api/admin/users` × N |
| 3 (bulk create) | `POST /api/admin/users/bulk` × M |
| 4 (mutations) | `PATCH /api/admin/users/:id/{name,password,examen-final}`, `POST /api/admin/grades` |
| 5 (bulk toggle) | `PATCH /api/admin/users/bulk/examen-final` |
| 6 (auth probe) | `POST /auth/login` ≤5 veces (rate limit 10/15min/IP) |
| 7 (cleanup) | `DELETE /api/admin/users/:id` × todos los stress |

## Output

Stdout muestra tabla de percentiles por endpoint al final. Reporte JSON completo en `stress/reports/stress-<runId>.json`.
