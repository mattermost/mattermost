# Pila de Observabilidad SRE — Mattermost

Este directorio contiene la implementación completa del **Marco Operativo de Site Reliability Engineering (SRE)** y la **Pila de Observabilidad** para la plataforma Mattermost, correspondiente al **Entregable # 3** del curso *Fundamentos de DevOps y SRE* (Universidad Nacional de Colombia, 2026-02).

---

## 1. Arquitectura de Observabilidad

La solución implementa una arquitectura desacoplada y robusta de recolección de telemetría y evaluación de compromisos de servicio (SLIs/SLOs):

```
                                  ┌──────────────────────────┐
                                  │   mattermost-app:8065    │
                                  │   (HTTP Core Engine)     │
                                  └─────────────▲────────────┘
                                                │ (Sondeos HTTP / REST API)
                                  ┌─────────────┴────────────┐
                                  │ mattermost-blackbox:9115 │
                                  │   (Blackbox Exporter)    │
                                  └─────────────▲────────────┘
                                                │ Scrape /probe
┌───────────────────────────────┐               │
│ mattermost-node-exporter:9100 │───────────────┤
│   (Host CPU / Mem / Disk)     │               │
└───────────────────────────────┘               │
┌───────────────────────────────┐               │
│ mattermost-cadvisor:8080      │───────────────┼────────► ┌───────────────────────────┐
│ (Docker Container Metrics)    │               │          │   mattermost-prometheus   │
└───────────────────────────────┘               │          │          (:9090)          │
┌───────────────────────────────┐               │          │  - TSDB Engine            │
│ mattermost-postgres-exporter  │───────────────┤          │  - Reglas SLI/SLO         │
│   (PostgreSQL :9187)          │               │          │  - Alertas Burn Rate      │
└───────────────────────────────┘               │          └─────────────┬─────────────┘
                                                                         │
                                                                         ▼
                                                           ┌───────────────────────────┐
                                                           │    mattermost-grafana     │
                                                           │          (:3000)          │
                                                           │ - SRE Golden Signals      │
                                                           │ - Estado de SLOs          │
                                                           │ - Saldo de Error Budget   │
                                                           └───────────────────────────┘
```

### Componentes y Servicios

| Contenedor / Servicio | Imagen | Puerto Host | Rol SRE / Función |
|---|---|---|---|
| `mattermost-blackbox` | `prom/blackbox-exporter:v0.25.0` | `9115` | Ejecuta sondas HTTP sintéticas hacia `/api/v4/system/ping` y `/` para medir disponibilidad y latencia sin depender de licencias Enterprise. |
| `mattermost-node-exporter` | `prom/node-exporter:v1.8.1` | `9100` | Expone telemetría a nivel de sistema operativo anfitrión (CPU, Memoria, I/O, Red). |
| `mattermost-cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | `8085` | Recolecta métricas de consumo de recursos por contenedor Docker (`image!=""`). |
| `mattermost-postgres-exporter` | `prometheuscommunity/postgres-exporter:v0.15.0` | `9187` | Recolecta métricas transaccionales y conexiones de PostgreSQL. |
| `mattermost-prometheus` | `prom/prometheus:v2.52.0` | `9090` | Servidor de métricas, evaluador de recording rules (SLIs/Error Budget) y motor de alertas. |
| `mattermost-grafana` | `grafana/grafana:10.4.2` | `3000` | Tablero de visualización interactivo provisto automáticamente con datasource y dashboard SRE. |

---

## 2. Marco SRE: Definición de SLIs, SLOs y Error Budget

### 2.1 SLI 1: Disponibilidad del Servicio (Availability SLI)
- **Definición Conceptual:** Proporción de revisiones de salud exitosas (HTTP 2xx) sobre el total de sondeos sintéticos realizados por el blackbox exporter.
- **Formulación Matemática:**
  $$\text{SLI}_{\text{disp}} = \frac{\sum \text{Sondeos HTTP Exitosos (200 OK)}}{\sum \text{Sondeos HTTP Totales}}$$
- **Expresión PromQL:**
  ```promql
  job:mattermost_availability:sli5m = avg_over_time(probe_success{job="blackbox_http_mattermost"}[5m])
  ```
- **SLO Objetivo:** **99.5% de disponibilidad** medido en una ventana móvil de 30 días.

### 2.2 SLI 2: Rendimiento / Latencia HTTP P95 (Latency SLI)
- **Definición Conceptual:** Tiempo transcurrido para completar una petición HTTP exitosa en el percentil 95 ($P_{95}$).
- **Formulación Matemática:**
  $$P_{95} = \inf \{ t \in \mathbb{R} : P(\text{Latencia} \le t) \ge 0.95 \}$$
- **Expresión PromQL:**
  ```promql
  job:mattermost_latency_p95:seconds5m = histogram_quantile(0.95, rate(probe_duration_seconds_bucket{job="blackbox_http_api"}[5m]))
  ```
- **SLO Objetivo:** **95% de las peticiones atendidas en menos de 250 ms** ($t \le 0.250\text{ s}$).

### 2.3 Error Budget (Presupuesto de Error)
- **Presupuesto Total:** $100\% - 99.5\% = 0.5\%$ de margen de fallo permitido en 30 días.
- **Saldo en Tiempo Real:**
  ```promql
  job:mattermost_error_budget_remaining:percent = clamp_max(clamp_min(((job:mattermost_availability:sli30m - 0.995) / (1 - 0.995)) * 100, 0), 100)
  ```

---

## 3. Política de Error Budget (Error Budget Policy)

| Estado del Saldo | Burn Rate Asociado | Consecuencia y Acuerdo Operativo |
|---|---|---|
| **Verde (> 50%)** | Normal ($\le 1.0\times$) | Ritmo estándar: Despliegues continuos permitidos. Innovación y nuevas características prioritarias. |
| **Amarillo (20% – 50%)** | Elevado ($1.0\times - 6.0\times$) | Alerta al equipo: Se requiere revisión del backlog. Los despliegues a producción exigen aprobación manual y pruebas exhaustivas. |
| **Naranja (1% – 20%)** | Acelerado ($> 6.0\times$) | Pre-congelamiento: Se pausan despliegues de features de bajo impacto. El 50% de la capacidad de ingeniería se enfoca en estabilidad y deuda técnica. |
| **Rojo (0% - Agotado)** | Crítico ($> 14.4\times$) | **Feature Freeze Total**: Congelamiento estricto de despliegues. Todo el equipo atiende confiabilidad, refactorización y resolución de causa raíz. |

---

## 4. Instrucciones de Despliegue y Operación

### 4.1 Requisitos Previos
Asegurarse de que el stack principal de Mattermost esté en ejecución y compartiendo la red `mattermost_mattermost_network`:
```bash
docker compose up -d
```

### 4.2 Despliegue del Stack de Monitoreo
Desde la raíz del repositorio:
```bash
docker compose -f observability/docker-compose.monitoring.yml up -d
```

### 4.3 Verificación de Salud de Targets
```bash
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data.get('data', {}).get('activeTargets', []):
    print(f\"[{t['health'].upper()}] Job: {t['labels'].get('job')} | URL: {t['scrapeUrl']}\")
"
```

### 4.4 Acceso a las Interfaces
- **Grafana:** [http://localhost:3000](http://localhost:3000) (Usuario: `admin` | Password: `admin`)
  - Dashboard aprovisionado: **Mattermost SRE — Golden Signals & SLOs** (`UID: mattermost-sre-overview`).
- **Prometheus:** [http://localhost:9090](http://localhost:9090)
  - Alertas activas: [http://localhost:9090/alerts](http://localhost:9090/alerts)

---

## 5. Simulación y Pruebas de Carga

### Generar Tráfico Nominal (Evidencia de Dashboard en Verde)
```bash
./observability/scripts/traffic_generator.sh http://localhost:8065 120 15
```

### Simular Incidentes para Disparar Alertas SRE
El script `simulate_incident.sh` soporta 3 escenarios con restauración automática:
```bash
# 1. Caída del servicio (Activa MattermostServiceDown y MattermostHighBurnRateCritical)
./observability/scripts/simulate_incident.sh service-down 120

# 2. Caída de base de datos (Activa MattermostDatabaseDown)
./observability/scripts/simulate_incident.sh db-down 90

# 3. Saturación de CPU en contenedor
./observability/scripts/simulate_incident.sh high-load 120
```

---

## 6. Estructura de Directorios

```
observability/
├── README.md                                          # Guía técnica principal
├── docker-compose.monitoring.yml                      # Manifiesto de servicios de monitoreo
├── blackbox/
│   └── config.yml                                     # Configuración de módulos HTTP/TCP de sondeo
├── prometheus/
│   ├── prometheus.yml                                 # Configuración global y scrape jobs
│   └── rules/
│       ├── sli_slo_rules.yml                          # Reglas de cálculo de SLIs y Error Budget
│       └── burn_rate_alerts.yml                       # Alertas de consumo de Error Budget
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/datasource.yml                 # Conexión automática con Prometheus
│   │   └── dashboards/dashboards.yml                  # Proveedor de dashboards
│   └── dashboards/
│       └── mattermost-sre-golden-signals.json         # Dashboard oficial de los 4 Golden Signals
├── runbooks/
│   └── incident-response-runbook.md                   # Procedimiento operativo estándar de mitigación
└── scripts/
    ├── traffic_generator.sh                           # Generador de tráfico nominal
    └── simulate_incident.sh                           # Inyector de incidentes y fallos
```
