# RUNBOOK — Go-Live a 900 usuarios (consolidado en capa_01)

Operación paso a paso. **Acceso de usuarios: directo a `centro-de-negocios.org`**
(no por LTI) → los Moodles NO se cargan en el Go-Live, solo hay que no romperlos.

## Topología

| Servidor | Rol | IP priv / pub |
|---|---|---|
| **capa_01** (12 vCPU / 30 GB, disco 493 GB al 8%) | **Todo Señoriales** (4 réplicas + Postgres + PgBouncer) detrás del **nginx del host** + 3 Moodles + n8n + observabilidad (ya existentes) | `10.4.6.20` / `46.250.172.118` |
| **capa_02** (4 vCPU / 8 GB, disco al 81%) | Hoy corre Señoriales; tras el cutover → **réplica Postgres + backups** (o se libera) | `10.4.6.4` / `101.44.189.13` |

Convivencia en capa_01: Postgres de Señoriales en Docker (5432 **interno**, sin
publicar) no choca con MariaDB (3306) de los Moodles. Las réplicas se publican en
`127.0.0.1:4001-4004` y las enruta el nginx del host. **No se levanta nginx en Docker.**

---

## Fase 0 — Pre-requisitos en capa_01 (sin downtime)

```bash
docker --version && docker compose version
git clone <repo> /opt/senoriales && cd /opt/senoriales
git checkout develop && git pull

cp .env.prod.example server/.env
openssl rand -base64 24   # → POSTGRES_PASSWORD
openssl rand -base64 48   # → JWT_SECRET
nano server/.env          # DB, JWT, ElevenLabs, WHAPI rotado, Resend

# Confirmar que 4001-4004 están libres (3001 está ocupado por otro servicio)
ss -tlnp | grep -E ':(4001|4002|4003|4004)\b' || echo "4001-4004 LIBRES"
```

---

## Fase 1 — Backup de la base actual (en capa_02)

```bash
mkdir -p ~/backups
docker exec artificial-intelligence-db-1 pg_dump -U senoriales senoriales \
  --format=custom --no-owner --no-acl \
  > ~/backups/senoriales-pre-golive-$(date +%Y%m%d-%H%M%S).dump
scp ~/backups/senoriales-pre-golive-*.dump root@10.4.6.20:/opt/senoriales/
```

---

## Fase 2 — Postgres en capa_01 + restaurar datos

```bash
cd /opt/senoriales
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml exec db pg_isready -U senoriales

# Restaurar (datos + schema; queda SIN _prisma_migrations)
cat senoriales-pre-golive-*.dump | docker compose -f docker-compose.prod.yml \
  exec -T db pg_restore -U senoriales -d senoriales --clean --if-exists --no-owner

docker compose -f docker-compose.prod.yml exec db \
  psql -U senoriales -d senoriales -c "SELECT count(*) FROM users;"
```

### Baseline de migraciones (CRÍTICO — no re-ejecuta DDL)
```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps \
  -e DATABASE_URL="postgresql://senoriales:${POSTGRES_PASSWORD}@db:5432/senoriales" \
  migrate npx prisma migrate resolve --applied 0_init
```

---

## Fase 3 — Levantar el stack de Señoriales (sin nginx)

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps     # migrate=Exited(0); resto healthy

# Las 4 réplicas responden en loopback:
for p in 4001 4002 4003 4004; do curl -fsS http://127.0.0.1:$p/health/ready >/dev/null \
  && echo "app $p OK" || echo "app $p FALLA"; done
# Crons SOLO en worker:
docker compose -f docker-compose.prod.yml logs worker | grep -i "NRPS cron started"
```

---

## Fase 4 — Integrar al nginx del HOST + TLS sin bache

```bash
# 1. Upstream + zonas de rate-limit (ámbito http)
cp infra/nginx-host/10-senoriales-upstream.conf /etc/nginx/conf.d/

# 2. Vhost
cp infra/nginx-host/centro-de-negocios.org.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/centro-de-negocios.org.conf /etc/nginx/sites-enabled/

# 3. Certificado: COPIAR el existente desde capa_02 (evita re-emitir, que
#    dependería de que el DNS ya apunte aquí). En capa_02:
#      tar czf /tmp/le-cdn.tgz -C /etc/letsencrypt \
#        live/centro-de-negocios.org archive/centro-de-negocios.org \
#        renewal/centro-de-negocios.org.conf
#      scp /tmp/le-cdn.tgz root@10.4.6.20:/tmp/
#    En capa_01:
tar xzf /tmp/le-cdn.tgz -C /etc/letsencrypt
certbot install --nginx --cert-name centro-de-negocios.org   # inyecta TLS al vhost

# 4. Validar y recargar SIN tirar los Moodles
nginx -t && systemctl reload nginx
```
> Alternativa (si no copias el cert): hacer el cutover de DNS primero (Fase 5) y
> luego `certbot --nginx -d centro-de-negocios.org -d www.centro-de-negocios.org`.
> Tiene un bache breve sin HTTPS hasta que emite — por eso se prefiere copiar.

Prueba local antes del DNS (forzando el Host):
```bash
curl -fsS --resolve centro-de-negocios.org:443:127.0.0.1 \
  https://centro-de-negocios.org/health/ready ; echo
```

---

## Fase 5 — Cutover (Go-Live)

1. Ventana corta: en capa_02, **freeze de escrituras** (o avisar downtime breve) y
   dump final delta → restaurar en capa_01 (repetir Fase 1-2; el `--clean` reemplaza).
2. **DNS** `centro-de-negocios.org` y `www` → `46.250.172.118` (capa_01).
3. Verificar end-to-end (abajo) con tráfico real.
4. Apagar el stack viejo en capa_02 (`docker compose down`).

---

## Fase 6 — capa_02 como red de seguridad + observabilidad

- **Réplica Postgres** en capa_02 (streaming desde capa_01): crear rol `replicator`
  en el primario, exponer 5432 del primario SOLO en `10.4.6.20` (descomentar el
  `ports` en `db` del compose), y en capa_02 `pg_basebackup -h 10.4.6.20 -U replicator
  -R` → arrancar standby. Verificar `pg_stat_replication`.
  *Mínimo viable si falta tiempo: backups automáticos (abajo) en vez de streaming.*
- **Observabilidad: NO desplegar nada nuevo** — Loki ya corre en capa_01 (:3100,
  contenedor `loki`) y el `promtail` de este stack ya apunta ahí. En Grafana
  (`recruitment-grafana`, :3000) agregar Loki (`http://loki:3100`) como datasource y
  armar dashboards (5xx, p95 por ruta desde logs pino, P2024, saturación PgBouncer).
- **Backups automáticos** (must-have) — cron en capa_01:
  ```
  0 */6 * * * root docker compose -f /opt/senoriales/docker-compose.prod.yml exec -T db \
    pg_dump -U senoriales senoriales --format=custom --no-owner \
    > /opt/backups/senoriales-$(date +\%Y\%m\%d-\%H\%M).dump && \
    rsync -a /opt/backups/ root@10.4.6.4:/opt/backups-capa01/ && \
    find /opt/backups -name '*.dump' -mtime +7 -delete
  ```

---

## Fase 7 — Load test + hardening (antes/después del cutover)

**Load test** (el de `stress/stress.mjs` corre desde 1 IP → mide el throttler, no el
backend). Medir capacidad real con multi-IP (laptop + capa_02 + VM cloud) o en
staging subiendo temporalmente la zona `sen_api`. Escenario realista (acceso directo,
creación de usuarios):
```powershell
$env:STRESS_BASE_URL="https://centro-de-negocios.org"; $env:STRESS_ADMIN_EMAIL="..."; $env:STRESS_ADMIN_PASSWORD="..."
node stress/stress.mjs --users=300 --bulk=50 --bulks=4 --read-secs=120 --concurrency=40
```
Objetivos: p95<300ms · 0% 5xx (no rate-limit) · sin P2024 · CPU capa_01<70% · PgBouncer
estable. Si no cumple: 4→6 réplicas (añadir `app5/app6` + puertos + upstream) y/o subir
`DEFAULT_POOL_SIZE`. **Documentar el límite real** para el CEO.

**Hardening:**
- [ ] `POSTGRES_PASSWORD` / `JWT_SECRET` fuertes (no defaults).
- [ ] Token **WHAPI rotado** (quedó en el historial git).
- [ ] 5432/6432 no publicados a IP pública (5432 solo a `10.4.6.20` si hay réplica).
- [ ] Cambiar password del admin sembrado (`admin@gmail.com`).

---

## Verificación end-to-end
- `docker compose -f docker-compose.prod.yml ps` → `migrate` Exited(0), resto healthy.
- `nginx -t` OK y los Moodles (`moodle.senoriales.org`, etc.) siguen respondiendo.
- `curl https://centro-de-negocios.org/health/ready` → 200.
- Login real + dashboard + iniciar práctica de voz (ElevenLabs directo) OK.
- Crons 1 sola vez (logs `worker`). Logs llegando a Loki (Grafana → Explore `{service="app1"}`).
- `cd server && npm test` verde (Postgres efímero, no toca prod).

---

## Rollback / Failover
- **Rollback:** `docker compose -f docker-compose.prod.yml down` en capa_01 + quitar el
  symlink del vhost + `systemctl reload nginx`; re-apuntar DNS a capa_02 (`101.44.189.13`).
  El stack viejo en capa_02 sigue intacto hasta el paso 5.4.
- **Restore:** `pg_restore -U senoriales -d senoriales --clean --if-exists` con el último
  `.dump` de `/opt/backups`.
- **Failover DB:** promover la standby de capa_02 (`SELECT pg_promote();`) y apuntar
  `DB_HOST` de PgBouncer a `10.4.6.4`. Ensayar una vez antes del Go-Live.
