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
