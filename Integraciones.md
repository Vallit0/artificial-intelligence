# Integraciones

Guia paso a paso para configurar las integraciones externas de la plataforma Senoriales.

---

## 1. ElevenLabs Server Tools (Sistema de Memoria)

El sistema de memoria permite que los agentes de ElevenLabs recuerden informacion sobre cada asesor entre sesiones. Se configuran dos Server Tools en el dashboard de ElevenLabs.

### Prerequisitos

- Cuenta de ElevenLabs con acceso a Conversational AI
- Tu API desplegada y accesible publicamente (ej: `https://tu-dominio.com`)
- Las tablas `advisor_memories` y `session_summaries` creadas en la DB (`npx prisma db push`)

### Paso 1: Configurar el Tool "retrieve_advisor_memory"

1. Ve al [dashboard de ElevenLabs](https://elevenlabs.io/app/conversational-ai)
2. Selecciona el agente que quieres configurar
3. Ve a la seccion **Tools** > **Add Tool** > **Server Tool**
4. Configura:

| Campo | Valor |
|-------|-------|
| **Name** | `retrieve_advisor_memory` |
| **Description** | `Llama a esta herramienta al inicio de cada conversacion para obtener el historial, debilidades, fortalezas y contexto previo del asesor. Usa esta informacion para personalizar tu feedback y presionar en areas donde el asesor necesita mejorar.` |
| **Method** | `POST` |
| **URL** | `https://tu-dominio.com/api/memory/retrieve` |
| **Wait for response** | **Activado** |

5. En **Request Body**, configura:
```json
{
  "user_id": "{{user_id}}"
}
```

6. En **Headers**, no se requieren headers adicionales (el endpoint es publico para que ElevenLabs pueda accederlo)

### Paso 2: Configurar el Tool "save_advisor_memory"

1. En el mismo agente, agrega otro **Server Tool**:

| Campo | Valor |
|-------|-------|
| **Name** | `save_advisor_memory` |
| **Description** | `Llama a esta herramienta cuando detectes algo relevante durante la conversacion: una muletilla repetida, una debilidad en tecnica de ventas, una fortaleza notable, un patron de comportamiento, o un avance significativo. Las categorias validas son: debilidad, fortaleza, expresion, comportamiento, progreso.` |
| **Method** | `POST` |
| **URL** | `https://tu-dominio.com/api/memory/save` |
| **Wait for response** | **Desactivado** |

2. En **Request Body**, configura estos parametros para que el LLM los llene:
```json
{
  "user_id": "{{user_id}}",
  "content": "<descripcion del patron detectado>",
  "category": "<debilidad|fortaleza|expresion|comportamiento|progreso>"
}
```

3. Los parametros `content` y `category` deben estar marcados como **dynamic** para que el LLM los llene automaticamente.

### Paso 3: Agregar Variables Dinamicas al Prompt del Agente

En la seccion **Agent Prompt** del dashboard, agrega estas variables dinamicas:

```
Nombre del asesor: {{advisor_name}}
ID del asesor: {{user_id}}

Contexto previo del asesor (memorias de sesiones anteriores):
{{advisor_context}}
```

Estas variables se inyectan automaticamente desde el frontend al iniciar cada sesion.

### Paso 4: Repetir para cada agente

Repite los pasos 1-3 para cada agente que quieras que tenga memoria:
- Agente Coach (default `ELEVENLABS_AGENT_ID`)
- Agente Role-Play (`ELEVENLABS_AGENT_ROLEPLAY`)
- Agente Objeciones (`ELEVENLABS_AGENT_OBJECIONES`)
- Agente Pitch Express (`ELEVENLABS_AGENT_PITCH`)
- Agente Cierre (`ELEVENLABS_AGENT_CIERRE`)
- Agente Examen Final (`ELEVENLABS_AGENT_EXAMEN_FINAL`)
- Agentes de Prospeccion (PAREJA, FRUTAS, NEUMATICOS, etc.)

### Variables de Entorno Requeridas

Agrega los IDs de cada agente en tu archivo `.env`:

```env
ELEVENLABS_API_KEY=tu-api-key
ELEVENLABS_AGENT_ID=agent-id-coach-default
ELEVENLABS_AGENT_ROLEPLAY=agent-id-roleplay
ELEVENLABS_AGENT_OBJECIONES=agent-id-objeciones
ELEVENLABS_AGENT_PITCH=agent-id-pitch
ELEVENLABS_AGENT_CIERRE=agent-id-cierre
ELEVENLABS_AGENT_EXAMEN_FINAL=agent-id-examen
ELEVENLABS_AGENT_PROSPECTING_PAREJA=agent-id-pareja
ELEVENLABS_AGENT_PROSPECTING_FRUTAS=agent-id-frutas
ELEVENLABS_AGENT_PROSPECTING_NEUMATICOS=agent-id-neumaticos
ELEVENLABS_AGENT_PROSPECTING_RESTAURANTE=agent-id-restaurante
ELEVENLABS_AGENT_PROSPECTING_PARQUEO=agent-id-parqueo
```

### Verificar la Integracion

1. Inicia una sesion con un asesor que tenga sesiones previas
2. Revisa los logs del servidor para confirmar que `retrieve` fue llamado
3. Despues de la sesion, verifica que se crearon registros en `advisor_memories`:
```sql
SELECT * FROM advisor_memories WHERE user_id = 'xxx' ORDER BY created_at DESC;
```

---

## 2. Moodle LTI 1.3 (Integracion con Campus Virtual)

La plataforma soporta LTI 1.3 para integracion con Moodle, permitiendo que los estudiantes accedan directamente desde su campus virtual sin crear una cuenta separada.

### Prerequisitos

- Moodle 3.10+ con soporte LTI 1.3
- Acceso de administrador a Moodle
- Tu API desplegada con HTTPS (obligatorio para LTI)

### Paso 1: Obtener la informacion del Tool

Accede a `https://tu-dominio.com/lti/info` para ver la informacion de registro:

```json
{
  "tool_name": "Corporacion Senoriales - Practica de Ventas",
  "initiate_login_url": "https://tu-dominio.com/lti/initiate",
  "target_link_uri": "https://tu-dominio.com/lti/launch",
  "redirect_uris": ["https://tu-dominio.com/lti/launch"]
}
```

### Paso 2: Registrar el Tool en Moodle

1. Ve a **Site administration** > **Plugins** > **Activity modules** > **External tool** > **Manage tools**
2. Click en **Configure a tool manually**
3. Llena los campos:

| Campo | Valor |
|-------|-------|
| **Tool name** | `Senoriales - Practica de Ventas` |
| **Tool URL** | `https://tu-dominio.com/lti/launch` |
| **LTI version** | `LTI 1.3` |
| **Public key type** | `Keyset URL` |
| **Initiate login URL** | `https://tu-dominio.com/lti/initiate` |
| **Redirection URI(s)** | `https://tu-dominio.com/lti/launch` |

4. En **Services** habilita:
   - `IMS LTI Names and Role Provisioning Services`: **Use this service**
   - `IMS LTI Assignment and Grade Services`: **Use this service**

5. En **Privacy**:
   - Share launcher's name: **Always**
   - Share launcher's email: **Always**
   - Accept grades: **Always**

6. Click **Save changes**

### Paso 3: Obtener credenciales de Moodle

Despues de guardar, Moodle genera las credenciales. Click en el icono de configuracion del tool para verlas:

- **Platform ID (issuer)**: `https://tu-moodle.com` (la URL de tu Moodle)
- **Client ID**: generado automaticamente por Moodle
- **Auth URL**: `https://tu-moodle.com/mod/lti/auth.php`
- **Token URL**: `https://tu-moodle.com/mod/lti/token.php`
- **JWKS URL**: `https://tu-moodle.com/mod/lti/certs.php`
- **Deployment ID**: generado automaticamente

### Paso 4: Registrar la plataforma en la base de datos

Inserta el registro en la tabla `lti_platforms`:

```sql
INSERT INTO lti_platforms (
  id, name, issuer_url, client_id, auth_endpoint,
  token_endpoint, jwks_url, deployment_id, is_active,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Moodle - Mi Universidad',
  'https://tu-moodle.com',
  'CLIENT_ID_DE_MOODLE',
  'https://tu-moodle.com/mod/lti/auth.php',
  'https://tu-moodle.com/mod/lti/token.php',
  'https://tu-moodle.com/mod/lti/certs.php',
  'DEPLOYMENT_ID_DE_MOODLE',
  true,
  NOW(),
  NOW()
);
```

### Paso 5: Agregar la actividad en un curso de Moodle

1. Ve al curso donde quieres agregar la practica
2. Activa edicion > **Add an activity or resource** > **External tool**
3. Selecciona el tool "Senoriales - Practica de Ventas"
4. En **Privacy** asegurate de que "Share launcher's name" y "Share launcher's email" esten habilitados
5. Guarda

### Paso 6: Probar el flujo

1. Un estudiante accede al curso y clickea la actividad
2. Moodle envia un POST a `/lti/initiate` con el issuer y login_hint
3. El servidor redirige al endpoint de autenticacion de Moodle
4. Moodle redirige de vuelta a `/lti/launch` con un `id_token` JWT
5. El servidor verifica el JWT, crea/encuentra al usuario, genera tokens
6. Redirige al frontend con `access_token` y `refresh_token` en la URL
7. El frontend los captura y el usuario queda autenticado

### Flujo de Roles

| Rol en Moodle | Rol en Senoriales |
|---|---|
| Teacher/Instructor | `instructor` |
| Student | `learner` |
| Manager/Admin | `admin` |
| Content Developer | `content_developer` |

### Troubleshooting

- **"Platform not registered"**: Verifica que el `issuer_url` en la DB coincida exactamente con el que Moodle envia
- **"Invalid JWT signature"**: Verifica que el `jwks_url` sea accesible desde tu servidor
- **"Token expired"**: Asegurate de que los relojes del servidor y Moodle esten sincronizados (NTP)
- **"Email is required"**: Verifica que la configuracion de Privacy en Moodle comparta el email

### Variables de Entorno Relevantes

```env
APP_URL=https://tu-dominio.com    # DEBE ser HTTPS para LTI
JWT_SECRET=tu-secreto-seguro
```

### Procedimiento end-to-end para cargar un Moodle real

1. **En Moodle**: registra el tool (seccion 2 paso 2). Activa **Deep Linking**, **NRPS**, **AGS**. Guarda y abre la configuracion para copiar Platform ID, Client ID, Auth URL, Token URL, JWKS URL, Deployment ID.
2. **En la app**: entra a `/admin > LTI / Moodle > Plataformas > Nueva Plataforma`. Pega los 6 valores. Guarda.
3. **Smoke test del launch**: agrega una actividad External Tool en un curso de prueba (sin Deep Linking primero, modo "Default — auto" para el content launch). Loguea como alumno y clickea. Deberias caer en el SPA autenticado.
4. **Smoke test de AGS**: hace una practica corta, espera la evaluacion. Revisa `server` logs por `AGS score submitted`. Verifica en el gradebook de Moodle que la nota aparecio.
5. **Smoke test de NRPS**: entra a `/admin > LTI / Moodle > Cursos & Roster`. Despues del primer launch en el curso, deberia aparecer una fila auto-registrada. Click "Sync ahora". Revisa los contadores y los `LtiPendingMatch` que aparezcan.
6. **Smoke test de Deep Linking**: en otro curso de prueba, "Add activity > External tool > Select content". Te debe abrir el picker con la lista de escenarios. Marca 2 o 3, "Enviar a Moodle". Verifica que Moodle creo una actividad por cada uno.
7. **Activar cron**: setea `LTI_NRPS_CRON_ENABLED=true` y `LTI_NRPS_CRON_SCHEDULE=0 */6 * * *` en `.env`. Reinicia el server. Revisa al primer firing en logs (`NRPS cron started` al boot, `NRPS cron tick — scanning active courses` cada 6h).

---

## 2.bis. Sincronizacion de Roster (NRPS) — Notas que caen sin que el alumno haya hecho launch

Por defecto, una nota solo cae en el gradebook de Moodle si el estudiante hizo un launch LTI antes (eso crea la `LtiSession` con `agsLineitemUrl`). Si tus alumnos entran directo por link a `centro-de-negocios.org` y nunca pasan por Moodle, sus notas se quedan en Senoriales.

La sincronizacion NRPS (Names and Role Provisioning Services) resuelve esto: cada cierto tiempo pedimos a Moodle la lista de matriculados del curso, hacemos match con tu base de usuarios (por correo, y como fallback por nombre+apellido), y precreamos las `LtiSession` para que cualquier practica/examen futura ya tenga a donde mandar la nota.

### Paso 1: Habilitar el servicio NRPS en Moodle

En el mismo tool LTI que registraste en la seccion 2 (Manage tools > Edit), verifica que en **Services** este activado:

- `IMS LTI Names and Role Provisioning Services`: **Use this service** (ya pedido en seccion 2 paso 4, esto solo lo confirma)

Sin esto, Moodle no enviara el claim `namesroleservice` en el launch y no podremos consultar el roster.

### Paso 2: Registrar el curso para sync

Hay dos formas:

**Automatica (recomendada):** una vez que cualquier usuario (profesor o estudiante) haga un launch LTI desde el curso, el sistema detecta el endpoint NRPS y la actividad evaluable y crea automaticamente la fila `lti_course_syncs`. No tienes que hacer nada manual.

**Manual:** si necesitas pre-registrar el curso antes de cualquier launch (por ejemplo para sincronizar antes de que el primer alumno entre):

```bash
POST /api/admin/lti/courses
Content-Type: application/json
Authorization: Bearer <token-admin>

{
  "platformId": "<uuid del lti_platform>",
  "contextId": "<id del curso en Moodle>",
  "contextTitle": "Ventas Avanzadas 2026",
  "membershipsUrl": "https://tu-moodle.com/mod/lti/services.php/CourseSection/42/bindings/4/memberships",
  "lineitemUrl": "https://tu-moodle.com/mod/lti/services.php/2/lineitems/9/lineitem"
}
```

Los URLs los puedes leer del `id_token` capturado en un launch anterior, o desde la API de Moodle.

### Paso 3: Disparar el sync

**Manual / on-demand:**

```bash
POST /api/admin/lti/courses/:id/sync
Authorization: Bearer <token-admin>
```

Devuelve los contadores del sync:

```json
{
  "success": true,
  "result": {
    "courseSyncId": "...",
    "membersFetched": 42,
    "matched": 28,    // usuario existente, LtiSession creada/actualizada
    "created": 10,    // usuario nuevo creado automaticamente
    "pending": 3,     // homonimos — requieren resolucion manual
    "skipped": 1,     // miembro sin email ni nombre — no se pudo matchear
    "errors": 0
  }
}
```

**Automatico (cron in-process):** disponible. El servidor incluye un scheduler `node-cron` que itera `LtiCourseSync` activos y llama `syncCourse` de cada uno. Se activa via variables de entorno:

```env
LTI_NRPS_CRON_ENABLED=true               # opt-in; default desactivado para dev/test
LTI_NRPS_CRON_SCHEDULE=0 */6 * * *       # cualquier expresion cron valida; default cada 6 horas
LTI_NRPS_CRON_TZ=America/Guatemala       # opcional; default UTC
```

Cada tick procesa los cursos en orden, secuencial (no paralelo) para no martillar Moodle. Los resultados van al log estructurado con `component: lti-sync-cron`.

Tambien existe un endpoint para forzar un tick completo sin esperar al cron:

```bash
POST /api/admin/lti/sync-all
Authorization: Bearer <token-admin>
```

Respuesta:
```json
{
  "success": true,
  "result": {
    "startedAt": "...",
    "finishedAt": "...",
    "coursesProcessed": 5,
    "coursesSucceeded": 5,
    "coursesFailed": 0
  }
}
```

Alternativas externas (cron del host o GitHub Action) siguen siendo validas si preferis no correr el scheduler in-process.

### Paso 4: Resolver matches ambiguos

Cuando dos o mas usuarios en Senoriales tienen el mismo nombre normalizado que un miembro del roster, el sync no decide por ti. Queda en estado pendiente:

```bash
GET /api/admin/lti/pending-matches
```

Devuelve cada caso con los candidatos completos (email, nombre, fecha de creacion) para que el admin elija. Luego:

```bash
POST /api/admin/lti/pending-matches/:id/resolve
{ "userId": "<uuid del usuario correcto>" }
```

O si determinas que ninguno aplica (por ejemplo, el miembro de Moodle no es un asesor):

```bash
POST /api/admin/lti/pending-matches/:id/dismiss
```

### Cascada de matching (orden de prioridad)

1. **Email exacto** (case-insensitive) — clave unica en `users`, siempre desambigua.
2. **Nombre + apellido normalizado** (lowercase, sin tildes, espacios colapsados):
   - 0 candidatos → crea usuario nuevo (rol `learner`, `emailVerified=true`, sin password).
   - 1 candidato → linkea.
   - 2+ candidatos → registra `LtiPendingMatch` y deja la decision al admin.
3. Si el miembro no tiene email y tampoco firstName+lastName, se reporta como `skipped`.

### Idempotencia

Volver a correr el sync sobre el mismo curso no duplica registros. Las `LtiSession` se hacen upsert por `(platformId, ltiUserId)`; los `LtiPendingMatch` por `(courseSyncId, ltiUserId)`. Se actualizan `agsLineitemUrl` y metadatos pero NO se reasigna `userId` si ya hubo un launch que lo fijo manualmente.

### Aplicar el schema

Las tablas nuevas (`lti_course_syncs`, `lti_pending_matches`, `lti_deep_linking_states`) y la columna `nrps_memberships_url` en `lti_sessions` requieren correr:

```bash
cd server && npx prisma db push
```

(Este proyecto no usa migraciones — `db push` aplica el schema directamente.)

---

## 2.ter. Deep Linking 1.3 (Seleccion de actividad desde Moodle)

Permite que el profesor, al crear una actividad "External tool" en Moodle, elija **que escenario(s)** se embebe en lugar de mandar siempre al menu general. Cada escenario seleccionado se vuelve una actividad clickeable independiente en el curso.

### Habilitar Deep Linking en el tool registrado

En la misma configuracion del tool LTI (Manage tools > Edit) que registraste en la seccion 2, agrega en **Services > Tool settings**:

- **Supports Deep Linking (Content-Item Message):** Yes
- **Content selection URL:** dejalo vacio — Moodle usa la `target_link_uri` del tool registrado (`https://tu-dominio.com/lti/launch`); el branching de `message_type` lo hacemos del lado del tool.

### Flujo del profesor

1. En el curso, **Add an activity or resource > External tool > Select content**.
2. Moodle abre el tool en modo Deep Linking (envia `message_type=LtiDeepLinkingRequest`).
3. El tool persiste el state, redirige al picker en `/lti/deep-linking/select?state=<id>`.
4. El profesor marca uno o varios escenarios (opcionalmente tambien el "menu general").
5. Click en "Enviar a Moodle" → el tool firma un `LtiDeepLinkingResponse` JWT y postea de vuelta al `deep_link_return_url`.
6. Moodle crea una actividad por cada escenario seleccionado. Cuando un alumno clickea una de esas actividades, Moodle envia el `custom.scenarioId` en el launch y el tool lo redirige directo a `/practice?scenario=<id>`.

### State id como credencial

El `state` en la URL del picker es la unica credencial. Es UUID generado server-side, valido 30 minutos, y se marca consumido al primer submit. Si el profesor abandona la sesion y vuelve mas tarde, tendra que reiniciar el flujo desde Moodle.

### Variables custom propagadas al launch

Cuando el alumno entra por una actividad deep-linkeada, el `id_token` del launch incluye:

```json
"https://purl.imsglobal.org/spec/lti/claim/custom": {
  "scenarioId": "<uuid del escenario elegido por el profesor>"
}
```

El tool lee ese claim en `/lti/launch` y lo agrega como `?scenario=<id>` al redirect al SPA. El `Practice.tsx` ya espera ese query param.

### Troubleshooting

- **Picker dice "Deep linking state not found"**: el state caduco (30 min) o el id de la URL esta corrupto. Reiniciar desde Moodle.
- **Picker dice "already used"**: alguien ya envio la seleccion para ese state. Reiniciar.
- **El JWT firmado de respuesta es rechazado por Moodle**: Moodle no esta encontrando la clave publica del tool en `/lti/jwks`. Confirmar que `Public key type = Keyset URL` y `Public keyset = https://tu-dominio.com/lti/jwks` en la config del tool en Moodle.

---

## 2.5. ElevenLabs Server Tool: WhatsApp (Mensajes y Documentos)

Permite que los agentes de ElevenLabs envien mensajes de texto y documentos PDF por WhatsApp durante la conversacion.

### Prerequisitos

- WHAPI configurado con `WHAPI_TOKEN` en `.env`
- El numero de telefono del prospecto debe proporcionarse durante la conversacion

### Server Tool: `send_whatsapp_message`

Este tool ya existe para enviar mensajes de texto. Ahora tambien soporta envio de documentos.

1. Ve al dashboard de ElevenLabs > Tu agente > **Tools** > **Add Tool** > **Server Tool**
2. Configura:

| Campo | Valor |
|-------|-------|
| **Name** | `send_whatsapp_message` |
| **Description** | `Envia un mensaje o documento por WhatsApp al prospecto. Para enviar el brochure de Legado de Vida, usa document_id "legado-vida". Siempre confirma con el prospecto antes de enviar. Necesitas su numero de telefono con codigo de pais (ej: 50212345678).` |
| **Method** | `POST` |
| **URL** | `https://tu-dominio.com/api/whatsapp/agent-send` |
| **Wait for response** | **Activado** |

3. En **Request Body**, configura estos parametros (todos **dynamic** para que el LLM los llene):

```json
{
  "phone_number": "<numero de telefono con codigo de pais, ej: 50212345678>",
  "message": "<mensaje de texto o caption del documento>",
  "document_id": "<ID del documento predefinido: legado-vida>"
}
```

### Parametros del Request Body

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `phone_number` | string | Si | Numero de telefono con codigo de pais (ej: `50212345678`) |
| `message` | string | No | Mensaje de texto, o caption si se envia documento |
| `document_id` | string | No | ID de documento predefinido. Valores: `legado-vida` |

### Documentos Disponibles

| document_id | Documento |
|-------------|-----------|
| `legado-vida` | Brochure "Legado de Vida" - informacion sobre planes de prevision funeraria |

### Ejemplo de uso en el System Prompt del agente

Agrega al prompt del agente instrucciones como:

```
Cuando el prospecto muestre interes en los planes de prevision, ofrecele enviarle el brochure
"Legado de Vida" por WhatsApp. Pidele su numero de telefono con codigo de pais (Guatemala: 502).
Usa la herramienta send_whatsapp_message con document_id "legado-vida" para enviar el PDF.
Tambien puedes enviar mensajes de texto de seguimiento usando solo el campo message.
```

### Agregar nuevos documentos

Para agregar mas documentos disponibles:

1. Coloca el archivo PDF en `server/public/documents/`
2. Agrega la entrada en `AVAILABLE_DOCUMENTS` en `server/src/routes/whatsapp.ts`:
```typescript
const AVAILABLE_DOCUMENTS: Record<string, { filename: string; path: string }> = {
  'legado-vida': { filename: 'Legado de Vida - Señoriales.pdf', path: '/documents/legado-vida.pdf' },
  'nuevo-doc': { filename: 'Mi Nuevo Documento.pdf', path: '/documents/nuevo-doc.pdf' },
};
```
3. Actualiza la descripcion del Server Tool en ElevenLabs para incluir el nuevo `document_id`

---

## 3. Configuracion de Agentes por Funcionalidad

Cada boton de sugerencia en la pantalla de practica mapea a un agente de ElevenLabs diferente:

| Boton | Variable de Entorno | Proposito |
|-------|-------------------|-----------|
| Coach | `ELEVENLABS_AGENT_ID` (default) | Feedback en tiempo real sobre tecnica |
| Role-Play | `ELEVENLABS_AGENT_ROLEPLAY` | Llamada completa con cliente simulado |
| Objeciones | `ELEVENLABS_AGENT_OBJECIONES` | Entrenamiento especifico de objeciones |
| Pitch Express | `ELEVENLABS_AGENT_PITCH` | Practica de elevator pitch en 60s |
| Cierre | `ELEVENLABS_AGENT_CIERRE` | Tecnicas de cierre y compromiso |
| Examen Final | `ELEVENLABS_AGENT_EXAMEN_FINAL` | Evaluacion completa |

Para crear cada agente en ElevenLabs:
1. Crea un nuevo agente en el dashboard
2. Configura el System Prompt especifico para cada funcionalidad
3. Agrega los Server Tools de memoria (ver seccion 1)
4. Copia el Agent ID y configuralo en tu `.env`
