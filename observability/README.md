# Guía de la Pila de Observabilidad y Marco SRE (Entrega #3)

Esta carpeta contiene la implementación completa del marco de Site Reliability Engineering (SRE) y la pila de observabilidad para **Mattermost Team Edition**.

---

## 📁 Estructura del Directorio

```
observability/
├── README.md                          # Este documento
├── docker-compose.monitoring.yml      # Stack de Prometheus, Grafana, Postgres-Exporter y cAdvisor
├── prometheus/
│   ├── prometheus.yml                 # Targets de scrape y scraping intervals
│   └── rules/
│       ├── sli_slo_rules.yml          # Reglas de cálculo de SLIs, SLOs y Error Budget
│       └── burn_rate_alerts.yml       # Reglas de alerta Multi-Window Multi-Burn-Rate (SRE)
├── grafana/
│   ├── provisioning/                  # Aprovisionamiento automatizado de datasources y dashboards
│   │   ├── datasources/datasource.yml
│   │   └── dashboards/dashboards.yml
│   └── dashboards/
│       └── mattermost-sre-golden-signals.json # Dashboard JSON con los 4 Golden Signals + SLOs
├── runbooks/
│   └── incident-response-runbook.md   # Procedimiento operativo de respuesta a incidentes
└── scripts/
    ├── traffic_generator.sh           # Generador de tráfico nominal continuo
    └── simulate_incident.sh           # Generador de degradación y consumo acelerado de Error Budget
```

---

## 🚀 Despliegue Rápido de la Pila

### 1. Iniciar la aplicación Mattermost (si no está arriba)
```bash
cd /home/sexdeg/Proyectos/mattermost
docker compose up -d
```

### 2. Iniciar la pila de Observabilidad (Prometheus + Grafana + Exporters)
```bash
docker compose -f observability/docker-compose.monitoring.yml up -d
```

### 3. Verificar estado de los servicios
```bash
docker compose -f observability/docker-compose.monitoring.yml ps
```

---

## 🌐 URLs de Acceso

| Servicio | URL Local | Credenciales por Defecto |
| :--- | :--- | :--- |
| **Grafana** | `http://localhost:3000` | Usuario: `admin` \| Contraseña: `admin` |
| **Prometheus** | `http://localhost:9090` | Sin autenticación |
| **Alertas Prometheus** | `http://localhost:9090/alerts` | Sin autenticación |
| **Métricas Mattermost** | `http://localhost:8067/metrics` | Endpoint público |
| **cAdvisor** | `http://localhost:8080` | Métricas de contenedores |

---

## 🧪 Pruebas y Evidencias para el Informe

### 1. Generar tráfico nominal (evidencia con carga normal)
```bash
./observability/scripts/traffic_generator.sh http://localhost:8065 120 15
```
*Abre Grafana (`http://localhost:3000`), visualiza el incremento en el panel de tráfico (req/s), latencia y el gauge de Error Budget al 100%.*

### 2. Simular degradación para disparar alertas (evidencia de alerta activa)
```bash
./observability/scripts/simulate_incident.sh http://localhost:8065 60
```
*Abre Prometheus Alerts (`http://localhost:9090/alerts`) y Grafana: verás la alerta `MattermostHighBurnRateCritical` pasando a estado **FIRING** y el consumo del presupuesto de error.*

