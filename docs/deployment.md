# Señoriales - Guía de Despliegue en Huawei Cloud

## Resumen del Sistema

Plataforma de entrenamiento de ventas con IA conversacional. Arquitectura monolítica Node.js/Express con PostgreSQL.

---

## 1. Requisitos de Infraestructura

### 1.1 Servidor de Aplicación (ECS)

| Especificación | Mínimo | Recomendado |
|----------------|--------|-------------|
| vCPU | 2 | 4 |
| RAM | 4 GB | 8 GB |
| Almacenamiento | 50 GB SSD | 100 GB SSD |
| Sistema Operativo | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Software requerido:**
- Docker >= 24.0
- Docker Compose >= 2.20
- Git (para despliegue inicial)

### 1.2 Base de Datos (RDS PostgreSQL)

| Especificación | Mínimo | Recomendado |
|----------------|--------|-------------|
| Versión | PostgreSQL 15 | PostgreSQL 15+ |
| vCPU | 1 | 2 |
| RAM | 2 GB | 4 GB |
| Almacenamiento | 20 GB | 50 GB |
| Conexiones | 100 | 200 |

**Configuración requerida:**
- SSL habilitado
- Conexiones desde ECS permitidas
- Usuario con permisos CREATE, ALTER, DROP, SELECT, INSERT, UPDATE, DELETE

---

## 2. Configuración de Red

### 2.1 Puertos Requeridos

| Puerto | Protocolo | Dirección | Descripción |
|--------|-----------|-----------|-------------|
| 443 | HTTPS | Entrante | Tráfico web (obligatorio) |
| 80 | HTTP | Entrante | Redirect a HTTPS |
| 3000 | TCP | Interno | Aplicación Node.js |
| 5432 | TCP | Interno | PostgreSQL (solo ECS→RDS) |

### 2.2 Acceso Saliente Requerido

La aplicación necesita conectarse a estos servicios externos:

| Dominio | Puerto | Propósito |
|---------|--------|-----------|
| `api.elevenlabs.io` | 443 | IA Conversacional |
| `api.openai.com` | 443 | Evaluación IA |

---

## 3. Variables de Entorno

Crear archivo `.env` en el servidor con las siguientes variables:

```bash
# === OBLIGATORIAS ===

# Conexión a PostgreSQL RDS
DATABASE_URL=postgresql://usuario:contraseña@host-rds:5432/senoriales?sslmode=require

# Secreto para tokens JWT (generar con: openssl rand -base64 32)
JWT_SECRET=tu-secreto-jwt-de-32-caracteres-minimo

# URL pública de la aplicación
APP_URL=https://tu-dominio.com

# Orígenes permitidos para CORS (separar con comas si hay varios)
CORS_ORIGIN=https://tu-dominio.com

# === APIs EXTERNAS ===

# ElevenLabs (IA Conversacional)
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxxxxx

# OpenAI (Evaluación de sesiones)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# === OPCIONALES ===

# Entorno (production para despliegue)
NODE_ENV=production

# Puerto interno (por defecto 3000)
PORT=3000
```

**⚠️ IMPORTANTE:** Las API keys serán proporcionadas por el cliente después del despliegue inicial.

---

## 4. Instrucciones de Despliegue

### 4.1 Preparación Inicial

```bash
# 1. Conectarse al servidor ECS
ssh usuario@ip-del-servidor

# 2. Instalar Docker (si no está instalado)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Crear directorio de aplicación
mkdir -p /opt/senoriales
cd /opt/senoriales
```

### 4.2 Despliegue con Docker

```bash
# 1. Copiar archivos del proyecto al servidor
# (usar scp, git clone, o el método preferido)

# 2. Navegar al directorio del servidor
cd /opt/senoriales/server

# 3. Crear archivo .env con las variables (ver sección 3)
nano .env

# 4. Construir y ejecutar
docker-compose up -d --build

# 5. Verificar que está corriendo
docker-compose ps
docker-compose logs -f app
```

### 4.3 Inicializar Base de Datos

Si se usa RDS externo (recomendado), ejecutar el schema manualmente:

```bash
# Conectarse a RDS y ejecutar el schema
psql $DATABASE_URL -f src/db/schema.sql
```

Si se usa PostgreSQL en Docker (solo desarrollo):
```bash
# El schema se ejecuta automáticamente al iniciar
docker-compose up -d
```

---

## 5. Verificación del Despliegue

### 5.1 Health Check

```bash
# Verificar que la aplicación responde
curl https://tu-dominio.com/health

# Respuesta esperada:
# {"status":"ok","timestamp":"2024-XX-XXTXX:XX:XX.XXXZ"}
```

### 5.2 Verificar Logs

```bash
# Ver logs en tiempo real
docker-compose logs -f app

# Logs esperados al iniciar:
# 🚀 Server running on port 3000
# 📊 Environment: production
```

### 5.3 Verificar Conexión a Base de Datos

```bash
# Entrar al contenedor
docker-compose exec app sh

# Verificar conexión (desde dentro del contenedor)
node -e "const {Pool} = require('pg'); const p = new Pool({connectionString: process.env.DATABASE_URL}); p.query('SELECT NOW()').then(r => console.log('DB OK:', r.rows[0])).catch(e => console.error('DB Error:', e.message))"
```

---

## 6. Configuración de Nginx/Reverse Proxy

Si se usa Nginx como reverse proxy:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Configuración SSL recomendada
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts para conexiones WebSocket
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

---

## 7. Comandos de Mantenimiento

```bash
# Reiniciar aplicación
docker-compose restart app

# Actualizar a nueva versión
git pull origin main
docker-compose up -d --build

# Ver uso de recursos
docker stats

# Backup de base de datos (si usa PostgreSQL en Docker)
docker-compose exec db pg_dump -U senoriales senoriales > backup_$(date +%Y%m%d).sql

# Limpiar imágenes antiguas
docker system prune -a
```

---

## 8. Monitoreo Recomendado

### 8.1 Endpoints de Monitoreo

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `/health` | GET | Estado de la aplicación |

### 8.2 Métricas a Monitorear

- **CPU/RAM** del contenedor `app`
- **Conexiones activas** a PostgreSQL
- **Latencia** del endpoint `/health`
- **Errores 5xx** en logs de Nginx

---

## 9. Troubleshooting

### Problema: La aplicación no inicia

```bash
# Verificar logs
docker-compose logs app

# Causas comunes:
# - DATABASE_URL incorrecto
# - Puerto 3000 ocupado
# - Variables de entorno faltantes
```

### Problema: Error de conexión a base de datos

```bash
# Verificar conectividad
docker-compose exec app sh -c "nc -zv $DB_HOST 5432"

# Verificar credenciales
psql $DATABASE_URL -c "SELECT 1"
```

### Problema: Errores de ElevenLabs/OpenAI

```bash
# Verificar que las API keys están configuradas
docker-compose exec app env | grep -E "(ELEVENLABS|OPENAI)"

# Verificar conectividad saliente
curl -I https://api.elevenlabs.io
curl -I https://api.openai.com
```

---

## 10. Contacto para Soporte

Para problemas técnicos relacionados con la aplicación:
- **Código fuente:** El cliente proporcionará acceso al repositorio
- **API Keys:** El cliente proporcionará las credenciales de ElevenLabs y OpenAI

Para problemas de infraestructura:
- Escalar con el equipo de Huawei Cloud

---

## Checklist de Despliegue

- [ ] ECS provisionado con Docker instalado
- [ ] RDS PostgreSQL configurado y accesible
- [ ] Security Groups configurados (puertos 80, 443, 3000)
- [ ] Certificado SSL instalado
- [ ] Archivo `.env` creado con todas las variables
- [ ] Schema de base de datos ejecutado
- [ ] `docker-compose up -d` ejecutado
- [ ] Health check respondiendo en `/health`
- [ ] Dominio/DNS configurado
- [ ] Nginx/reverse proxy configurado
- [ ] HTTPS funcionando
