# Runbook Operativo SRE: Respuesta a Incidentes en Mattermost

## 1. Identificación y Metadatos
* **Servicio:** Mattermost Team Edition (App Server + PostgreSQL)
* **Severidad:** P1 (Crítica) / P2 (Mayor)
* **Responsable:** SRE On-Call / DevOps Engineer
* **Dashboard Oficial:** `http://<grafana-host>:3000/d/mattermost-sre-overview`
* **Alertmanager / Prometheus:** `http://<prometheus-host>:9090/alerts`

---

## 2. Escenario Crítico 1: Alerta `MattermostHighBurnRateCritical` (Consumo Acelerado de Error Budget)

### 2.1. Síntomas
* Disparo de alerta en Prometheus: `job:mattermost_error_rate:ratio5m > (14.4 * 0.005)`.
* Panel de **Error Budget en Grafana** cayendo abruptamente.
* Clientes web o móviles experimentando fallos de conexión, desconexión de WebSockets o errores HTTP 500/502.

### 2.2. Paso 1: Triage Inicial (< 3 minutos)
1. **Comprobar estado de los contenedores:**
   ```bash
   docker compose ps
   docker compose -f observability/docker-compose.monitoring.yml ps
   ```
2. **Revisar métricas clave en Grafana:**
   * ¿El pico es por tráfico legítimo o ataque? (Panel: *Tráfico HTTP req/s*).
   * ¿Afecta a la base de datos? (Panel: *PostgreSQL Conexiones Activas*).

### 2.3. Paso 2: Diagnóstico Detallado (< 7 minutos)
1. **Inspeccionar los logs recientes de la aplicación:**
   ```bash
   docker compose logs --tail=100 -f mattermost
   ```
2. **Buscar errores de conexión con PostgreSQL:**
   ```bash
   docker compose logs mattermost | grep -iE "error|fatal|cannot connect|connection refused"
   ```
3. **Verificar el endpoint de salud interno:**
   ```bash
   curl -I http://localhost:8065/api/v4/system/ping
   ```

### 2.4. Paso 3: Mitigación Rápida
* **Opción A: Inestabilidad del servidor de aplicación (Fuga de memoria o bloqueo):**
  Reiniciar el servicio de Mattermost sin afectar la persistencia:
  ```bash
  docker compose restart mattermost
  ```
* **Opción B: Base de datos saturada:**
  ```bash
  docker compose restart postgres
  ```
* **Opción C: Rollback inmediato (si ocurrió tras un despliegue reciente):**
  Desplegar el tag de imagen anterior en `docker-compose.yml` y ejecutar:
  ```bash
  docker compose up -d mattermost
  ```

### 2.5. Paso 4: Verificación y Cierre
1. El SLI de disponibilidad debe volver a $> 99.5\%$ en la ventana de 5m.
2. La alerta en Prometheus debe pasar de estado `FIRING` a `RESOLVED`.
3. Notificar en el canal de incidentes la normalización del servicio.

---

## 3. Escenario Crítico 2: Caída de Base de Datos (`MattermostDatabaseDown`)

### 3.1. Diagnóstico
```bash
docker exec -it mattermost-db pg_isready -U mmuser -d mattermost
docker compose logs --tail=50 postgres
```

### 3.2. Mitigación
1. Verificar espacio en disco en el volumen `postgres_data`:
   ```bash
   df -h /var/lib/docker
   ```
2. Levantar el servicio en caso de fallo inesperado:
   ```bash
   docker compose up -d postgres
   ```

