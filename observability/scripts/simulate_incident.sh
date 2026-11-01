#!/usr/bin/env bash
# ==============================================================================
# simulate_incident.sh — Simula incidentes para disparar alertas SRE
#
# Escenarios disponibles:
#   1) service-down  → Detiene el contenedor de Mattermost (alerta CRITICAL)
#   2) db-down       → Detiene PostgreSQL (alerta DB DOWN + eventual service-down)
#   3) high-load     → Consume CPU/memoria en el contenedor (alerta de saturación)
#
# Uso:
#   ./simulate_incident.sh service-down [DURATION_SECONDS]
#   ./simulate_incident.sh db-down [DURATION_SECONDS]
#   ./simulate_incident.sh high-load [DURATION_SECONDS]
#
# Después del DURATION, el script restaura automáticamente el servicio.
# ==============================================================================
set -euo pipefail

SCENARIO="${1:-service-down}"
DURATION="${2:-120}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${RED}======================================================================"
echo "⚠️  SIMULACIÓN DE INCIDENTE SRE"
echo "======================================================================"
echo -e "Escenario:  ${YELLOW}${SCENARIO}${RED}"
echo -e "Duración:   ${YELLOW}${DURATION}s${RED} (se restaura automáticamente)"
echo -e "======================================================================${NC}"
echo ""

case "$SCENARIO" in
  service-down)
    echo -e "${YELLOW}[1/3] Deteniendo contenedor mattermost-app...${NC}"
    docker stop mattermost-app
    echo -e "${RED}[2/3] Mattermost DETENIDO. Blackbox probe reportará probe_success=0${NC}"
    echo ""
    echo "  → Abre Grafana:       http://localhost:3000"
    echo "  → Panel 'Estado del Servicio' cambiará a DOWN ❌"
    echo "  → Panel 'SLI Disponibilidad' caerá por debajo de 99.5%"
    echo "  → Panel 'Error Budget' comenzará a consumirse"
    echo ""
    echo "  → En Prometheus:      http://localhost:9090/alerts"
    echo "  → Alerta:             MattermostServiceDown → PENDING → FIRING"
    echo "  → Alerta:             MattermostHighBurnRateCritical → FIRING (tras 2min)"
    echo ""
    echo -e "${YELLOW}Esperando ${DURATION}s para restaurar...${NC}"
    sleep "$DURATION"
    echo ""
    echo -e "${GREEN}[3/3] Restaurando mattermost-app...${NC}"
    docker start mattermost-app
    echo -e "${GREEN}✅ Mattermost restaurado. Las métricas se recuperarán en ~30s.${NC}"
    ;;

  db-down)
    echo -e "${YELLOW}[1/3] Deteniendo contenedor mattermost-db...${NC}"
    docker stop mattermost-db
    echo -e "${RED}[2/3] PostgreSQL DETENIDO. Mattermost comenzará a fallar.${NC}"
    echo ""
    echo "  → Panel 'Estado de PostgreSQL' cambiará a DOWN"
    echo "  → Alerta: MattermostDatabaseDown → FIRING (tras 30s)"
    echo "  → Mattermost degradará gradualmente y eventualmente fallará"
    echo ""
    echo -e "${YELLOW}Esperando ${DURATION}s para restaurar...${NC}"
    sleep "$DURATION"
    echo ""
    echo -e "${GREEN}[3/3] Restaurando mattermost-db...${NC}"
    docker start mattermost-db
    echo -e "${GREEN}✅ PostgreSQL restaurado.${NC}"
    ;;

  high-load)
    echo -e "${YELLOW}[1/3] Inyectando carga de CPU en mattermost-app...${NC}"
    # Lanza un proceso de estrés dentro del contenedor
    docker exec -d mattermost-app sh -c '
      # Consume CPU con cálculos en paralelo
      for i in 1 2 3 4; do
        while true; do :; done &
      done
      # Consume memoria asignando bloques
      dd if=/dev/zero of=/dev/null bs=1M count=500 2>/dev/null &
    '
    echo -e "${RED}[2/3] Carga de CPU inyectada en mattermost-app (4 procesos busy-loop)${NC}"
    echo ""
    echo "  → Panel 'CPU por Contenedor' se elevará significativamente"
    echo "  → Panel 'Saturación: CPU y Memoria del Host' subirá"
    echo "  → Si supera 85%, alerta: HostHighCPUUsage → FIRING (tras 5min)"
    echo ""
    echo -e "${YELLOW}Esperando ${DURATION}s para restaurar...${NC}"
    sleep "$DURATION"
    echo ""
    echo -e "${GREEN}[3/3] Matando procesos de estrés en mattermost-app...${NC}"
    docker exec mattermost-app sh -c 'kill $(jobs -p) 2>/dev/null; pkill -f "while true; do :; done" 2>/dev/null' || true
    # Restart más limpio
    docker restart mattermost-app
    echo -e "${GREEN}✅ Carga removida. Las métricas se normalizarán en ~1min.${NC}"
    ;;

  *)
    echo "Escenario desconocido: $SCENARIO"
    echo ""
    echo "Escenarios disponibles:"
    echo "  service-down  — Detiene Mattermost (dispara MattermostServiceDown + BurnRate)"
    echo "  db-down       — Detiene PostgreSQL (dispara MattermostDatabaseDown)"
    echo "  high-load     — Inyecta carga CPU (dispara HostHighCPUUsage)"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}======================================================================"
echo "✅ SIMULACIÓN COMPLETADA"
echo "======================================================================${NC}"
echo ""
echo "Verifica la recuperación en:"
echo "  → Grafana:    http://localhost:3000"
echo "  → Prometheus: http://localhost:9090/alerts"
echo "  → Targets:    http://localhost:9090/targets"
