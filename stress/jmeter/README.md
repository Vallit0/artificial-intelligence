# Load test con JMeter — read storm

Plan de carga (`senoriales-load.jmx`) que simula **muchos usuarios concurrentes leyendo** la plataforma. Complementa al stress test de Node (`../stress.mjs`, que cubre mutaciones + cleanup): JMeter es para medir **latencia y throughput bajo concurrencia sostenida** (capacidad de cara al go-live de 900 usuarios).

## Qué hace

1. **setUp (1 hilo):** un único `POST /auth/login` con el admin → extrae `accessToken` → lo guarda como propiedad global `authToken`. Un solo login para **respetar el rate limit de 10/15min/IP**.
2. **Read storm (N hilos):** cada hilo, en bucle por `duration` segundos, golpea el mix de lectura reusando el token:
   `GET /api/config`, `/auth/me`, `/api/scenarios`, `/api/prospecting-scenarios/me`, `/api/sessions`, `/api/progress`, con un *think time* aleatorio entre requests.

**Es read-only** a propósito (no crea ni borra datos), así que es seguro incluso contra prod — aunque **se recomienda apuntar a capa-02 (standby)** para no degradar la experiencia real.

## Prerrequisitos

- **Apache JMeter 5.5+** y **Java 8+**. Descarga: <https://jmeter.apache.org/download_jmeter.cgi> (o `brew install jmeter` / `apt install jmeter`).

## Ejecutar (modo CLI / non-GUI — recomendado para cargar)

```bash
jmeter -n -t stress/jmeter/senoriales-load.jmx \
  -Jbase_protocol=https -Jbase_host=centro-de-negocios.org -Jbase_port=443 \
  -Jadmin_email=admin@gmail.com -Jadmin_password='admin' \
  -Jthreads=50 -Jrampup=30 -Jduration=120 \
  -l stress/jmeter/results.jtl -e -o stress/jmeter/report
```

- `-l results.jtl` → resultados crudos (un row por request).
- `-e -o report` → genera el **dashboard HTML** al terminar; abrí `stress/jmeter/report/index.html`.

### Parámetros (`-J<nombre>=<valor>`)

| Propiedad | Default | Qué controla |
|---|---|---|
| `base_protocol` / `base_host` / `base_port` | `https` / `centro-de-negocios.org` / `443` | Target |
| `admin_email` / `admin_password` | `admin@gmail.com` / `admin` | Credenciales del login |
| `threads` | `50` | Usuarios concurrentes |
| `rampup` | `30` | Segundos para llegar a `threads` |
| `duration` | `120` | Duración total del storm (s) |
| `think_ms` / `think_range_ms` | `500` / `800` | Think time mínimo + rango aleatorio (ms) |

### Escalar hacia 900 usuarios

Subí en pasos y mirá dónde se degrada p95/errores:

```bash
# tandas: 50 → 150 → 300 → 600 → 900
jmeter -n -t stress/jmeter/senoriales-load.jmx -Jthreads=300 -Jrampup=60 -Jduration=300 \
  -l results-300.jtl -e -o report-300
```

## Ejecutar (modo GUI — para editar/depurar)

```bash
jmeter -t stress/jmeter/senoriales-load.jmx
```
No corras cargas grandes en GUI (consume mucha RAM y falsea métricas); GUI solo para ajustar el plan.

## Cómo leer el resultado

En el dashboard HTML / Summary Report, por endpoint:
- **p95 / p99** de latencia (lo que importa, no el promedio).
- **Error %** — debe ser ~0. Si ves **401**, el token expiró: bajá `duration` por debajo del TTL del access token, o reducí la tanda.
- **Throughput** (req/s) sostenido.

## Caveats importantes

- **TTL del access token:** el token del login se comparte entre todos los hilos. Si `duration` supera el TTL del JWT de acceso, empezás a ver 401 a mitad del test. Mantené tandas ≤ ~10 min, o dividí en runs.
- **Rate limit de login:** el plan loguea **una sola vez**, así que no lo toca. No multipliques el setUp.
- **Una sola IP:** JMeter desde una máquina = una IP. Para cargas realistas distribuidas (900 reales desde muchas IPs) haría falta JMeter distribuido (varios *slaves*) o un servicio de carga en la nube. Para validar capacidad de servidor/DB, una IP alcanza.
- **No incluye ElevenLabs/OpenAI:** igual que el stress de Node, no toca voz ni IA (esos tienen su propio costo y límites). Esto mide la app + Postgres + nginx.
