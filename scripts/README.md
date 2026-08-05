# scripts/

Scripts operativos que corren en la VM de producción (`centro-de-negocios.org`).

| Script | Propósito | ¿Cuándo? |
|---|---|---|
| `deploy.sh` | Pull-based CI/CD: pull de `develop`, rebuild, restart de containers | Cada 2 min vía cron |
| `setup-cron.sh` | Registra `deploy.sh` en el crontab del usuario | Una vez por host (o tras mover el script) |
| `init-ssl.sh` | Genera certificado SSL inicial con Let's Encrypt | Una vez al levantar el dominio |

Todos resuelven el repo desde su propia ubicación (`$SCRIPT_DIR/..`), así que se pueden ejecutar desde cualquier `cwd`.

---

## ⚠️ Migración (post-merge — requerido)

Antes de esta versión, los scripts vivían en la **raíz** del repo. El cron del servidor de prod tiene registrado el path viejo, por ejemplo:

```
*/2 * * * * /opt/senoriales/deploy.sh >> /opt/senoriales/deploy.log 2>&1
```

Cuando el merge llegue al servidor (vía el último ciclo del cron viejo que sí funcionará porque el git pull aún encuentra el `deploy.sh` viejo justo antes de moverse), el siguiente ciclo del cron va a fallar silenciosamente porque `/opt/senoriales/deploy.sh` ya no existe.

**En la VM de prod**, una vez tras hacer pull manual:

```bash
cd /opt/senoriales
git pull origin develop
./scripts/setup-cron.sh 2
crontab -l   # verificar que la entrada apunta a scripts/deploy.sh
```

A partir de ese momento el auto-deploy queda restaurado.
