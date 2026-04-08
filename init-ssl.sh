#!/bin/bash
# ============================================
# Script para obtener certificados SSL con Let's Encrypt
# Dominio: centro-de-negocios.org
# ============================================

set -e

DOMAIN="centro-de-negocios.org"
EMAIL="${1:-admin@centro-de-negocios.org}"

echo "=== Configurando SSL para $DOMAIN ==="

# 1. Crear directorios necesarios
mkdir -p nginx/ssl certbot/www

# 2. Crear certificado temporal para que nginx arranque
if [ ! -f nginx/ssl/fullchain.pem ]; then
    echo "Generando certificado temporal auto-firmado..."
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout nginx/ssl/privkey.pem \
        -out nginx/ssl/fullchain.pem \
        -subj "/CN=$DOMAIN"
fi

# 3. Levantar nginx con el certificado temporal
echo "Levantando nginx..."
docker compose up -d nginx

# 4. Obtener certificado real con Certbot
echo "Solicitando certificado a Let's Encrypt..."
docker run --rm \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    -v "$(pwd)/nginx/ssl:/etc/letsencrypt/live/$DOMAIN" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# 5. Copiar certificados al lugar correcto
echo "Copiando certificados..."
if [ -f "nginx/ssl/live/$DOMAIN/fullchain.pem" ]; then
    cp "nginx/ssl/live/$DOMAIN/fullchain.pem" nginx/ssl/fullchain.pem
    cp "nginx/ssl/live/$DOMAIN/privkey.pem" nginx/ssl/privkey.pem
fi

# 6. Reiniciar nginx con el certificado real
echo "Reiniciando nginx con certificado SSL..."
docker compose restart nginx

echo ""
echo "=== SSL configurado exitosamente ==="
echo "Tu sitio está disponible en: https://$DOMAIN"
echo ""
echo "Para renovar el certificado automáticamente, agrega este cron:"
echo "0 0 1 * * cd $(pwd) && docker run --rm -v $(pwd)/certbot/www:/var/www/certbot -v $(pwd)/nginx/ssl:/etc/letsencrypt certbot/certbot renew && docker compose restart nginx"
