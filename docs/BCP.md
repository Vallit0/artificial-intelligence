# Business Continuity Plan (BCP) — Plataforma Señoriales

> Plan de Continuidad del Negocio para el servicio de entrenamiento de ventas con IA
> conversacional de Corporación Señoriales. Define cómo la plataforma sostiene o
> recupera sus funciones críticas ante interrupciones significativas.

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-04-21 |
| Marco de referencia | ISO 22301:2019 · NIST SP 800-34 Rev.1 · ITIL 4 (Service Continuity Management) |
| Aplica a | Plataforma Señoriales (producción) y dependencias críticas |
| Documentos relacionados | `MANUAL-TECNICO.md`, `RUNBOOKS.md` |
| Próxima revisión | 2026-10-21 (semestral) |

> **Relación con los runbooks**: este BCP es el marco estratégico (qué procesos, qué
> tiempos, qué estrategias). Los `RUNBOOKS.md` son los procedimientos tácticos
> (pasos operativos). Cuando este documento dice "ejecutar RB-XX" se refiere al
> procedimiento correspondiente.

---

## Índice

1. [Control del documento](#1-control-del-documento)
2. [Propósito y alcance](#2-propósito-y-alcance)
3. [Gobernanza y roles](#3-gobernanza-y-roles)
4. [Business Impact Analysis (BIA)](#4-business-impact-analysis-bia)
5. [Análisis de riesgos y amenazas](#5-análisis-de-riesgos-y-amenazas)
6. [Estrategias de continuidad](#6-estrategias-de-continuidad)
7. [Plan de respuesta y activación](#7-plan-de-respuesta-y-activación)
8. [Procedimientos de recuperación](#8-procedimientos-de-recuperación)
9. [Plan de comunicaciones en crisis](#9-plan-de-comunicaciones-en-crisis)
10. [Recursos humanos y sucesión](#10-recursos-humanos-y-sucesión)
11. [Pruebas, ejercicios y mejora continua](#11-pruebas-ejercicios-y-mejora-continua)
12. [Mantenimiento del plan](#12-mantenimiento-del-plan)
13. [Apéndices](#13-apéndices)

---

## 1. Control del documento

| Versión | Fecha | Cambios | Responsable |
|---|---|---|---|
| 1.0 | 2026-04-21 | Versión inicial consolidada sobre ISO 22301 / NIST SP 800-34 | Equipo técnico |

**Distribución**: Service Owner, On-call/SRE, DBA, Product Owner, Security Officer,
Infra/Cloud, dirección de Corporación Señoriales.

**Clasificación**: Uso interno. Contiene contactos y detalles de infraestructura.

---

## 2. Propósito y alcance

### 2.1 Propósito

Asegurar que Señoriales pueda **continuar entregando valor a los usuarios finales
(vendedores en entrenamiento y cohortes)** ante interrupciones mayores, y
**recuperar el servicio completo dentro de los objetivos acordados** (RTO/RPO) tras
un desastre.

### 2.2 Objetivos

- Proteger la vida y seguridad de las personas (precede a cualquier objetivo técnico).
- Preservar la integridad de los datos de sesiones de práctica y evaluaciones.
- Mantener la confianza de Corporación Señoriales y de las cohortes de usuarios.
- Reducir la duración y el impacto de las interrupciones.
- Cumplir compromisos contractuales y regulatorios (protección de datos personales
  de participantes).

### 2.3 Alcance

**Incluido**:

- Aplicación Señoriales (frontend React + backend Node/Express).
- Base de datos PostgreSQL (contenedor Docker o RDS gestionado).
- Integraciones críticas: ElevenLabs, OpenAI, WHAPI, Resend.
- Infraestructura: Huawei Cloud ECS, RDS, DNS, certificados SSL, Nginx.
- Personal técnico del servicio.

**Excluido**:

- Continuidad de negocio general de Corporación Señoriales (RRHH, ventas
  presenciales, capillas físicas) — corresponde al BCP corporativo.

### 2.4 Supuestos

- Existen backups diarios de la base de datos (ver RB-05).
- Existe al menos una persona on-call localizable en ventana laboral y un
  respaldo documentado.
- El proveedor de nube (Huawei Cloud) provee al menos una región operativa.
- El historial de cambios está trazable en Git (`main` = producción, `develop` = dev).

---

## 3. Gobernanza y roles

### 3.1 Comité de Continuidad (CCoN)

| Rol | Responsabilidad principal |
|---|---|
| **Sponsor ejecutivo** (dirección Señoriales) | Aprueba el plan, autoriza activación de escenarios mayores, autoriza comunicación externa. |
| **Service Owner** | Dueño del plan. Actualiza, coordina pruebas, mantiene matriz de contactos. |
| **Coordinador de Crisis** | Conduce la activación del BCP en tiempo real. Rol rotatorio entre On-call/SRE y Service Owner. |
| **Líder técnico de recuperación** | Decide estrategia técnica durante la activación (fallback, restore, rollback). |
| **Responsable de comunicaciones** | Único emisor hacia usuarios y stakeholders durante la crisis. |
| **Responsable de seguridad** | Valida decisiones con implicaciones de datos personales o accesos. |
| **Enlace con proveedores** | Gestiona tickets con ElevenLabs, OpenAI, WHAPI, Huawei Cloud. |

### 3.2 Matriz RACI resumida

| Actividad | Sponsor | Service Owner | Coord. Crisis | Líder técnico | Comunicaciones |
|---|---|---|---|---|---|
| Mantener el plan | I | R/A | C | C | I |
| Declarar activación | A | R | C | I | I |
| Dirigir recuperación técnica | I | C | A | R | I |
| Comunicación externa | A | C | C | I | R |
| Post-incident review | I | R/A | C | C | C |

R = Responsable · A = Aprobador · C = Consultado · I = Informado.

### 3.3 Autoridad de declaración

Puede **declarar** la activación del BCP:

1. Service Owner (cualquier nivel).
2. Coordinador de Crisis (niveles 1-2; debe informar a Service Owner en ≤30 min).
3. On-call/SRE (nivel 1 únicamente, o cuando no hay otra autoridad localizable).

Puede **desactivar**: Service Owner, tras validar criterios de cierre (sección 7.4).

---

## 4. Business Impact Analysis (BIA)

### 4.1 Procesos de negocio soportados por la plataforma

| ID | Proceso | Descripción | Criticidad |
|---|---|---|---|
| P-01 | Sesión de práctica con IA conversacional | Usuario inicia una sesión con agente ElevenLabs (Coach, Role-Play, Objeciones, Pitch, Cierre, Examen). Core del producto. | **Crítica** |
| P-02 | Autenticación | Login local email/password (access + refresh JWT). Sin esto no hay servicio. | **Crítica** |
| P-03 | Registro y progreso académico | Persistencia de sesiones, evaluaciones, progreso por cohorte. | **Crítica** |
| P-04 | Evaluación automática con OpenAI | Calificación post-sesión usando `gpt-4o-mini`. | Alta |
| P-05 | Envío de brochure por WhatsApp (WHAPI) | Tool de agente: entrega PDF "Legado de Vida". | Media |
| P-06 | Email transaccional (Resend) | Activación, recuperación, notificaciones. | Media |
| P-07 | Panel de administración | Gestión de agentes, A/B tests, cohortes. | Media |
| P-08 | Dashboards e informes | Reportes agregados para instructores. | Baja |

### 4.2 Impacto por tiempo de interrupción

Impacto estimado si el proceso está caído continuamente:

| Proceso | 1 h | 4 h | 24 h | 72 h |
|---|---|---|---|---|
| P-01 Sesión IA | Bajo (sesiones perdidas) | Medio (cohortes bloqueadas) | Alto (SLA incumplido) | Crítico (riesgo contractual) |
| P-02 Auth | Medio | Alto | Crítico | Crítico |
| P-03 Persistencia | Bajo (degradación) | Alto | Crítico (posible pérdida) | Crítico |
| P-04 Evaluación | Trivial | Bajo | Medio (bloqueo pedagógico) | Alto |
| P-05 WhatsApp | Trivial | Bajo | Bajo | Medio |
| P-06 Email | Bajo | Medio | Alto | Alto |
| P-07 Admin | Trivial | Bajo | Medio | Alto |
| P-08 Dashboards | Trivial | Trivial | Bajo | Medio |

### 4.3 Objetivos de continuidad por proceso

Abreviaturas:
- **MTPD** — Maximum Tolerable Period of Disruption (tiempo máximo que el proceso
  puede estar caído antes de daño inaceptable).
- **RTO** — Recovery Time Objective (tiempo objetivo para restaurar el proceso).
- **RPO** — Recovery Point Objective (pérdida máxima tolerable de datos).
- **MBCO** — Minimum Business Continuity Objective (nivel mínimo de servicio durante contingencia).

| Proceso | MTPD | RTO | RPO | MBCO (modo degradado aceptable) |
|---|---|---|---|---|
| P-01 Sesión IA | 24 h | 4 h | 24 h (no se persiste audio, solo resumen/evaluación) | Plataforma disponible con aviso de "IA temporalmente no disponible"; ejercicios de lectura como sustituto. |
| P-02 Auth | 8 h | 2 h | 0 (credenciales no se pierden) | Login operativo aunque `/auth/signup` esté temporalmente deshabilitado (solo altas por admin). |
| P-03 Persistencia | 24 h | 2 h | 24 h (último backup diario) | Lectura habilitada; escritura puede estar temporalmente bloqueada. |
| P-04 Evaluación OpenAI | 72 h | 24 h | 24 h | Sesión se guarda sin evaluación; se recalcula cuando el proveedor vuelve. |
| P-05 WHAPI | 7 días | 48 h | N/A (idempotente) | Agente informa que el brochure se enviará por email. |
| P-06 Email | 48 h | 24 h | N/A | Links de activación impresos/mostrados en pantalla si aplica. |
| P-07 Admin | 72 h | 24 h | 24 h | Acceso SQL directo para operaciones puntuales (bajo RB-07). |
| P-08 Dashboards | 7 días | 72 h | 24 h | Export manual de SQL a Excel a demanda. |

### 4.4 Umbral general del servicio

- **RTO global del servicio**: 4 horas.
- **RPO global del servicio**: 24 horas (alineado con backup diario de PostgreSQL).
- **MTPD global antes de impacto reputacional severo**: 24 horas.

Cualquier incidente cuya duración proyectada supere el MTPD **requiere activación
formal del BCP** (nivel 2 o superior, sección 7).

---

## 5. Análisis de riesgos y amenazas

### 5.1 Matriz de amenazas

Probabilidad (P) y Severidad (S) en escala 1–5. Riesgo = P × S.

| ID | Amenaza | P | S | Riesgo | Mitigación primaria | Runbook |
|---|---|---|---|---|---|---|
| T-01 | Caída del contenedor `app` | 3 | 4 | 12 | Healthcheck + reinicio automático | RB-01 |
| T-02 | Falla de PostgreSQL (corrupción, disco lleno, RDS down) | 2 | 5 | 10 | Backup diario + restore probado | RB-02, RB-05 |
| T-03 | Indisponibilidad de ElevenLabs | 3 | 4 | 12 | Modo degradado + comunicación | RB-03 |
| T-04 | Indisponibilidad de OpenAI | 2 | 2 | 4 | Evaluación diferida (cola), no bloqueante | — |
| T-05 | Caída de la región Huawei Cloud | 1 | 5 | 5 | Backups fuera de región + plan de redeploy | sección 6.4 |
| T-06 | Expiración/compromiso de certificado SSL | 2 | 4 | 8 | `certbot renew` automatizado | RB-08 |
| T-07 | Compromiso de credenciales (ej. token WHAPI hardcodeado) | 3 | 4 | 12 | Rotación periódica + auditoría de git | RB-06 |
| T-08 | Ataque de denegación de servicio | 2 | 3 | 6 | Rate limiting + Nginx + WAF del proveedor | — |
| T-09 | Pérdida de personal clave (bus factor) | 2 | 4 | 8 | Suplencia documentada, runbooks, este BCP | sección 10 |
| T-10 | Ransomware en el host ECS | 1 | 5 | 5 | Backups offsite inmutables + parches SO | sección 6.4 |
| T-11 | Cambio de código erróneo en producción | 3 | 3 | 9 | CI verde + backup pre-deploy + rollback | RB-04 |
| T-12 | Borrado accidental de datos por admin | 2 | 4 | 8 | Backup diario + auditoría de roles | RB-05, RB-07 |
| T-13 | Cambios de API no anunciados en proveedores | 2 | 3 | 6 | Monitoreo de errores + suscripción a changelog | — |
| T-14 | Sanciones geopolíticas sobre proveedor de nube o IA | 1 | 5 | 5 | Contratos redundantes preparados (ver 6.3) | — |

### 5.2 Priorización

Riesgos con puntaje ≥10 deben tener:

- Un **procedimiento de mitigación documentado** (runbook o sección 6).
- **Pruebas periódicas** (tabla 11.1).
- **Indicadores de alerta temprana** (sección 9 del Manual Técnico).

---

## 6. Estrategias de continuidad

### 6.1 Estrategia por componente

| Componente | Estrategia | Detalle |
|---|---|---|
| Contenedor `app` | **Resiliencia** | `restart: always` en compose, healthcheck `/health`, reinicio automático ante caída. |
| PostgreSQL | **Resiliencia + Backup** | Backups diarios comprimidos + copia offsite (OBS/S3/Drive). Restore probado mensualmente (RB-05). |
| Nginx + TLS | **Resiliencia** | Renovación automática de certificados (RB-08). Config versionada en git. |
| ElevenLabs | **Degradación graceful** | La plataforma detecta `5xx`/`401` y muestra banner. Sesiones nuevas bloqueadas; resto de la plataforma operativa. |
| OpenAI | **Cola diferida** | Evaluaciones se encolan o marcan `pending`; la sesión se guarda igual y la evaluación se recalcula cuando el proveedor vuelve. |
| WHAPI | **Degradación + sustituto** | Si falla, el agente instruye al usuario que recibirá el brochure por email (Resend). |
| Resend | **Degradación** | Los mensajes críticos (reset password) se logran en BD para re-envío cuando el proveedor se restablezca. |
| Host ECS | **Reconstrucción** | Infra como código implícita: docker-compose + `.env` + backup = host reconstruible en <2 h en otro ECS. |
| DNS | **Resiliencia** | Proveedor con SLA; respaldo de zona en gestor documental. |

### 6.2 Matriz de decisión de modo operativo

| Estado | Descripción | Quién decide |
|---|---|---|
| **Normal** | Todos los componentes verdes. | — |
| **Degradado** | Al menos un proveedor externo caído, pero el core (P-01/P-02/P-03) funciona o hay workaround. | On-call/SRE notifica; Service Owner confirma. |
| **Limitado** | El core está parcialmente caído pero los datos están seguros. | Coordinador de Crisis. |
| **Contingencia** | El core está caído o los datos están en riesgo. | Service Owner + Sponsor. |
| **Desastre** | Pérdida de infraestructura primaria. | Sponsor ejecutivo. |

### 6.3 Redundancia contractual preparada

Para riesgos geopolíticos o de proveedor (T-14, T-05), se mantienen **cuentas
frías** (no activas pero pre-autorizadas) en:

- Proveedor IaaS alterno (AWS o GCP) — para redeploy del monolito.
- Proveedor TTS/LLM alterno (ej. OpenAI Realtime API) — evaluado como sustituto
  parcial de ElevenLabs si la indisponibilidad supera 72 h.

> Estas cuentas no se usan en operación normal. Se documenta la decisión de
> migración en un change de nivel "Emergency" (ver sección 7.3).

### 6.4 Estrategia ante desastre de región

Escenario: pérdida completa del ECS primario y/o la región.

1. Provisionar un ECS nuevo en la región secundaria disponible.
2. Clonar el repositorio en el nuevo host.
3. Restaurar `.env` desde el gestor de secretos institucional.
4. Reconstruir imágenes: `docker-compose up -d --build`.
5. Restaurar el último backup offsite de PostgreSQL (RB-05 sección 5.B).
6. Actualizar DNS para apuntar al nuevo host (TTL operativo recomendado ≤300 s).
7. Renovar certificado SSL en el nuevo host (RB-08).
8. Smoke tests (RB-04 paso 8) y comunicación (sección 9).

**RTO estimado**: 4 h · **RPO**: 24 h (último backup offsite).

---

## 7. Plan de respuesta y activación

### 7.1 Niveles de activación

| Nivel | Nombre | Disparador | Quién activa |
|---|---|---|---|
| 0 | Monitoreo | Evento detectado sin impacto en producción. | On-call/SRE. |
| 1 | Respuesta operativa | Incidente P1/P2 — se ejecuta runbook. | On-call/SRE. |
| 2 | Activación parcial | Incidente supera 1 h o impacta varios procesos; se activa CCoN. | Service Owner. |
| 3 | Activación total | RTO excedido o amenaza al MBCO; se declara crisis. | Service Owner + Sponsor. |
| 4 | Desastre | Pérdida de infraestructura primaria. | Sponsor. |

### 7.2 Flujo de activación (nivel 2+)

```
Detección  →  Diagnóstico rápido  →  Declaración nivel  →  Convocar CCoN
                                                                │
                                                                ▼
                                               Bitácora de crisis iniciada
                                                                │
              ┌─────────────────────────┬─────────────────────┬─┴──────────────────┐
              ▼                         ▼                     ▼                    ▼
      Recuperación técnica      Comunicación interna   Comunicación externa   Preservación de evidencia
      (ejecutar runbooks)       (estado cada 30 min)   (usuarios / cliente)   (logs, dumps, snapshots)
              │                         │                     │                    │
              └─────────────────────────┴─────────────────────┴────────────────────┘
                                            │
                                            ▼
                                 Criterios de cierre cumplidos
                                            │
                                            ▼
                        Desactivación formal  →  Post-incident review (≤5 días)
```

### 7.3 Cambios en modo emergencia

Durante una activación se pueden necesitar cambios fuera del proceso normal de
Change Enablement (RB-04). Se aplica la categoría **Emergency Change** de ITIL 4:

- Aprobación verbal o por chat del Service Owner (o Sponsor para nivel 3+).
- Bitácora en tiempo real de cada acción tomada.
- Regularización documental en ≤48 h tras cierre.

### 7.4 Criterios de desactivación

Se desactiva la crisis cuando **todos** se cumplen durante ≥30 min:

- `/health` responde 200 y los smoke tests pasan.
- Los procesos de criticidad Alta y Crítica están dentro de sus SLO.
- No hay pérdida de datos pendiente de reconciliar (o el plan de reconciliación está agendado).
- La comunicación de cierre fue enviada.

---

## 8. Procedimientos de recuperación

Los procedimientos tácticos viven en `RUNBOOKS.md`. Esta sección mapea cada
escenario de continuidad al runbook (y a los pasos BCP-específicos que los
acompañan).

### 8.1 Mapa escenario → runbook

| Escenario de continuidad | Runbook principal | Acciones BCP adicionales |
|---|---|---|
| App caída / `/health` degradado | RB-01 | Si dura >1 h: declarar nivel 2; si >4 h: nivel 3. |
| Base de datos inaccesible | RB-02 | Si se confirma pérdida de datos: nivel 3, Security Officer notificado. |
| Fallo de ElevenLabs | RB-03 | Si dura >4 h en día lectivo: comunicar a cohortes (sección 9). |
| Despliegue fallido | RB-04 (rollback) | Ver 7.3 para cambio de emergencia. |
| Corrupción/pérdida de datos | RB-05 sección 5.B | Reconciliación documentada con dueños de cohortes. |
| Compromiso de credenciales | RB-06 | Nivel 2 automático; Security Officer co-aprueba. |
| Offboarding de emergencia (empleado sale con riesgo) | RB-07 sección 7.C | Cambio coordinado con RRHH. |
| Certificado SSL vencido | RB-08 | Si outage de HTTPS >30 min: nivel 2. |
| Pérdida de host / desastre regional | Este BCP sección 6.4 | Nivel 4. |

### 8.2 Escenarios no cubiertos por runbook

| Escenario | Procedimiento |
|---|---|
| Ransomware confirmado en ECS | 1) Aislar host de red. 2) Preservar snapshot forense. 3) Reconstruir en host limpio desde código en git + backup limpio (validado pre-cifrado). 4) Notificar autoridades si aplica. 5) Ver 8.3. |
| Pérdida de acceso al proveedor de nube (cuenta suspendida) | Activar cuenta fría (6.3); redeploy desde código + backup offsite. |
| Pérdida simultánea de personal (bus factor) | Seguir suplencia (sección 10); runbooks y BCP actúan como conocimiento residual. |
| Orden regulatoria de borrado masivo | Ejecutar bajo asesoría legal; documentar en bitácora; backup cifrado separado conservado según retención legal. |

### 8.3 Checklist rápido de activación de crisis

Imprimir y mantener accesible. Completar en orden durante los primeros 15 minutos:

- [ ] Timestamp de detección registrado.
- [ ] Nivel declarado (1/2/3/4) y quién declaró.
- [ ] Bitácora de crisis abierta (documento compartido).
- [ ] Coordinador de Crisis asignado.
- [ ] Canal único de comunicación establecido (chat dedicado).
- [ ] Proceso(s) afectado(s) identificado(s) (P-01..P-08).
- [ ] Runbook(s) aplicable(s) referenciado(s).
- [ ] Primer mensaje interno enviado (plantilla 9.2).
- [ ] Primer mensaje externo decidido (enviar / retener / escalar).
- [ ] Snapshot de estado inicial (logs, métricas) preservado.

---

## 9. Plan de comunicaciones en crisis

### 9.1 Principios

- **Un único portavoz** hacia el exterior (Responsable de comunicaciones).
- **Honestidad calibrada**: decir lo que se sabe, lo que no se sabe y lo que se
  está haciendo. No especular.
- **Frecuencia mínima**: cada 30 min en nivel 2+, incluso si no hay novedades.
- **Cierre explícito**: no declarar "resuelto" sin criterios de sección 7.4.

### 9.2 Plantillas

**Mensaje interno — apertura**

```
[CRISIS - Nivel X] <timestamp> Incidente afectando <proceso>.
Coord: <nombre>. Líder técnico: <nombre>. Canal: <link>.
Estado inicial: <síntoma>. Próximo update: <timestamp+30min>.
```

**Mensaje externo — banner / email / WhatsApp**

```
Estamos trabajando en una incidencia que afecta <funcionalidad>.
Tu progreso guardado está seguro. Te avisaremos en cuanto se
restablezca el servicio. Disculpa las molestias.
```

**Mensaje externo — cierre**

```
El servicio se restableció a las <timestamp>. Si notas algo inusual,
por favor contáctanos en <canal>. Gracias por tu paciencia.
```

### 9.3 Canales

| Audiencia | Canal primario | Canal de respaldo |
|---|---|---|
| Equipo interno | Chat institucional (canal `#senoriales-crisis`) | Llamada directa |
| Cohortes activas | Banner en la SPA + email (Resend) | WhatsApp (WHAPI) si Resend cae |
| Cliente Corporación Señoriales | Email directo a contacto designado + reporte resumido | Llamada |
| Proveedores | Ticket en su sistema + email | — |

### 9.4 Prohibiciones

- No comunicar detalles técnicos de seguridad (credenciales, vectores, IPs).
- No atribuir culpa pública a terceros antes del post-mortem.
- No publicar en redes sociales sin aprobación del Sponsor.

---

## 10. Recursos humanos y sucesión

### 10.1 Mapa de suplencias (plantilla — completar con nombres reales)

| Rol primario | Titular | Suplente 1 | Suplente 2 |
|---|---|---|---|
| Service Owner | <nombre> | <nombre> | <nombre> |
| Coordinador de Crisis | <nombre> | <nombre> | <nombre> |
| On-call/SRE | <rotación semanal> | siguiente en rotación | Service Owner |
| DBA | <nombre> | On-call/SRE con RB-02/RB-05 a mano | — |
| Security Officer | <nombre> | Service Owner | — |
| Infra/Cloud | <nombre> | <nombre> | Soporte Huawei Cloud |
| Responsable de comunicaciones | <nombre> | Service Owner | — |

> La matriz de contactos con teléfonos y emails se mantiene en un documento
> anexo de acceso restringido. **No se incluye en git**.

### 10.2 Conocimiento crítico (bus factor)

Conocimiento que debe estar documentado para no depender de una persona:

- Tools de agentes ElevenLabs y sus endpoints server-side → Manual Técnico.
- Procedimiento de restore de PostgreSQL → RB-05 (probado mensualmente).
- Credenciales y su rotación → RB-06 + gestor de secretos.
- Configuración de Huawei Cloud ECS/RDS → documento de infraestructura anexo.

### 10.3 Onboarding de emergencia

Si un miembro nuevo debe incorporarse durante una crisis:

1. Acceso de solo lectura a git, logs y dashboards.
2. Briefing de 15 min por Coordinador de Crisis.
3. Asignación de tarea acotada con supervisión.
4. Escalado de privilegios solo si la crisis lo exige, registrado en bitácora.

---

## 11. Pruebas, ejercicios y mejora continua

### 11.1 Calendario de pruebas

| Prueba | Frecuencia | Nivel | Descripción | Responsable |
|---|---|---|---|---|
| Restore de DB en sandbox | Mensual | Técnica | Tomar el último backup y restaurarlo en entorno aislado. Validar conteos. | DBA / On-call |
| Ejercicio de mesa (tabletop) | Semestral | Gobernanza | Recorrer un escenario hipotético sin tocar producción. | Service Owner |
| Simulacro parcial | Semestral | Técnica | Rollback de release en staging como si fuera prod. | On-call |
| Prueba de rotación de credenciales | Trimestral | Técnica | Rotar `JWT_SECRET` en staging (RB-06) y validar. | On-call + Security Officer |
| Prueba de redeploy en región secundaria | Anual | Técnica | Levantar un clon funcional desde backup offsite. | Infra + DBA |
| Simulacro de caída de ElevenLabs | Anual | Técnica+Com. | Bloquear salida a `api.elevenlabs.io` en staging y validar mensaje al usuario. | On-call + Comunicaciones |
| Revisión completa del BCP | Semestral | Gobernanza | Actualizar contactos, RTO/RPO, amenazas. | Service Owner |

### 11.2 Criterios de éxito de una prueba

- Se completó dentro del RTO objetivo del escenario.
- Los participantes usaron los runbooks sin consulta externa.
- Se identificaron ≥1 mejoras (de proceso, herramienta o documentación).
- Se registró la prueba con duración, incidencias y acciones correctivas.

### 11.3 Ciclo de mejora

```
Ejecutar prueba  →  Recolectar hallazgos  →  Abrir acciones correctivas
       ▲                                                   │
       │                                                   ▼
Re-prueba ← Actualizar BCP/Runbook ← Implementar acción
```

---

## 12. Mantenimiento del plan

### 12.1 Disparadores de revisión fuera de ciclo

Revisar y actualizar este BCP **dentro de los 30 días** si ocurre alguno de:

- Cambio arquitectónico mayor (ej. separar backend en microservicios).
- Cambio de proveedor crítico (ElevenLabs, OpenAI, Huawei Cloud).
- Incidente de nivel 3 o 4.
- Cambio de Service Owner o Sponsor.
- Cambio regulatorio relevante (protección de datos).
- Hallazgos de auditoría que afecten continuidad.

### 12.2 Control de versiones

Todo cambio se registra en la tabla 1 (control del documento). Los cambios
mayores (nuevas estrategias, cambio de RTO/RPO) requieren aprobación del Sponsor.

### 12.3 Disponibilidad del plan

- **Copia primaria**: `docs/BCP.md` en el repositorio git.
- **Copia offline**: PDF generado semestralmente, almacenado fuera del ECS
  (para el caso "no tenemos acceso al repo").
- **Copia de bolsillo**: checklist de sección 8.3 impreso y accesible al
  equipo de guardia.

---

## 13. Apéndices

### Apéndice A — Matriz consolidada RTO/RPO

| Proceso | Criticidad | RTO | RPO | Runbook |
|---|---|---|---|---|
| P-01 Sesión IA | Crítica | 4 h | 24 h | RB-01, RB-03 |
| P-02 Auth | Crítica | 2 h | 0 | RB-01 |
| P-03 Persistencia | Crítica | 2 h | 24 h | RB-02, RB-05 |
| P-04 Evaluación | Alta | 24 h | 24 h | RB-03 |
| P-05 WHAPI | Media | 48 h | N/A | — |
| P-06 Email | Media | 24 h | N/A | — |
| P-07 Admin | Media | 24 h | 24 h | RB-07 |
| P-08 Dashboards | Baja | 72 h | 24 h | — |
| **Servicio global** | — | **4 h** | **24 h** | — |

### Apéndice B — Inventario mínimo para recuperación

Para reconstruir el servicio desde cero se necesita:

1. **Código**: repositorio git (rama `main`).
2. **Secretos**: `.env` del servidor, en gestor de secretos institucional.
3. **Datos**: backup más reciente de PostgreSQL (offsite).
4. **Dominio y DNS**: credenciales del registrador.
5. **Proveedores IA**: credenciales ElevenLabs + OpenAI.
6. **Proveedores mensajería**: WHAPI + Resend.
7. **Infraestructura**: credenciales Huawei Cloud (o proveedor alterno).
8. **Documentación**: este BCP + `RUNBOOKS.md` + `MANUAL-TECNICO.md`.

Si alguno de estos elementos no está respaldado fuera del host primario, se
considera una **brecha de continuidad** y debe abrirse acción correctiva.

### Apéndice C — Glosario

| Término | Definición |
|---|---|
| BCP | Business Continuity Plan — este documento. |
| BIA | Business Impact Analysis — sección 4. |
| CCoN | Comité de Continuidad de Negocio. |
| MBCO | Minimum Business Continuity Objective — nivel mínimo aceptable en contingencia. |
| MTPD | Maximum Tolerable Period of Disruption. |
| RPO | Recovery Point Objective — pérdida máxima tolerable de datos. |
| RTO | Recovery Time Objective — tiempo máximo para recuperar. |
| SLO | Service Level Objective — métrica interna de calidad. |
| Tabletop | Ejercicio teórico sin tocar producción. |

### Apéndice D — Relación con otros marcos

| Requisito de marco | Sección del BCP que lo cubre |
|---|---|
| ISO 22301 §4 Contexto | 2 Propósito y alcance |
| ISO 22301 §5 Liderazgo | 3 Gobernanza |
| ISO 22301 §8.2 BIA y evaluación de riesgos | 4, 5 |
| ISO 22301 §8.3 Estrategia | 6 |
| ISO 22301 §8.4 Procedimientos | 7, 8 |
| ISO 22301 §8.5 Pruebas | 11 |
| ISO 22301 §9–10 Evaluación y mejora | 11.3, 12 |
| NIST SP 800-34 Contingency Planning | 4, 6, 8 |
| ITIL 4 Service Continuity Management | todo el documento (estratégico) |
| ITIL 4 Incident / Change / Release / Security Mgmt. | referenciados vía runbooks |

---

**Fin del documento.**
