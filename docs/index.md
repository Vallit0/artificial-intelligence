# Señoriales — Documentación

Plataforma de entrenamiento de ventas con **IA conversacional** (ElevenLabs). Aplicación monolítica **Node.js/Express + React SPA + PostgreSQL**, desplegable en Docker.

!!! tip "Cómo levantar esta wiki"
    ```bash
    pip install mkdocs-material
    mkdocs serve     # http://127.0.0.1:8000
    mkdocs build     # genera el sitio estático en site/
    ```

## Mapa de la documentación

<div class="grid cards" markdown>

- :material-sitemap: **[Stack tecnológico](stack.md)**
  Componentes de backend, frontend, APIs externas y base de datos.

- :material-file-document: **[Manual técnico](MANUAL-TECNICO.md)**
  Arquitectura lógica, modelo de datos, integraciones y operación.

- :material-office-building-marker: **[Multi-sede (aislamiento)](multi-sede.md)**
  Modelo de tenancy por sede, rol `coach` y reglas de aislamiento de datos.

- :material-puzzle: **[Integraciones externas](integraciones.md)**
  ElevenLabs, OpenAI, WhatsApp (WHAPI), Resend.

- :material-api: **[Referencia de API (OpenAPI)](api.md)**
  92 endpoints documentados, servidos en `/api/docs` (Swagger UI).

- :material-test-tube: **[Testing](testing.md)**
  Suite de integración (Vitest + supertest), stress y load tests.

- :material-rocket-launch: **[Despliegue](deployment.md)**
  Docker, Huawei Cloud, Nginx, variables de entorno.

- :material-clipboard-text: **[Runbooks](RUNBOOKS.md)**
  Procedimientos operativos ante incidentes comunes.

- :material-shield-check: **[Continuidad (BCP)](BCP.md)**
  Plan de continuidad de negocio y recuperación.

</div>

## Arquitectura en una imagen

```
Navegador (React SPA + WebSocket de voz)
        │ HTTPS / WSS
        ▼
   Nginx (reverse proxy + SSL)
        │
        ▼
   Docker: app (Node 20 + Express)
   Routers → Controllers → Services → Prisma
   /auth  /api/*  /api/citas  /api/memory  /health
        │                         │
        ▼                         ▼
   PostgreSQL 15           APIs externas:
   (Prisma ORM)            ElevenLabs · OpenAI
                           WHAPI · Resend
```

## Convenciones

- **Rama principal:** `main` · **Desarrollo:** `develop`.
- **Dominio de producción:** `centro-de-negocios.org`.
- La documentación de este sitio es la fuente única; los `.md` viven en `docs/` y se versionan junto al código.
