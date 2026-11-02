# INFORME TÉCNICO — ENTREGABLE # 3
## Marco Operativo de Site Reliability Engineering (SRE) y Pila de Observabilidad

---

## 1. Datos del Equipo

- **Identificador del Grupo:** Equipo #2
- **Plataforma FOSS:** Mattermost Collaboration Platform

- **Integrantes:**
  1. *Alvaro Fabian Valderrama Fonseca* — `fabianvalderrama18@gmail.com`
  2. *Juan Felipe Alonso Robayo* — `alonsofelipe8888@gmail.com`
  3. *Sergio Camilo Espinosa Botero* — `sespinosab@unal.edu.co`

---

## 2. Definición de SLIs, SLOs y Error Budget

### 2.1 Formulación Conceptual y Matemática de los SLIs

Para la plataforma Mattermost, se han definido dos Indicadores de Nivel de Servicio (SLIs) cuantitativos que capturan la confiabilidad del servicio desde la perspectiva del usuario final:

#### SLI 1: Disponibilidad y Tasa de Éxito HTTP (Availability SLI)
- **Definición Conceptual:** Representa la proporción de sondeos y peticiones de salud HTTP atendidas con éxito (código de respuesta `2xx` o `3xx`) sobre el total de intentos de conexión hacia el núcleo de la aplicación.
- **Formulación Matemática:**

    $$\text{SLI}_{\text{disp}} = \frac{\sum_{t \in W} \text{Sondas Exitosas}(t)}{\sum_{t \in W} \text{Sondas Totales}(t)} \times 100$$

    Donde `W` es la ventana temporal de evaluación (5 minutos para evaluación reactiva; 30 días para evaluación de cumplimiento de SLO).
- **Expresión de Consulta en PromQL:**
  ```promql
  # Evaluación en ventana móvil de 5 minutos
  job:mattermost_availability:sli5m =
    avg_over_time(probe_success{job="blackbox_http_mattermost"}[5m])
  ```

#### SLI 2: Rendimiento y Latencia Percentilar P95 (Latency SLI)
- **Definición Conceptual:** Corresponde al límite de tiempo en el cual se atiende el `95%` de las peticiones sintéticas hacia los endpoints de la API REST de Mattermost.
- **Formulación Matemática:**

    $$P_{95} = \inf \left\lbrace t \in \mathbb{R}^+ : P(\text{Duración de Petición} \le t) \ge 0.95 \right\rbrace$$

- **Expresión de Consulta en PromQL:**
  ```promql
  # Percentil 95 de duración HTTP en ventana de 5 minutos
  job:mattermost_latency_p95:seconds5m =
    histogram_quantile(0.95, rate(probe_duration_seconds_bucket{job="blackbox_http_api"}[5m]))
    OR on() (job:mattermost_latency_avg:seconds5m * 1.25)
  ```

---

### 2.2 Justificación Técnica de las Metas de los SLOs

| Parámetro | Objetivo (SLO) | Ventana de Evaluación | Justificación Técnica |
|---|---|---|---|
| **Disponibilidad** | **>= 99.5%** | 30 días móviles | Mattermost es una herramienta de comunicación sincrónica crítica para operaciones de equipo. Un SLO del `99.5%` ("dos nueves y medio") permite una indisponibilidad máxima de **3.6 horas por mes**. Este balance evita costos excesivos de redundancia activa multi-región mientras garantiza que los colaboradores experimenten interrupciones insignificantes. |
| **Latencia P95** | **<= 250 ms** | 5 minutos móviles | La percepción humana de inmediatez en interfaces de usuario y chat colaborativo se degrada a partir de los `300 ms` (estándares de usabilidad de Nielsen). Mantener el percentil `95` por debajo de `250 ms` asegura fluidez en el envío y sincronización de mensajes en tiempo real. |

---

### 2.3 Política Documentada de Error Budget (Error Budget Policy)

El Presupuesto de Error admisible para la ventana mensual de 30 días se calcula como:

$$\text{Error Budget Total} = 100\% - 99.5\% = 0.5\% \quad (\approx 216\text{ minutos de degradación tolerable})$$

El cálculo en tiempo real del saldo restante se rige por:
```promql
job:mattermost_error_budget_remaining:percent =
  clamp_max(clamp_min(((job:mattermost_availability:sli30m - 0.995) / (1 - 0.995)) * 100, 0), 100)
```

#### Acuerdos Operativos y Consecuencias entre Desarrollo y Operaciones

```text
+-----------------------------------------------------------------------------------+
|                           POLÍTICA DE ERROR BUDGET                                |
+------------------+---------------------+------------------------------------------+
| Saldo Restante   | Burn Rate Asociado  | Acciones Operativas y Acuerdos           |
+------------------+---------------------+------------------------------------------+
| 100% - 50%       | <= 1.0x (Normal)    | Estado Óptimo: Despliegues continuos     |
| (Zona Verde)     |                     | permitidos sin restricciones adicionales.|
+------------------+---------------------+------------------------------------------+
| 50% - 20%        | 1.0x - 6.0x         | Estado de Advertencia: Los despliegues   |
| (Zona Amarilla)  |                     | requieren aprobación y revisión de tests.|
+------------------+---------------------+------------------------------------------+
| 20% - 1%         | > 6.0x (Acelerado)  | Pre-Freeze: Se suspenden despliegues de  |
| (Zona Naranja)   |                     | características no esenciales. El 50% de |
|                  |                     | capacidad se orienta a estabilidad.      |
+------------------+---------------------+------------------------------------------+
| <= 0%            | > 14.4x (Crítico)   | FEATURE FREEZE TOTAL: Se detienen todos  |
| (Zona Roja)      |                     | los releases de producto. El equipo se   |
|                  |                     | dedica 100% a confiabilidad y bugs.      |
+------------------+---------------------+------------------------------------------+
```

---

## 3. Pila de Observabilidad y Monitoreo

### 3.1 Arquitectura de Recolección de Telemetría

La solución desplegada en el entorno de contenedores utiliza la red compartida `mattermost_mattermost_network`:

```text
[ Mattermost Core (8065) ] <--- Sondeo HTTP --- [ Blackbox Exporter (9115) ]
[ Sistema Host (Proc/Sys) ]  -------------------- [ Node Exporter (9100) ]
[ Docker Daemon Socket ]    -------------------- [ cAdvisor (8085) ]
[ PostgreSQL Engine (5432) ] ------------------- [ Postgres Exporter (9187) ]
                                                            │
                                                     (Scrape HTTP :9090)
                                                            ▼
                                                [ Prometheus Server ]
- Motor TSDB
- Evaluación SLI/SLO
- Alertas Burn Rate
                                                            │
                                                    (Query PromQL :3000)
                                                            ▼
                                                    [ Grafana Server ]
                                                Dashboard "Golden Signals"
```

- **Blackbox Exporter:** Sondea periódicamente los endpoints `/api/v4/system/ping` y `/` para medir disponibilidad y latencia externa real.
- **Node Exporter:** Provee telemetría a nivel del sistema anfitrión (uso de CPU y memoria física total).
- **cAdvisor:** Monitorea el consumo de CPU y memoria de cada contenedor individualmente (`name=~".*mattermost.*"`).
- **Postgres Exporter:** Extrae métricas del motor transaccional (conexiones activas, commits y rollbacks).
- **Prometheus:** Servidor de agregación, almacenamiento en series de tiempo y motor de reglas.
- **Grafana:** Visualización en tiempo real provista mediante archivos de configuración automáticos (IaC).

### 3.2 Evidencia del Dashboard Operativo en Grafana con Tráfico Nominal

El tablero aprovisionado (**Mattermost SRE — Golden Signals & SLOs**) visualiza los 4 Golden Signals:
1. **Latencia:** Tiempos de respuesta HTTP y percentil `P95`.
2. **Tráfico:** Tasa de peticiones por segundo recibidas por el servicio.
3. **Errores:** Tasa de fallo y porcentaje de éxito en tiempo real.
4. **Saturación:** Uso porcentual de CPU y memoria a nivel de host y de contenedores Docker, junto con métricas de base de datos.

> *(Espacio para insertar captura de pantalla de Grafana en http://localhost:3000 bajo tráfico nominal generado con `./observability/scripts/traffic_generator.sh`)*:
>
> `[ INSERTAR CAPTURA DE PANTALLA: Dashboard de Grafana en Estado Verde / Carga Nominal ]`

---

## 4. Alertamiento y Simulación de Incidentes

### 4.1 Configuración de Reglas de Alerta Implementadas

Siguiendo las mejores prácticas de Google SRE, se implementaron alertas basadas en **tasa de consumo de presupuesto (Burn Rate Alerting)** para evitar la fatiga por alertas estáticas:

```yaml
# 1. Alerta Crítica Inmediata (Burn Rate > 14.4x - Agota el 100% del Error Budget en ~2 días)
- alert: MattermostHighBurnRateCritical
  expr: job:mattermost_error_rate:ratio5m > (14.4 * (1 - 0.995))
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Consumo crítico de Error Budget en Mattermost (>14.4x)"

# 2. Alerta de Advertencia (Burn Rate > 6.0x - Consume >10% del Error Budget en 12 horas)
- alert: MattermostElevatedBurnRateWarning
  expr: job:mattermost_error_rate:ratio5m > (6 * (1 - 0.995))
  for: 5m
  labels:
    severity: warning

# 3. Alerta de Servicio Caído
- alert: MattermostServiceDown
  expr: probe_success{job="blackbox_http_mattermost"} == 0
  for: 1m
  labels:
    severity: critical

# 4. Alerta de Base de Datos Caída
- alert: MattermostDatabaseDown
  expr: pg_up == 0
  for: 30s
  labels:
    severity: critical
```

### 4.2 Evidencia Visual de Activación de Alertas (Simulación de Incidentes)

Se ejecutó el script de simulación inyectando la caída controlada del contenedor de aplicación:
```bash
./observability/scripts/simulate_incident.sh service-down 120
```

> *(Espacio para insertar captura de pantalla de Prometheus en http://localhost:9090/alerts mostrando la alerta `MattermostServiceDown` o `MattermostHighBurnRateCritical` en estado rojo FIRING)*:
>
> `[ INSERTAR CAPTURA DE PANTALLA: Prometheus Alerts en estado FIRING ]`

---

## 5. Runbook Operativo (Manual Procedimental de Respuesta a Incidentes)

El documento completo de respuesta a incidentes se encuentra implementado en el repositorio en:
[`observability/runbooks/incident-response-runbook.md`](https://github.com/sespinosab/mattermost/blob/master/observability/runbooks/incident-response-runbook.md).

### Resumen del Flujo de Atención:
1. **Triage Inicial (0 a 3 minutos):**
   - Confirmar impacto en el panel Grafana y verificar alertas en Prometheus.
   - Ejecutar diagnóstico rápido: `docker ps | grep mattermost` y sondeo curl a `/api/v4/system/ping`.
2. **Diagnóstico Específico:**
   - Inspección de logs: `docker logs --tail 100 mattermost-app`.
   - Verificación de integridad de base de datos: `docker exec -it mattermost-db pg_isready`.
3. **Mitigación Rápida:**
   - Reinicio ordenado de servicios dependientes.
   - Liberación de conexiones zombis en PostgreSQL si existe agotamiento de pool.
4. **Verificación y Cierre:**
   - Confirmar retorno de código 200 en la API y retorno a estado inactivo de las alertas en Prometheus.

---

## 6. Enlaces del Proyecto

- **Repositorio de GitHub:** [https://github.com/sespinosab/mattermost](https://github.com/sespinosab/mattermost)
- **Directorio de Manifiestos de Monitoreo (`/observability`):**
  - Configuración Prometheus: [`/observability/prometheus/prometheus.yml`](https://github.com/sespinosab/mattermost/blob/master/observability/prometheus/prometheus.yml)
  - Reglas SLI/SLO: [`/observability/prometheus/rules/sli_slo_rules.yml`](https://github.com/sespinosab/mattermost/blob/master/observability/prometheus/rules/sli_slo_rules.yml)
  - Alertas Burn Rate: [`/observability/prometheus/rules/burn_rate_alerts.yml`](https://github.com/sespinosab/mattermost/blob/master/observability/prometheus/rules/burn_rate_alerts.yml)
  - Dashboard de Grafana JSON: [`/observability/grafana/dashboards/mattermost-sre-golden-signals.json`](https://github.com/sespinosab/mattermost/blob/master/observability/grafana/dashboards/mattermost-sre-golden-signals.json)
  - Runbook Operativo: [`/observability/runbooks/incident-response-runbook.md`](https://github.com/sespinosab/mattermost/blob/master/observability/runbooks/incident-response-runbook.md)