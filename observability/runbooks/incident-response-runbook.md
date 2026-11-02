# Runbook Operativo de Respuesta a Incidentes SRE — Mattermost

**Servicio:** Plataforma de Comunicación y Colaboración Mattermost

**Nivel de Criticidad:** Tier 1 (Servicio Crítico de Producción)

**Objetivo de Confiabilidad (SLO):** Disponibilidad $\ge 99.5\%$ | Latencia $P_{95} \le 250\text{ ms}$

**Monitoreo y Alertas:** Prometheus & Grafana Stack (`/observability`)

---

## 1. Matriz de Severidad y Rutas de Escalamiento

| Severidad | Criterio de Activación | Tiempo Respuesta (MTTA) | Responsable Primario |
|---|---|---|---|
| **P1 - Crítica** | Burn Rate $> 14.4\times$, servicio caído (`probe_success == 0`), PostgreSQL DOWN (`pg_up == 0`). | $< 5$ minutos | SRE On-Call + Lead Backend |
| **P2 - Alta** | Burn Rate $> 6.0\times$, Latencia $P_{95} > 250\text{ ms}$ sostenida por $> 3\text{ min}$. | $< 15$ minutos | SRE On-Call + Sysadmin |
| **P3 - Media** | Saturación de CPU/Memoria $> 85\%$ (`HostHighCPUUsage`), Degradación menor de Error Budget. | $< 1$ hora | DevOps / Equipo de Infraestructura |

---

## 2. Flujo de Triage Inicial (Primeros 3 Minutos)

Ante cualquier alerta disparada en Prometheus o notificación de incidente:

1. **Confirmar Impacto y Alcance en Dashboards:**
   - Abrir el panel principal en Grafana: [http://localhost:3000](http://localhost:3000)
   - Revisar los paneles clave: **"Estado del Servicio (Blackbox Probe)"**, **"Saldo Restante de Error Budget"** y **"1. Tráfico: Tasa de Peticiones HTTP"**.
   - Validar estado de alertas en Prometheus: [http://localhost:9090/alerts](http://localhost:9090/alerts)

2. **Verificar Estado de los Contenedores del Stack:**
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "mattermost"
   ```

3. **Verificar Salud Directa y Sondas Sintéticas:**
   ```bash
   # 1. Probar respuesta directa al endpoint de salud HTTP
   curl -i -s -m 5 http://localhost:8065/api/v4/system/ping || echo "ALERTA: MATTERMOST NO RESPONDE"

   # 2. Consultar la sonda del Blackbox Exporter
   curl -s "http://localhost:9115/probe?target=http://mattermost-app:8065/api/v4/system/ping&module=http_mattermost_ping" | grep probe_success
   ```

---

## 3. Procedimientos de Diagnóstico y Mitigación por Incidente

### 3.1 Incidente A: `MattermostHighBurnRateCritical` o `MattermostServiceDown`
**Condición:** Tasa de fallos elevada sostenida (Burn Rate $> 14.4\times$) o el servicio no responde peticiones HTTP (`probe_success == 0`).

#### Diagnóstico:
1. Comprobar si el contenedor `mattermost-app` está detenido, en bucle de reinicio o si fue terminado por OOM:
   ```bash
   docker inspect mattermost-app --format 'Estado: {{.State.Status}} | OOMKilled: {{.State.OOMKilled}} | ExitCode: {{.State.ExitCode}}'
   ```
2. Inspeccionar los últimos logs de la aplicación buscando errores fatales o pánicos:
   ```bash
   docker logs --tail 100 mattermost-app | grep -iE "error|fatal|panic|database|connection refused"
   ```

#### Mitigación Rápida:
- Si el contenedor está detenido o colgado:
  ```bash
  docker restart mattermost-app
  ```
- Si la aplicación falla por desconexión con la base de datos:
  ```bash
  # Validar que PostgreSQL responda
  docker exec -it mattermost-db pg_isready -U mmuser -d mattermost
  # Reiniciar ambos servicios en orden de dependencia
  docker restart mattermost-db && sleep 5 && docker restart mattermost-app
  ```

---

### 3.2 Incidente B: `MattermostDatabaseDown`
**Condición:** `pg_up == 0` (El exportador de PostgreSQL no puede conectar con el motor relacional).

#### Diagnóstico:
1. Verificar si el contenedor de PostgreSQL está activo e inspeccionar logs:
   ```bash
   docker logs --tail 50 mattermost-db
   ```
2. Revisar si PostgreSQL alcanzó el límite máximo de conexiones concurrentes:
   ```bash
   docker exec -it mattermost-db psql -U mmuser -d mattermost -c "SELECT count(*) AS conexiones_activas FROM pg_stat_activity;"
   ```

#### Mitigación Rápida:
- Reiniciar el contenedor de base de datos:
  ```bash
  docker restart mattermost-db
  ```
- Si hay consultas bloqueantes (*deadlocks*) o transacciones inactivas agotando el pool:
  ```bash
  docker exec -it mattermost-db psql -U mmuser -d mattermost -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE state = 'idle in transaction' AND state_change < current_timestamp - INTERVAL '5' MINUTE;
  "
  ```

---

### 3.3 Incidente C: `MattermostLatencySLODegraded`
**Condición:** Latencia promedio o percentil $P_{95} > 250\text{ ms}$ durante más de 3 minutos consecutivos.

#### Diagnóstico:
1. Identificar si existe saturación de recursos en los contenedores:
   ```bash
   docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
   ```
2. Desglosar las fases de latencia HTTP mediante la sonda de Blackbox:
   ```bash
   curl -s "http://localhost:9115/probe?target=http://mattermost-app:8065/&module=http_2xx" | grep -E "probe_http_duration_seconds|probe_duration_seconds"
   ```

#### Mitigación Rápida:
- Si el tiempo de procesamiento interno es elevado:
  ```bash
  # Reiniciar el contenedor de la aplicación para purgar memoria y buffers
  docker restart mattermost-app
  ```
- Si la lentitud se origina en la capa de persistencia:
  ```bash
  # Reorganizar y optimizar las estadísticas de PostgreSQL
  docker exec -it mattermost-db vacuumdb -U mmuser -d mattermost --analyze --verbose
  ```

---

### 3.4 Incidente D: `HostHighCPUUsage` o `HostHighMemoryUsage`
**Condición:** Uso de CPU del host $> 85\%$ o Memoria $> 90\%$ de forma sostenida (Riesgo de degradación general del sistema).

#### Diagnóstico:
1. Identificar qué proceso o contenedor está consumiendo recursos en el sistema anfitrión:
   ```bash
   # Inspección de contenedores
   docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
   # Inspección de procesos generales en Linux
   ps aux --sort=-%cpu | head -n 10
   ```

#### Mitigación Rápida:
- Si un proceso en bucle o prueba de carga dentro de `mattermost-app` está saturando los núcleos (ej. simulación `high-load`):
  ```bash
  # Terminar procesos de cálculo descontrolados y reiniciar el contenedor
  docker exec mattermost-app sh -c 'pkill -f "while true" 2>/dev/null' || true
  docker restart mattermost-app
  ```

---

## 4. Verificación del Restablecimiento del Servicio

Tras ejecutar cualquier acción de remediación:

1. **Verificar que el servicio responda HTTP 200:**
   ```bash
   curl -i http://localhost:8065/api/v4/system/ping
   ```
2. **Confirmar que todos los objetivos de Prometheus retornen a estado `[UP]`:**
   ```bash
   curl -s http://localhost:9090/api/v1/targets | python3 -c "
   import sys, json
   data = json.load(sys.stdin)
   for t in data.get('data', {}).get('activeTargets', []):
       print(f\"[{t['health'].upper()}] Job: {t['labels'].get('job'):25s}\")
   "
   ```
3. **Validación en Grafana durante 5 minutos:**
   - El **SLI de disponibilidad** debe volver y estabilizarse sobre el **$99.5\%$**.
   - El panel **"Estado del Servicio"** debe marcar **UP ✅**.
   - Las alertas en [http://localhost:9090/alerts](http://localhost:9090/alerts) deben transicionar a **INACTIVE**.

---

## 5. Simulación de Pruebas del Runbook

Para entrenar y validar los procedimientos de este Runbook de forma controlada:

```bash
# Simulación 1: Caída de la aplicación (Procedimiento 3.1)
./observability/scripts/simulate_incident.sh service-down 60

# Simulación 2: Caída de PostgreSQL (Procedimiento 3.2)
./observability/scripts/simulate_incident.sh db-down 60

# Simulación 3: Sobrecarga extrema de CPU (Procedimiento 3.4)
./observability/scripts/simulate_incident.sh high-load 60
```
