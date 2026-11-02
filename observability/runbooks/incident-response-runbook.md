# Runbook Operativo de Respuesta a Incidentes SRE — Mattermost

**Servicio:** Plataforma de Comunicación y Colaboración Mattermost
**Nivel de Criticidad:** Tier 1 (Servicio Crítico de Producción)
**Objetivo de Confiabilidad (SLO):** Disponibilidad $\ge 99.5\%$ | Latencia $P_{95} \le 250\text{ ms}$
**Monitoreo y Alertas:** Prometheus & Grafana Stack (`/observability`)

---

## 1. Matriz de Severidad y Rutas de Escalamiento

| Severidad | Criterio de Activación | Tiempo Respuesta (MTTA) | Responsable Primario |
|---|---|---|---|
| **P1 - Crítica** | Burn Rate $> 14.4\times$, servicio caído (`probe_success == 0`), PostgreSQL DOWN. | $< 5$ minutos | SRE On-Call + Lead Backend |
| **P2 - Alta** | Burn Rate $> 6.0\times$, Latencia $P_{95} > 250\text{ ms}$ sostenida por $> 5\text{ min}$. | $< 15$ minutos | SRE On-Call + Sysadmin |
| **P3 - Media** | Saturación de CPU/Memoria $> 85\%$, Degradación menor de Error Budget. | $< 1$ hora | DevOps / Equipo de Infraestructura |

---

## 2. Flujo de Triage Inicial (Primeros 3 Minutos)

Ante cualquier alerta disparada en Prometheus o notificación de incidente:

1. **Confirmar Impacto y Alcance:**
   - Abrir el dashboard general: [http://localhost:3000](http://localhost:3000)
   - Revisar el panel **"Estado del Servicio (Blackbox Probe)"** y **"Saldo Restante de Error Budget"**.
   - Validar estado de alertas en Prometheus: [http://localhost:9090/alerts](http://localhost:9090/alerts)

2. **Verificar Estado de Contenedores:**
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "mattermost"
   ```

3. **Verificar Salud de Sondeos HTTP:**
   ```bash
   # Probar respuesta directa al endpoint de salud
   curl -i -s -m 5 http://localhost:8065/api/v4/system/ping || echo "SERVICIO NO RESPONDE"

   # Consultar sonda del blackbox
   curl -s "http://localhost:9115/probe?target=http://mattermost-app:8065/api/v4/system/ping&module=http_mattermost_ping" | grep probe_success
   ```

---

## 3. Procedimientos de Diagnóstico y Mitigación por Alerta

### 3.1 Incidente A: `MattermostHighBurnRateCritical` o `MattermostServiceDown`
**Condición:** Tasa de fallos elevada sostenida o el servicio no responde peticiones HTTP.

#### Diagnóstico:
1. Comprobar si el contenedor `mattermost-app` está detenido o reiniciándose:
   ```bash
   docker inspect mattermost-app --format 'Estado: {{.State.Status}} | OOMKilled: {{.State.OOMKilled}} | Salida: {{.State.ExitCode}}'
   ```
2. Inspeccionar los últimos logs de la aplicación:
   ```bash
   docker logs --tail 100 mattermost-app | grep -iE "error|fatal|panic|database"
   ```

#### Mitigación Rápida:
- Si el contenedor está detenido o bloqueado:
  ```bash
  docker restart mattermost-app
  ```
- Si no levanta por inconsistencia en base de datos:
  ```bash
  # Validar que PostgreSQL responda
  docker exec -it mattermost-db pg_isready -U mmuser -d mattermost
  # Reiniciar ambos en orden
  docker restart mattermost-db && sleep 5 && docker restart mattermost-app
  ```

---

### 3.2 Incidente B: `MattermostDatabaseDown`
**Condición:** `pg_up == 0` (PostgreSQL exporter no puede conectar al motor relacional).

#### Diagnóstico:
1. Verificar estado del contenedor de base de datos:
   ```bash
   docker logs --tail 50 mattermost-db
   ```
2. Revisar si PostgreSQL alcanzó el límite de conexiones concurrentes:
   ```bash
   docker exec -it mattermost-db psql -U mmuser -d mattermost -c "SELECT count(*) FROM pg_stat_activity;"
   ```

#### Mitigación Rápida:
- Reiniciar el contenedor de PostgreSQL:
  ```bash
  docker restart mattermost-db
  ```
- Si hay bloqueos de transacciones (deadlocks):
  ```bash
  docker exec -it mattermost-db psql -U mmuser -d mattermost -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE state = 'idle in transaction' AND state_change < current_timestamp - INTERVAL '5' MINUTE;
  "
  ```

---

### 3.3 Incidente C: `MattermostLatencySLODegraded`
**Condición:** Latencia promedio o $P_{95} > 250\text{ ms}$ durante más de 3 minutos consecutivos.

#### Diagnóstico:
1. Identificar uso de CPU y memoria de los contenedores:
   ```bash
   docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
   ```
2. Validar latencias de red y procesamiento con el blackbox exporter:
   ```bash
   curl -s "http://localhost:9115/probe?target=http://mattermost-app:8065/&module=http_2xx" | grep probe_http_duration_seconds
   ```

#### Mitigación Rápida:
- Si hay un proceso de alta carga en el contenedor:
  ```bash
  # Reiniciar el contenedor para liberar recursos
  docker restart mattermost-app
  ```
- Si la saturación viene de la base de datos:
  ```bash
  docker exec -it mattermost-db vacuumdb -U mmuser -d mattermost --analyze --verbose
  ```

---

## 4. Verificación del Restablecimiento del Servicio

Tras aplicar cualquier acción de mitigación:

1. **Verificar que el endpoint HTTP responda con código 200:**
   ```bash
   curl -i http://localhost:8065/api/v4/system/ping
   ```
2. **Confirmar que los targets de Prometheus regresen a estado `[UP]`:**
   ```bash
   curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"[^"]*"' | sort | uniq -c
   ```
3. **Observar en Grafana durante al menos 5 minutos:**
   - El SLI de disponibilidad debe estabilizarse sobre el 99.5%.
   - El saldo de Error Budget debe detener su caída.
   - Las alertas en `http://localhost:9090/alerts` deben transicionar a estado **INACTIVE**.

---

## 5. Simulación de Prueba del Runbook

Para validar y entrenar al equipo en la ejecución de este Runbook:

```bash
# Simular caída de servicio y seguir la Sección 3.1
./observability/scripts/simulate_incident.sh service-down 60

# Simular caída de base de datos y seguir la Sección 3.2
./observability/scripts/simulate_incident.sh db-down 60
```
