# RUNBOOK — Actualización in-place en capa_02 (4 vCPU / 8 GiB)

Pasar producción del `docker-compose.yml` actual (1 app + nginx + db, gestionada
con `db push`) al `docker-compose.prod.yml` afinado (2 réplicas + nginx balanceador
+ Postgres tuneado + migraciones Prisma). **Mismo servidor, mismo dominio
`centro-de-negocios.org`, mismos certs TLS, mismo volumen de datos.** No hay cambio
de DNS ni de máquina. Downtime esperado: ~2-3 min (build + arranque).

> Contenedores actuales en capa_02: `artificial-intelligence-{app,db,nginx,promtail}-1`.
> Ambos composes viven en el MISMO directorio → mismo project name → reusan el
> volumen `postgres_data`. **Corré todo desde ese directorio; nunca pases `-p`.**

---

## ⚠️ Dos gotchas que rompen el cutover si se ignoran

1. **La DB no tiene historial de migraciones.** Fue creada con `db push`, así que
   NO existe `_prisma_migrations`. Si el servicio `migrate` corre `prisma migrate
   deploy` tal cual, falla (P3005) o intenta recrear tablas existentes. → Hay que
   **baselinear** antes (Fase 4).
2. **`POSTGRES_PASSWORD` no cambia la contraseña de un volumen existente.** Postgres
   solo la aplica al inicializar un volumen vacío. El volumen actual se creó con
   password `senoriales` (del compose viejo). En `server/.env` poné
   `POSTGRES_PASSWORD=senoriales` para el cutover; rotala DESPUÉS (Fase 7), no antes.

---

## Fase 0 — En la laptop: commitear y pushear

```bash
git add docker-compose.prod.yml docker-compose.capa01.yml \
        infra/postgresql.capa02.conf nginx/nginx.prod.conf \
        server/src/index.ts infra/RUNBOOK-capa02.md
git commit -m "infra: deploy capa_02 (2 réplicas, postgres tuneado, trust proxy)"
git push origin develop
```

## Fase 1 — En capa_02: pre-requisitos (sin downtime aún)

```bash
cd /ruta/al/repo            # el mismo dir donde corre el compose actual
git fetch && git checkout develop && git pull

# DISCO: está al 81%. El build + imágenes nuevas necesitan varios GB.
df -h /                     # si <5 GB libres, liberá ANTES (docker system prune -a, archivar transcripts)

# .env: agregar/confirmar las claves que el nuevo compose espera.
#   POSTGRES_PASSWORD=senoriales   ← debe igualar la password del volumen actual
#   JWT_SECRET=...                 ← el mismo que usa prod hoy (no inventar uno nuevo: invalidaría sesiones)
#   ELEVENLABS_*, OPENAI_API_KEY, WHAPI_*, RESEND_* ← los actuales
nano server/.env

# Certs TLS: el nuevo nginx monta ./nginx/ssl igual que el actual. Confirmar:
ls -l nginx/ssl/fullchain.pem nginx/ssl/privkey.pem
```

## Fase 2 — Backup de la DB (con el stack viejo aún corriendo)

```bash
mkdir -p ~/backups
docker exec artificial-intelligence-db-1 pg_dump -U senoriales senoriales \
  --format=custom --no-owner --no-acl \
  > ~/backups/senoriales-pre-update-$(date +%Y%m%d-%H%M%S).dump
ls -lh ~/backups/   # verificar que pesa > 0
```

## Fase 3 — Bajar el stack viejo (PRESERVANDO datos)

```bash
docker compose -f docker-compose.yml down   # SIN -v  → el volumen postgres_data sobrevive
```

## Fase 4 — Levantar solo la DB y baselinear migraciones (CRÍTICO)

```bash
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml exec db pg_isready -U senoriales

# 4a. Inspeccionar qué tiene ya la DB:
docker compose -f docker-compose.prod.yml exec db psql -U senoriales -d senoriales -c \
  "SELECT to_regclass('_prisma_migrations') AS hist,
          to_regclass('lti_platforms')      AS lti_aun_presente;"
docker compose -f docker-compose.prod.yml exec db psql -U senoriales -d senoriales -tAc \
  "SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='course_completed';"
docker compose -f docker-compose.prod.yml exec db psql -U senoriales -d senoriales -tAc \
  "SELECT 1 FROM information_schema.columns WHERE table_name='practice_sessions' AND column_name='exam_type';"
```

**Regla de baselining** (marca como YA aplicada toda migración cuyo cambio ya está
en el schema; deja que `deploy` corra el resto):

```bash
RESOLVE="docker compose -f docker-compose.prod.yml run --rm --no-deps \
  -e DATABASE_URL=postgresql://senoriales:${POSTGRES_PASSWORD}@db:5432/senoriales migrate \
  npx prisma migrate resolve --applied"

$RESOLVE 0_init                                  # SIEMPRE (las tablas base ya existen)
# Solo si la query de course_completed devolvió "1":
$RESOLVE 20260610000000_add_course_completed
# Solo si la query de exam_type devolvió "1":
$RESOLVE 20260610120000_add_exam_type
# NUNCA resolver 20260612000000_remove_lti: es idempotente (DROP IF EXISTS), debe CORRER.
```

> Si una columna NO existe, NO la resuelvas: dejá que `migrate deploy` (Fase 5) la cree.
> Resolver de más = la columna nunca se crea y la app rompe. Resolver de menos = `deploy`
> falla con "column already exists".

## Fase 5 — Levantar el stack completo

```bash
docker compose -f docker-compose.prod.yml up -d --build
# Orden: db (ya arriba) → migrate (deploy + seed, Exited 0) → app1/app2 → nginx, promtail
docker compose -f docker-compose.prod.yml ps         # migrate=Exited(0); db/app1/app2/nginx healthy
docker compose -f docker-compose.prod.yml logs migrate | tail -30   # "migrations applied" sin errores
```

## Fase 6 — Verificación end-to-end

```bash
# Las 2 réplicas responden por la red interna (vía nginx):
curl -fsS https://centro-de-negocios.org/health/ready ; echo
# Reparto entre réplicas (varios hits, revisar logs de ambas):
for i in $(seq 1 6); do curl -fsS https://centro-de-negocios.org/health/live >/dev/null; done
docker compose -f docker-compose.prod.yml logs app1 app2 | tail -20
# trust proxy: en logs de acceso debe verse la IP real del cliente, no 172.x interna.
```
Manual: login real → dashboard → iniciar práctica de voz (ElevenLabs directo) →
terminar y ver evaluación. Confirmar que `course_completed`/`exam_type` funcionan.

## Fase 7 — Hardening (después de verificar que todo corre)

```bash
# Rotar la password de Postgres (ahora sí):
docker compose -f docker-compose.prod.yml exec db psql -U senoriales -d senoriales -c \
  "ALTER ROLE senoriales WITH PASSWORD 'NUEVA_PASSWORD_FUERTE';"
# Actualizar server/.env (POSTGRES_PASSWORD=NUEVA...) y recrear las apps:
nano server/.env
docker compose -f docker-compose.prod.yml up -d app1 app2
```
- [ ] WHAPI token rotado (sigue en git history).
- [ ] Password del admin sembrado cambiada.
- [ ] Backups automáticos (cron `pg_dump` cada 6h, retención 7 días).

---

## Rollback

Si algo falla en Fase 5/6, el volumen de datos está intacto y el compose viejo
sigue en el repo:

```bash
docker compose -f docker-compose.prod.yml down       # SIN -v
docker compose -f docker-compose.yml up -d            # vuelve al stack anterior
```
Si la DB quedó en mal estado (migración a medias), restaurá el backup de Fase 2:
```bash
docker compose -f docker-compose.yml up -d db
cat ~/backups/senoriales-pre-update-*.dump | docker exec -i artificial-intelligence-db-1 \
  pg_restore -U senoriales -d senoriales --clean --if-exists --no-owner
```
