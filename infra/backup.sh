#!/usr/bin/env bash
# =============================================================================
# Backup de la base de Señoriales (capa_01). Pensado para correr por cron cada 6h
# (ver infra/senoriales-backup.cron). Hace pg_dump en formato custom (comprimido,
# restaurable con pg_restore), valida que no quedó vacío y aplica retención.
#
# Restaurar un backup:
#   cat /opt/backups/senoriales-YYYYMMDD-HHMMSS.dump | \
#     docker compose -f /opt/senoriales/docker-compose.prod.yml exec -T db \
#     pg_restore -U senoriales -d senoriales --clean --if-exists --no-owner
# =============================================================================
set -euo pipefail

COMPOSE_DIR="/opt/senoriales"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/opt/backups"
RETENTION_DAYS=7

TS="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/senoriales-${TS}.dump"

mkdir -p "$BACKUP_DIR"
cd "$COMPOSE_DIR"

# Dump (custom format). -T = sin TTY (necesario en cron).
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U senoriales senoriales --format=custom --no-owner --no-acl > "$OUT"

# Si el dump quedó vacío, fue un fallo: borrarlo y salir con error (lo verás en el log).
if [ ! -s "$OUT" ]; then
  echo "$(date -Is) ERROR: dump vacío, se elimina $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

# --- Offsite (RECOMENDADO contra pérdida de disco; descomentar si hay 2º host) ---
# Single-node sin copia offsite = un disco perdido se lleva todos los backups.
# rsync -a "$BACKUP_DIR"/ root@10.4.6.4:/opt/backups-capa01/ \
#   || echo "$(date -Is) WARN: rsync offsite falló" >&2

# Retención local.
find "$BACKUP_DIR" -name 'senoriales-*.dump' -mtime "+${RETENTION_DAYS}" -delete

echo "$(date -Is) OK: backup $OUT ($(du -h "$OUT" | cut -f1))"
