# Stack Tecnológico - Señoriales

## Resumen

Plataforma de entrenamiento de ventas con IA conversacional, diseñada como una aplicación monolítica desplegable en cualquier infraestructura Docker.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     DOCKER CONTAINER                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Node.js / Express                     ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │   Routes    │  │ Controllers │  │    Services     │ ││
│  │  │  /auth      │→ │   auth      │→ │  auth.service   │ ││
│  │  │  /api       │  │   sessions  │  │  sessions       │ ││
│  │  │  /lti       │  │   elevenlabs│  │  elevenlabs     │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  │                          ↓                               ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │               PostgreSQL (pg driver)                 │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              React SPA (Static Files)                    ││
│  │           Served by Express in production                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              ↓
           ┌──────────────────┼──────────────────┐
           ↓                  ↓                  ↓
   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
   │  ElevenLabs   │  │    OpenAI     │  │    Moodle     │
   │ Conversational│  │   (Optional)  │  │  (LTI 1.3)    │
   │      AI       │  │  Evaluations  │  │     SSO       │
   └───────────────┘  └───────────────┘  └───────────────┘
```

---

## 🔧 Stack Backend

| Componente | Tecnología | Versión | Descripción |
|------------|------------|---------|-------------|
| **Runtime** | Node.js | 20 LTS | Motor JavaScript |
| **Framework** | Express | 4.x | HTTP server |
| **Base de Datos** | PostgreSQL | 15+ | Almacenamiento persistente |
| **Driver DB** | pg (node-postgres) | 8.x | Cliente PostgreSQL |
| **Autenticación** | JWT + bcryptjs | - | Tokens y hash de contraseñas |
| **Seguridad** | Helmet | 7.x | Headers de seguridad HTTP |
| **Build** | TypeScript | 5.x | Tipado estático |

### Estructura del Backend

```
server/src/
├── config/
│   └── index.ts          # Configuración centralizada
├── controllers/
│   ├── auth.controller.ts
│   ├── elevenlabs.controller.ts
│   ├── progress.controller.ts
│   ├── scenarios.controller.ts
│   └── sessions.controller.ts
├── db/
│   ├── index.ts          # Conexión PostgreSQL
│   └── schema.sql        # Esquema de base de datos
├── middleware/
│   └── auth.ts           # JWT middleware
├── routes/
│   ├── api.ts            # Rutas API protegidas
│   ├── auth.ts           # Autenticación
│   ├── elevenlabs.ts     # Tokens de voz
│   └── lti.ts            # Integración Moodle
├── services/
│   ├── auth.service.ts
│   ├── elevenlabs.service.ts
│   ├── progress.service.ts
│   ├── scenarios.service.ts
│   └── sessions.service.ts
├── types/
│   └── index.ts          # Definiciones TypeScript
├── utils/
│   └── errors.ts         # Clases de error personalizadas
└── index.ts              # Entry point
```

---

## 🎨 Stack Frontend

| Componente | Tecnología | Versión | Descripción |
|------------|------------|---------|-------------|
| **Framework** | React | 18.x | UI Library |
| **Build Tool** | Vite | 5.x | Bundler rápido |
| **Routing** | React Router | 6.x | Navegación SPA |
| **Estado** | TanStack Query | 5.x | Cache y fetching |
| **Estilos** | Tailwind CSS | 3.x | Utility-first CSS |
| **UI Components** | shadcn/ui | - | Componentes accesibles |
| **Íconos** | Lucide React | - | Iconografía |
| **Formularios** | React Hook Form | 7.x | Manejo de formularios |
| **Validación** | Zod | 3.x | Schema validation |

### Estructura del Frontend

```
src/
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── practice/         # Componentes de práctica
│   └── scenarios/        # Componentes de escenarios
├── hooks/
│   ├── useAuth.tsx       # Autenticación
│   ├── useScenarios.ts   # Gestión de escenarios
│   ├── usePracticeSessions.ts
│   └── useElevenLabsConversation.ts
├── lib/
│   ├── api.ts            # Cliente REST
│   └── utils.ts          # Utilidades
├── pages/
│   ├── Auth.tsx
│   ├── Index.tsx
│   ├── Practice.tsx
│   ├── Progress.tsx
│   └── Scenarios.tsx
└── App.tsx
```

---

## 🤖 APIs Externas

### ElevenLabs (Requerida)

**Uso**: IA Conversacional para práctica de ventas

| Endpoint | Descripción |
|----------|-------------|
| `/v1/convai/conversation/get-signed-url` | Token para WebSocket de conversación |
| `/v1/single-use-token/realtime_scribe` | Token para transcripción en tiempo real |

**Variables de entorno**:
- `ELEVENLABS_API_KEY` - API key
- `ELEVENLABS_AGENT_ID` - ID del agente configurado

### OpenAI (Opcional)

**Uso**: Evaluación de sesiones de práctica con IA

**Variables de entorno**:
- `OPENAI_API_KEY` - API key (opcional)

---

## 🔐 Autenticación

### JWT (JSON Web Tokens)

```
┌─────────────────┐      ┌─────────────────┐
│   Login/Signup  │ ───→ │  Access Token   │ (1 hora)
└─────────────────┘      │  Refresh Token  │ (7 días)
                         └─────────────────┘
                                  ↓
                         ┌─────────────────┐
                         │  Authorization  │
                         │  Bearer <token> │
                         └─────────────────┘
```

### LTI 1.3 (Single Sign-On)

Integración con Moodle y otros LMS compatibles:

1. **OIDC Login Initiation** → `/lti/initiate`
2. **JWT Verification** → JWKS del LMS
3. **User Linking** → Crear o vincular usuario local
4. **Redirect** → App con tokens JWT

---

## 📦 Despliegue

### Docker Compose (Recomendado)

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://...
      - JWT_SECRET=...
      - ELEVENLABS_API_KEY=...
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### Requisitos de Servidor

| Usuarios Concurrentes | CPU | RAM | Almacenamiento |
|-----------------------|-----|-----|----------------|
| 50 | 2 vCPU | 4 GB | 50 GB SSD |
| 150 | 4 vCPU | 8 GB | 100 GB SSD |
| 300+ | 8 vCPU | 16 GB | 200 GB SSD |

---

## 🗄️ Base de Datos

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios del sistema |
| `user_roles` | Roles (admin, instructor, learner) |
| `refresh_tokens` | Tokens de refresco JWT |
| `scenarios` | Escenarios de práctica |
| `practice_sessions` | Sesiones de entrenamiento |
| `user_scenario_progress` | Progreso por escenario |
| `lti_platforms` | Configuración Moodle/LMS |
| `lti_sessions` | Vinculación LTI-Usuario |

### Diagrama ER

```
users ─────────────┬─── user_roles
  │                │
  ├─── refresh_tokens
  │
  ├─── practice_sessions ─── scenarios
  │
  ├─── user_scenario_progress ─── scenarios
  │
  └─── lti_sessions ─── lti_platforms
```

---

## 🔄 Flujo de Datos

### Sesión de Práctica

```
1. Usuario selecciona escenario
         ↓
2. Frontend solicita token de conversación
         ↓
3. Backend obtiene signed URL de ElevenLabs
         ↓
4. Frontend conecta WebSocket a ElevenLabs
         ↓
5. Práctica de venta en tiempo real
         ↓
6. Al finalizar, agente envía evaluación
         ↓
7. Backend guarda score y progreso
         ↓
8. Frontend muestra feedback
```

---

## 📝 Variables de Entorno

```bash
# Servidor
PORT=3000
NODE_ENV=production
APP_URL=https://tu-dominio.com
CORS_ORIGIN=https://tu-dominio.com

# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/db

# Seguridad
JWT_SECRET=tu-secreto-seguro-de-32-caracteres

# ElevenLabs (requerido)
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_ID=...

# OpenAI (opcional)
OPENAI_API_KEY=sk-...
```

---

## 🚀 Comandos

```bash
# Desarrollo
npm run dev          # Frontend (Vite)
cd server && npm run dev  # Backend (nodemon)

# Producción
docker-compose up --build  # Todo junto

# Base de datos
docker-compose exec db psql -U senoriales  # Acceso directo
```

---

## 📊 Monitoreo

### Health Check

```
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": "connected",
    "elevenlabs": "configured"
  }
}
```

### Logs

```bash
# Ver logs en tiempo real
docker-compose logs -f app

# Solo errores
docker-compose logs -f app | grep -i error
```
