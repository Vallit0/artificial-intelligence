# Runbooks Operativos — Plataforma Señoriales

> Procedimientos operativos bajo el marco de gobernanza **ITIL 4**.
> Cada runbook declara la práctica ITIL asociada, propósito, precondiciones, pasos,
> criterios de éxito, rollback y registro post-ejecución.

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-04-21 |
| Marco de referencia | ITIL 4 — Service Value System, prácticas de gestión |
| Aplica a | Plataforma Señoriales (producción y staging) |

> **Nota sobre ITIL**: la versión vigente del marco es ITIL 4 (publicada por Axelos desde 2019). No existe oficialmente una "v5"; este documento usa ITIL 4 con sus 34 prácticas de gestión. Si la nomenclatura institucional difiere, la estructura aquí definida sigue siendo compatible.

---

## Índice

| ID | Runbook | Práctica ITIL 4 |
|---|---|---|
| [RB-01](#rb-01) | Incidente — aplicación caída o `/health` degradado | Incident Management |
| [RB-02](#rb-02) | Incidente — base de datos inaccesible | Incident Management |
| [RB-03](#rb-03) | Incidente — fallo de ElevenLabs / IA conversacional | Incident Management |
| [RB-04](#rb-04) | Cambio — despliegue de nueva versión a producción | Change Enablement |
| [RB-05](#rb-05) | Continuidad — backup y restauración de PostgreSQL | Service Continuity Management |
| [RB-06](#rb-06) | Seguridad — rotación de secretos y API keys | Information Security Management |
| [RB-07](#rb-07) | Acceso — alta / baja / cambio de rol de usuarios | Access Management (parte de Security) |
| [RB-08](#rb-08) | Infraestructura — renovación de certificado SSL | Infrastructure and Platform Management |

---

## Convenciones

### Plantilla de cada runbook

Cada procedimiento incluye:

- **ID y título**
- **Práctica ITIL asociada**
- **Propósito**: por qué existe el runbook.
- **Severidad / prioridad esperada** (solo incidentes): P1/P2/P3/P4.
- **Disparadores**: qué hecho inicia el runbook.
- **Roles (RACI)**: quién ejecuta, quién consulta, quién aprueba, quién es informado.
- **Precondiciones**: accesos, herramientas, ventana.
- **Pasos**: procedimiento numerado.
- **Criterios de éxito**: cómo sabemos que terminó bien.
- **Rollback / recuperación**: qué hacer si falla.
- **Escalamiento**: a quién y cuándo.
- **Post-ejecución**: registro, métricas, comunicación.

### Severidades (para incidentes)

| Sev | Impacto | Ejemplo | SLO de respuesta inicial |
|---|---|---|---|
| P1 | Servicio caído total | `/health` falla, login imposible | 15 min |
| P2 | Funcionalidad crítica degradada | Práctica sin voz | 1 h |
| P3 | Funcionalidad secundaria | Email de reset sin enviar | 4 h laborales |
| P4 | Cosmético / sin impacto operativo | Texto mal alineado | Backlog |

### Roles

| Rol | Responsabilidades |
|---|---|
| **Service Owner** | Dueño del servicio Señoriales |
| **On-call / SRE** | Primera respuesta operativa |
| **DBA** | Administrador de PostgreSQL / RDS |
| **Product Owner** | Decisiones de prioridad funcional |
| **Security Officer** | Aprobación de cambios en secretos / accesos |
| **Infra / Cloud** | Huawei Cloud, red, DNS |

---

<a name="rb-01"></a>

## RB-01 — Incidente: aplicación caída o `/health` degradado

**Práctica ITIL 4**: Incident Management.
**Severidad por defecto**: P1 (si `/health` devuelve 5xx o no responde).

### Propósito

Restablecer disponibilidad del servicio cuanto antes, con mínima pérdida de datos y con evidencia suficiente para el post-incident review.

### Disparadores

- Probe externo sobre `/health` falla por ≥2 min.
- Usuarios reportan "no carga la página" o "error 502".
- Alertas de CPU/RAM del contenedor `app` en rojo.

### RACI

| Paso | On-call | DBA | Infra | Service Owner |
|---|---|---|---|---|
| Diagnóstico | R | C | C | I |
| Mitigación | R | C | C | I |
| Comunicación | R | I | I | A |
| Post-mortem | C | C | C | R/A |

### Precondiciones

- Acceso SSH al ECS.
- Permisos Docker en la máquina.
- Credenciales de Huawei Cloud Console (backup).

### Pasos

1. **Verificar el síntoma desde fuera**
   ```bash
   curl -i https://<app-url>/health
   ```
   Anotar código HTTP, latencia y cuerpo.

2. **Comprobar estado de los contenedores**
   ```bash
   docker-compose ps
   docker stats --no-stream
   ```
   Si `app` está en `Restarting` o `Exit`: ir al paso 3.
   Si todos `Up` pero `/health` falla: ir al paso 4.

3. **Revisar logs del contenedor `app`**
   ```bash
   docker-compose logs --tail=200 app
   ```
   Buscar: `ECONNREFUSED`, `PrismaClientInitializationError`, `Missing config`.
   - Si indica DB: pasar a **RB-02**.
   - Si indica `JWT_SECRET must be set`: restaurar `.env` y continuar con paso 5.

4. **Verificar conectividad de red saliente**
   ```bash
   docker-compose exec app sh -c "wget -qO- https://api.elevenlabs.io > /dev/null && echo OK || echo FAIL"
   ```
   Si falla: abrir incidente con Infra (firewall / security group).

5. **Reinicio controlado**
   ```bash
   docker-compose restart app
   sleep 15
   curl -i https://<app-url>/health
   ```

6. **Si persiste**, reconstruir desde última imagen buena conocida:
   ```bash
   git log --oneline -5
   git checkout <sha-conocido-bueno>
   docker-compose up -d --build app
   ```

7. **Comunicación**: publicar estado en canal de incidentes cada 30 min hasta resolución.

### Criterios de éxito

- `/health` responde `200 OK` con `{"status":"ok"}` durante 5 min seguidos.
- Tasa de errores 5xx en Nginx <0.1%.
- Usuarios reportan acceso normal.

### Rollback

Si el último despliegue es sospechoso, ver **RB-04** sección "rollback de release".

### Escalamiento

- 30 min sin resolución → Service Owner.
- 1 h sin resolución → Product Owner + comunicación a usuarios.
- Error persistente tras rollback → ticket con Infra/Cloud.

### Post-ejecución

- Registrar en bitácora: timestamp inicio, timestamp resolución, causa raíz, acciones.
- Post-mortem en ≤5 días hábiles si fue P1.
- Actualizar este runbook si la causa no estaba cubierta.

---

<a name="rb-02"></a>

## RB-02 — Incidente: base de datos inaccesible

**Práctica ITIL 4**: Incident Management.
**Severidad**: P1.

### Disparadores

- Logs `app` con `PrismaClientInitializationError` o `ECONNREFUSED :5432`.
- `/health` devuelve `{"services":{"database":"disconnected"}}`.
- Alerta de RDS / contenedor `db`.

### Pasos

1. **Determinar si la DB es contenedor o RDS externo**
   ```bash
   grep DATABASE_URL server/.env
   ```
   - Host `db` → contenedor local (paso 2).
   - Host externo → RDS (paso 3).

2. **DB en contenedor**
   ```bash
   docker-compose ps db
   docker-compose logs --tail=100 db
   docker-compose exec db pg_isready -U senoriales -d senoriales
   ```
   Si `Exit`, revisar volumen:
   ```bash
   docker volume inspect senoriales_postgres_data
   df -h   # comprobar espacio en disco
   ```
   Si disco lleno: liberar espacio (logs antiguos, imágenes Docker) y `docker-compose start db`.

3. **DB en RDS**
   - Verificar desde Huawei Cloud Console: estado de la instancia RDS.
   - Probar conectividad desde el ECS:
     ```bash
     docker-compose exec app sh -c "nc -zv $(echo $DATABASE_URL | sed -E 's|.*@([^:]+):.*|\1|') 5432"
     ```
   - Si no conecta: revisar security group RDS y whitelist de IP.
   - Si conecta pero autenticación falla: verificar credenciales y rotar si es necesario (**RB-06**).

4. **Prueba funcional**
   ```bash
   docker-compose exec app sh -c "node -e \"const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\\$queryRaw\\\`SELECT 1\\\`.then(r=>console.log('OK',r)).catch(e=>{console.error(e.message);process.exit(1)})\""
   ```

5. **Reanudar tráfico** tras confirmar `/health` OK.

### Criterios de éxito

- Consulta `SELECT 1` responde en <200 ms.
- `/health` OK durante 5 min.
- No hay acumulación de conexiones en `pg_stat_activity`.

### Rollback

- Si se hizo una migración reciente y falla: ver "Restore" en **RB-05**.

### Escalamiento

- 30 min → DBA + Infra.
- Pérdida de datos sospechada → Service Owner + Security Officer inmediato.

### Post-ejecución

- Registrar consumo de recursos de RDS justo antes del incidente.
- Validar integridad: `SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM practice_sessions;` comparar con métrica esperada.

---

<a name="rb-03"></a>

## RB-03 — Incidente: fallo de ElevenLabs / IA conversacional

**Práctica ITIL 4**: Incident Management (dependencia externa).
**Severidad**: P2 por defecto (plataforma funciona, pero práctica sin voz).

### Disparadores

- Frontend reporta "no se pudo iniciar la conversación".
- Logs aplicativos con `401`, `403` o `5xx` desde `api.elevenlabs.io`.
- Usuarios no escuchan al agente.

### Pasos

1. **Confirmar el estado del proveedor**
   - Consultar [status.elevenlabs.io](https://status.elevenlabs.io).
   - Si hay incidente declarado: ir al paso 5 (comunicación).

2. **Verificar credenciales**
   ```bash
   docker-compose exec app sh -c 'env | grep ELEVENLABS'
   curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/user | head -c 500
   ```
   - `401` → key revocada o expirada → pasar a **RB-06**.

3. **Probar el endpoint de signed URL**
   ```bash
   curl -s -X GET -H "xi-api-key: $ELEVENLABS_API_KEY" \
     "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=$ELEVENLABS_AGENT_ID"
   ```
   Debe devolver `{"signed_url": "wss://..."}`.

4. **Verificar conectividad saliente**
   ```bash
   docker-compose exec app sh -c "curl -I https://api.elevenlabs.io"
   ```

5. **Comunicación** a usuarios si el incidente es del proveedor:
   - Banner en app (feature flag de mantenimiento, si existe).
   - Mensaje por email/WhatsApp a cohortes activas.
   - Registro estimado de recuperación.

6. **Mientras dura la degradación**: el resto de la plataforma (escenarios, progreso, dashboards, LTI) sigue operativo. Sesiones en curso se cortan; sesiones nuevas fallarán hasta restitución.

### Criterios de éxito

- `get-signed-url` responde 200 con WS URL válida.
- Una sesión de prueba completa el handshake WebSocket.

### Escalamiento

- >2 h degradación → ticket con soporte de ElevenLabs.
- >4 h → Service Owner evalúa comunicación ampliada.

### Post-ejecución

- Anotar duración, agentes afectados, número de sesiones perdidas.
- Evaluar si el SLA del proveedor justifica crédito/reclamo.

---

<a name="rb-04"></a>

## RB-04 — Cambio: despliegue de nueva versión a producción

**Práctica ITIL 4**: Change Enablement (antes "Change Management").
**Tipo de cambio**: Standard (rutinario, pre-aprobado) si es merge de `develop` → `main` sin cambios de esquema. Normal (requiere aprobación CAB) si incluye migración destructiva.

### Propósito

Promover código nuevo a producción con trazabilidad, ventana controlada y rollback reproducible.

### Precondiciones

- PR aprobado y fusionado a `main`.
- Tests verdes en CI (o validación manual equivalente documentada).
- Backup reciente de DB (≤24 h). Si no hay, ejecutar **RB-05** antes.
- Ventana de cambio acordada (fuera de pico, 22:00–06:00 sugerido).
- Comunicación previa si el cambio implica downtime.

### RACI

| Paso | Dev | On-call | Service Owner | CAB |
|---|---|---|---|---|
| Preparación | R | C | A | I (si Normal) |
| Ejecución | C | R | A | — |
| Validación | R | R | C | — |
| Post | R | C | A | I |

### Pasos

1. **Registrar el cambio** (ticket): descripción, impacto, rollback plan, ventana.

2. **Capturar el SHA actual como punto de rollback**
   ```bash
   git -C /opt/senoriales rev-parse HEAD > /tmp/rollback-sha-$(date +%F).txt
   docker images --format '{{.Repository}}:{{.Tag}}' | grep senoriales
   ```

3. **Backup de DB** (si hay migración): ver **RB-05** paso 1-3.

4. **Bajar a modo lectura** (opcional, si hay cambio con riesgo):
   - Nginx: devolver 503 temporal, o mantener tráfico y anunciar banner de mantenimiento en SPA.

5. **Actualizar el código**
   ```bash
   cd /opt/senoriales
   git fetch --all
   git checkout main
   git pull --ff-only
   ```

6. **Construir y levantar**
   ```bash
   docker-compose build app
   docker-compose up -d app
   ```

7. **Ejecutar migraciones**
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```
   Si hay error: **no continuar**, ir a rollback.

8. **Smoke tests post-despliegue**
   ```bash
   curl -s https://<app-url>/health | jq
   ```
   Validar manualmente en navegador:
   - Login con cuenta de prueba.
   - Inicio de una sesión de práctica (verifica ElevenLabs + DB).
   - Dashboard de progreso (verifica queries complejas).

9. **Monitoreo observado** durante 30 min: errores 5xx, latencia, CPU/RAM, tasa de nuevas sesiones.

10. **Cerrar el cambio** en el sistema de tickets: resultado, duración, incidentes asociados (si los hubo).

### Rollback (si falla el despliegue)

```bash
cd /opt/senoriales
ROLLBACK_SHA=$(cat /tmp/rollback-sha-$(date +%F).txt)
git checkout "$ROLLBACK_SHA"
docker-compose up -d --build app
# Si hubo migración destructiva, restaurar DB desde backup (RB-05)
```

### Criterios de éxito

- `/health` OK por 30 min post-cambio.
- Errores 5xx <0.1% comparado con baseline previo.
- Smoke tests pasan.

### Post-ejecución

- Tag git de release: `vYYYY.MM.DD` o semántico.
- Notas de release en el sistema de tickets.
- Si hubo incidente: post-mortem.

---

<a name="rb-05"></a>

## RB-05 — Continuidad: backup y restauración de PostgreSQL

**Práctica ITIL 4**: Service Continuity Management.

### Propósito

Garantizar recuperabilidad ante corrupción de datos, borrado accidental o desastre de infraestructura. RPO objetivo: ≤24 h. RTO objetivo: ≤2 h.

### 5.A Backup programado (diario)

#### Pasos

1. **Backup lógico** (contenedor Docker):
   ```bash
   TS=$(date +%Y%m%d_%H%M%S)
   docker-compose exec -T db pg_dump -U senoriales -d senoriales --no-owner --clean --if-exists \
     > /opt/backups/senoriales_${TS}.sql
   gzip /opt/backups/senoriales_${TS}.sql
   ```

2. **Backup lógico** (RDS externo):
   ```bash
   pg_dump "$DATABASE_URL" --no-owner --clean --if-exists | gzip > /opt/backups/senoriales_${TS}.sql.gz
   ```

3. **Sincronizar fuera del host** (a OBS/S3/Drive):
   ```bash
   # Ejemplo genérico — adaptar al proveedor
   rclone copy /opt/backups remote:senoriales-backups/ --include "*.sql.gz"
   ```

4. **Rotación**: conservar 7 diarios, 4 semanales, 12 mensuales. Script cron:
   ```bash
   find /opt/backups -name "*.sql.gz" -mtime +7 -delete
   ```

5. **Verificación periódica** (mensual): tomar el backup más reciente y restaurarlo en un entorno sandbox para confirmar integridad (ver 5.B).

### 5.B Restauración

#### Precondiciones

- Backup `.sql.gz` disponible.
- Ventana aprobada de indisponibilidad o entorno sandbox.
- Comunicación al Service Owner.

#### Pasos

1. **Detener tráfico a la app**
   ```bash
   docker-compose stop app
   ```

2. **Crear una copia de seguridad del estado actual** (antes de destruir):
   ```bash
   TS=$(date +%Y%m%d_%H%M%S)
   docker-compose exec -T db pg_dump -U senoriales senoriales | gzip > /opt/backups/pre-restore_${TS}.sql.gz
   ```

3. **Restaurar** (contenedor):
   ```bash
   gunzip -c /opt/backups/senoriales_<FECHA>.sql.gz | \
     docker-compose exec -T db psql -U senoriales -d senoriales
   ```

   **Restaurar** (RDS):
   ```bash
   gunzip -c /opt/backups/senoriales_<FECHA>.sql.gz | psql "$DATABASE_URL"
   ```

4. **Validar integridad**
   ```sql
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM practice_sessions;
   SELECT MAX(created_at) FROM practice_sessions;
   ```
   Comparar con valores esperados.

5. **Levantar app y smoke test**
   ```bash
   docker-compose up -d app
   curl https://<app-url>/health
   ```

### Criterios de éxito

- Conteos de entidades críticas coinciden con el backup origen.
- `/health` OK.
- Login y sesión de prueba funcionan.

### Post-ejecución

- Registrar: fecha del backup restaurado, duración de la restauración, diferencias detectadas.
- Si hubo pérdida de datos aceptada: comunicar a usuarios afectados.

---

<a name="rb-06"></a>

## RB-06 — Seguridad: rotación de secretos y API keys

**Práctica ITIL 4**: Information Security Management.

### Propósito

Sustituir credenciales (JWT_SECRET, API keys de terceros, contraseña DB) por exposición, vencimiento o política periódica (≥ cada 90 días recomendado).

### Aplica a

| Secreto | Ubicación | Impacto al rotar |
|---|---|---|
| `JWT_SECRET` | `server/.env` | Invalida todos los access/refresh tokens vivos (usuarios deben re-loguear) |
| `DATABASE_URL` (password) | `server/.env` + RDS/Postgres | Requiere reinicio de `app` |
| `ELEVENLABS_API_KEY` | `server/.env` + dashboard ElevenLabs | Cortas las conversaciones activas |
| `OPENAI_API_KEY` | `server/.env` + OpenAI dashboard | Solo afecta evaluaciones |
| `WHAPI_TOKEN` | `server/.env` + dashboard WHAPI (⚠️ valor actual hardcodeado en `config/index.ts:54`) | Corta mensajería WhatsApp |
| `RESEND_API_KEY` | `server/.env` + Resend dashboard | Corta envío de emails |

### Precondiciones

- Aprobación del Security Officer.
- Ventana comunicada (usuarios serán desconectados en caso de `JWT_SECRET`).

### Pasos (genéricos)

1. **Generar nuevo secreto**
   - JWT: `openssl rand -base64 48`
   - API keys: crear en el dashboard del proveedor con permisos mínimos.

2. **Registrar el nuevo valor** en el gestor de secretos institucional (no en chat, no en git).

3. **Actualizar `server/.env` en el servidor**
   ```bash
   ssh user@ecs
   cd /opt/senoriales/server
   sudo cp .env .env.bak-$(date +%F)
   sudo nano .env  # reemplazar el valor
   ```

4. **Reiniciar servicios afectados**
   ```bash
   docker-compose restart app
   docker-compose logs --tail=50 app  # validar arranque sin warnings
   ```

5. **Revocar el valor anterior** en el proveedor (dashboard).

6. **Smoke test** de la funcionalidad dependiente:
   - JWT: login nuevo debe emitir token válido.
   - ElevenLabs: iniciar una sesión de práctica.
   - WHAPI: probar `send_whatsapp_message` desde un agente.

7. **Si aplica** al caso del token WHAPI hardcodeado:
   - Editar `server/src/config/index.ts` eliminando el string literal del fallback.
   - Commit + despliegue (**RB-04**).
   - Auditar historial: `git log -p -- server/src/config/index.ts | grep -i whapi`.
   - Asumir exposición pública desde el primer commit que lo introdujo y rotar.

### Criterios de éxito

- Funcionalidad post-rotación operativa.
- Secreto anterior revocado en el proveedor.
- Registro en el vault con timestamp y responsable.

### Escalamiento

- Sospecha de exposición activa (acceso no autorizado observado): activar **RB-01** como incidente P1 y notificar Security Officer.

### Post-ejecución

- Actualizar fecha de rotación en el inventario de secretos.
- Calendarizar próxima rotación.

---

<a name="rb-07"></a>

## RB-07 — Acceso: alta, baja y cambio de rol de usuarios

**Práctica ITIL 4**: Access Management (componente de Information Security).

### Propósito

Gestionar accesos al sistema Señoriales conforme al principio de mínimo privilegio.

### Roles del sistema

| Rol | Permisos |
|---|---|
| `learner` | Usar la plataforma, practicar, ver su progreso |
| `instructor` | Ver cohortes, calificar sesiones |
| `admin` | Panel admin, configurar agentes, A/B tests, alta/baja |

### 7.A Alta de usuario

#### Vía autoservicio (learners)

Registro desde `/auth/signup`. Rol por defecto: `learner`.

#### Vía LTI (Moodle)

Primer acceso desde Moodle crea el usuario automáticamente con rol derivado del claim LTI.

#### Vía admin (alta manual)

1. Login como `admin` en el panel.
2. Navegar a sección Usuarios → Crear.
3. Completar email, nombre, rol inicial.
4. El sistema envía credenciales o link de activación (según configuración).

### 7.B Cambio de rol

1. Admin → Usuarios → seleccionar usuario.
2. Añadir o quitar rol en la tabla `user_roles`.
3. Para SQL directo (última opción):
   ```sql
   INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), '<uuid>', 'instructor');
   DELETE FROM user_roles WHERE user_id='<uuid>' AND role='admin';
   ```
4. El usuario debe re-loguear para recibir el rol en su JWT.

### 7.C Baja (offboarding)

1. **Invalidar sesiones activas**
   ```sql
   DELETE FROM refresh_tokens WHERE user_id = '<uuid>';
   ```
2. **Desactivar (soft-delete recomendado)**: por ahora el modelo no tiene `is_active`; la práctica es:
   - Retirar todos los roles:
     ```sql
     DELETE FROM user_roles WHERE user_id = '<uuid>';
     ```
   - Anonimizar email (si aplica RGPD/retention):
     ```sql
     UPDATE users SET email = concat('deleted-', id, '@tombstone.local'), password_hash = NULL WHERE id='<uuid>';
     ```
3. **Hard-delete** (solo si política y legal lo permiten):
   ```sql
   DELETE FROM users WHERE id = '<uuid>';  -- cascada elimina dependencias
   ```

### Criterios de éxito

- Usuario no puede iniciar sesión tras baja.
- Logs muestran rechazo en intento de login.
- Auditoría registrada con fecha y responsable.

### Post-ejecución

- Registrar en bitácora de accesos: acción, usuario, rol antes/después, responsable.
- Notificar al supervisor si aplica (learners LTI → instructor).

---

<a name="rb-08"></a>

## RB-08 — Infraestructura: renovación de certificado SSL (Let's Encrypt)

**Práctica ITIL 4**: Infrastructure and Platform Management.

### Propósito

Mantener HTTPS válido; los certificados Let's Encrypt expiran cada 90 días y deben renovarse con anticipación (≥14 días antes).

### Precondiciones

- Cron de renovación configurado (`setup-cron.sh` ejecutado en el host).
- Puerto 80 abierto hacia el mundo (requerido por el challenge HTTP-01).

### Renovación automática (funcionamiento normal)

El cron ejecuta `certbot renew` cada 12 horas. Si el cert está a <30 días de expirar, se renueva y Nginx se recarga.

### Verificación periódica (manual, mensual)

```bash
# Ver fecha de expiración
echo | openssl s_client -servername <app-url> -connect <app-url>:443 2>/dev/null \
  | openssl x509 -noout -dates

# Estado del timer / cron
crontab -l | grep certbot
ls -la /var/log/letsencrypt/ | head
```

### Renovación manual forzada (excepcional)

1. **Ejecutar certbot**
   ```bash
   docker run --rm -it \
     -v /opt/senoriales/certbot/www:/var/www/certbot \
     -v /opt/senoriales/nginx/ssl:/etc/letsencrypt \
     certbot/certbot renew --force-renewal
   ```

2. **Recargar Nginx**
   ```bash
   docker-compose exec nginx nginx -s reload
   ```

3. **Verificar**
   ```bash
   curl -I https://<app-url>
   ```
   Confirmar que no hay warnings de TLS en el browser.

### Si la renovación falla

- **Puerto 80 no accesible**: abrir temporalmente en el security group.
- **Rate limit de Let's Encrypt** (5 renovaciones/semana por dominio): esperar, revisar causas del exceso.
- **DNS mal configurado**: confirmar que el dominio resuelve al ECS actual.

### Criterios de éxito

- Certificado válido ≥60 días hacia adelante.
- Nginx responde con cert nuevo.

### Escalamiento

- Certificado expira en <72 h y la renovación falla: Infra + Service Owner inmediato.

### Post-ejecución

- Registrar fecha de renovación y próxima estimada.

---

## Apéndice A — Mapa de prácticas ITIL 4 cubiertas

| Práctica ITIL 4 | Runbook(s) |
|---|---|
| Incident Management | RB-01, RB-02, RB-03 |
| Problem Management | derivado de post-mortems de RB-01..03 |
| Change Enablement | RB-04 |
| Release Management | RB-04 (combinado) |
| Service Continuity Management | RB-05 |
| Information Security Management | RB-06 |
| Access Management | RB-07 |
| Infrastructure and Platform Management | RB-08 |
| Monitoring and Event Management | Sección 11 del Manual Técnico + `/health` |
| Service Configuration Management | Sección 4, 9 del Manual Técnico + `docker-compose.yml` |
| Service Desk | puntos de contacto en cada runbook (escalamiento) |

Prácticas no desarrolladas aquí (candidatos a siguiente iteración): Capacity and Performance Management, Availability Management, Supplier Management (contratos ElevenLabs / OpenAI / WHAPI), Service Level Management (definición formal de SLAs).

---

## Apéndice B — Plantilla para nuevos runbooks

```markdown
## RB-XX — <Título>

**Práctica ITIL 4**: <nombre>.
**Severidad**: <P1-P4 | N/A>.

### Propósito

### Disparadores

### RACI

| Paso | <rol1> | <rol2> | ... |
|---|---|---|---|
|  |  |  |  |

### Precondiciones

### Pasos

### Criterios de éxito

### Rollback / recuperación

### Escalamiento

### Post-ejecución
```

---

## Apéndice C — Checklist rápido de operación diaria

- [ ] `/health` responde 200 (probe cada 1 min).
- [ ] CPU/RAM del contenedor `app` <80%.
- [ ] Backup diario de DB presente y con tamaño razonable.
- [ ] Certificado SSL con ≥30 días de validez.
- [ ] Logs del día sin errores 5xx repetidos.
- [ ] Tasa de sesiones de práctica dentro del baseline.
- [ ] Proveedores externos (ElevenLabs, OpenAI, WHAPI) sin incidentes declarados.
