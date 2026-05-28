# Análisis de Ancho de Banda - 15 Usuarios Concurrentes

## Centro de Negocios - Estimación de Requisitos de Red

---

## 1. Componentes de Tráfico por Usuario

### A. Carga Inicial de Página (una vez)
| Recurso | Tamaño estimado |
|---------|----------------|
| HTML/JS/CSS (SPA bundle, gzipped) | ~500 KB |
| Imágenes y assets | ~300 KB |
| **Total carga inicial** | **~800 KB** |

### B. Llamadas API durante sesión (continuas)
| Endpoint | Tamaño resp. | Frecuencia |
|----------|-------------|------------|
| GET /api/scenarios | ~5 KB | 1x/sesión |
| GET /api/progress | ~3 KB | 1x/min |
| POST /api/elevenlabs/conversation-token | ~1 KB | 1x/sesión |
| GET /api/memory/advisor/:id | ~2 KB | 1x/sesión |
| POST /api/sessions (guardar) | ~5 KB | 1x/sesión |
| Polling/refreshes misc | ~2 KB | 2x/min |
| **Total API por minuto** | **~10 KB/min** | |

### C. Audio Voz ElevenLabs (WebRTC) — COMPONENTE DOMINANTE
| Dirección | Bitrate | Protocolo |
|-----------|---------|-----------|
| Upstream (voz usuario → ElevenLabs) | ~32-64 Kbps | WebRTC/Opus |
| Downstream (voz AI → usuario) | ~64-128 Kbps | WebRTC/Opus |
| **Total por usuario en conversación** | **~96-192 Kbps** | |

> **Nota importante:** El tráfico de WebRTC de ElevenLabs va directo del navegador del usuario a los servidores de ElevenLabs. **NO pasa por su servidor.** Solo el token inicial pasa por su backend.

---

## 2. Cálculo Total: 15 Usuarios Concurrentes

### Escenario: Todos en conversación de voz simultáneamente (peor caso)

#### Tráfico que pasa por SU SERVIDOR (centro-de-negocios.org):
| Concepto | Cálculo | Total |
|----------|---------|-------|
| Carga inicial (15 usuarios) | 15 × 800 KB | 12 MB (pico único) |
| API continuas | 15 × 10 KB/min | 150 KB/min ≈ **20 Kbps** |
| **Total sostenido por su servidor** | | **~20 Kbps** |

#### Tráfico que sale POR EL INTERNET DE LA OFICINA (si los usuarios están en la misma oficina):
| Concepto | Cálculo | Total |
|----------|---------|-------|
| WebRTC voz (por usuario) | 192 Kbps | - |
| WebRTC voz (15 usuarios) | 15 × 192 Kbps | **2.88 Mbps** |
| API + assets | | ~0.5 Mbps (pico) |
| **Total ancho de banda de oficina** | | **~3.4 Mbps** |

---

## 3. Requisitos Mínimos de Internet

| Escenario | Upload necesario | Download necesario | Internet mínimo |
|-----------|-----------------|-------------------|-----------------|
| 15 usuarios, todos con voz | 1.5 Mbps | 3.4 Mbps | **10 Mbps simétrico** |
| 15 usuarios, 50% con voz | 0.75 Mbps | 1.7 Mbps | **5 Mbps** |
| Solo API (sin voz activa) | 0.1 Mbps | 0.5 Mbps | **1 Mbps** |

### Recomendación con margen de seguridad (2x):
| | Mínimo | Recomendado |
|---|--------|-------------|
| **Download** | 5 Mbps | **10 Mbps** |
| **Upload** | 3 Mbps | **5 Mbps** |
| **Tipo de conexión** | | **Fibra óptica 10/10 Mbps o superior** |

---

## 4. Capacidad del Servidor (Docker en VPS/Cloud)

### Recursos estimados para 15 usuarios:

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| **CPU** | 1 vCore | 2 vCores |
| **RAM** | 1 GB | 2 GB |
| **Node.js (Express)** | Maneja ~100+ req/s | Sobra para 15 usuarios |
| **PostgreSQL** | ~50 queries/min para 15 users | Muy holgado |
| **Nginx** | worker_connections: 1024 | Sobra (15 << 1024) |

### Cuellos de botella potenciales:
1. **ElevenLabs API rate limits** — Verificar plan contratado (concurrencia máxima de agentes)
2. **OpenAI API** — Para evaluaciones de sesión al finalizar
3. **Node.js single-thread** — Una operación bloqueante afecta a todos

---

## 5. Checklist Pre-Presentación (Junta de Accionistas)

### Antes del evento:
- [ ] Ejecutar `k6 run tests/load/setup-test-users.js` para crear usuarios de prueba
- [ ] Ejecutar `k6 run tests/load/load-test-15users.js` contra producción
- [ ] Verificar que TODOS los SLA thresholds pasen
- [ ] Confirmar plan de ElevenLabs soporta 15 conversaciones simultáneas
- [ ] Medir velocidad de internet de la oficina (https://fast.com o https://speedtest.net)
- [ ] Verificar que upload sea ≥ 5 Mbps y download ≥ 10 Mbps

### Durante el evento:
- [ ] Tener dashboard de monitoreo abierto (`GET /health`)
- [ ] No saturar la red con otros dispositivos (desconectar descargas, streaming)
- [ ] Tener hotspot celular 4G/5G como backup de internet

### SLA propuesto para presentación:
| Métrica | Target |
|---------|--------|
| Uptime | 99.5% (máx ~22 min de downtime/mes) |
| Tiempo de respuesta API (P95) | < 2 segundos |
| Tiempo de carga página | < 3 segundos |
| Error rate | < 1% |
| Disponibilidad de voz | Dependiente de ElevenLabs SLA |

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Internet de oficina cae | Media | Hotspot 4G/5G de respaldo |
| ElevenLabs rate limit | Media | Verificar plan; no todos activan voz al mismo tiempo |
| Servidor se queda sin memoria | Baja | Monitorear con `docker stats`; escalar si necesario |
| Base de datos lenta | Muy baja | 15 usuarios es carga mínima para PostgreSQL |
| Certificado SSL expira | Baja | Verificar fecha de expiración antes del evento |

---

## 7. Comando rápido para verificar internet de oficina

```bash
# Desde la máquina del servidor:
curl -s https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py | python3 -

# O simplemente ir a https://fast.com desde un navegador en la oficina
```
