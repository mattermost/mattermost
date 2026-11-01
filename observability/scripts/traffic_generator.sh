#!/usr/bin/env bash
# ==============================================================================
# traffic_generator.sh: Genera tráfico HTTP nominal sobre Mattermost
# El blackbox-exporter sondea automáticamente el servicio; este script genera
# tráfico adicional directo para aumentar la señal visible en los dashboards.
#
# Uso: ./traffic_generator.sh [TARGET_URL] [DURATION_SECONDS] [REQ_PER_SECOND]
# Ejemplo: ./traffic_generator.sh http://localhost:8065 120 15
# ==============================================================================
set -euo pipefail

TARGET_URL="${1:-http://localhost:8065}"
DURATION_SECONDS="${2:-60}"
REQUESTS_PER_SECOND="${3:-10}"
SLEEP_INTERVAL=$(echo "scale=3; 1 / $REQUESTS_PER_SECOND" | bc 2>/dev/null || echo "0.1")

echo "=========================================================="
echo "Iniciando generador de tráfico nominal sobre Mattermost"
echo "Target: $TARGET_URL"
echo "Duración: ${DURATION_SECONDS}s | Tasa: ~${REQUESTS_PER_SECOND} req/s"
echo "Nota: El blackbox-exporter también genera sondas automáticas"
echo "=========================================================="

END_TIME=$((SECONDS + DURATION_SECONDS))

# Endpoints públicos de Mattermost (no requieren autenticación)
ENDPOINTS=(
  "/api/v4/system/ping"
  "/"
  "/api/v4/config/client?format=old"
  "/api/v4/license/client?format=old"
  "/login"
)

SUCCESS_COUNT=0
ERROR_COUNT=0
TOTAL=0

while [ $SECONDS -lt $END_TIME ]; do
  for endpoint in "${ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time 5 \
      --connect-timeout 3 \
      "$TARGET_URL$endpoint" 2>/dev/null || echo "000")

    TOTAL=$((TOTAL + 1))
    if [[ "$STATUS" =~ ^[23] ]]; then
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      ERROR_COUNT=$((ERROR_COUNT + 1))
      echo "  [WARN] $STATUS → $TARGET_URL$endpoint"
    fi
  done

  # Mostrar progreso cada 10 segundos
  ELAPSED=$((DURATION_SECONDS - (END_TIME - SECONDS)))
  if (( ELAPSED % 10 == 0 )) && (( ELAPSED > 0 )); then
    echo "  Progreso: ${ELAPSED}/${DURATION_SECONDS}s | OK=$SUCCESS_COUNT ERR=$ERROR_COUNT"
  fi

  sleep "$SLEEP_INTERVAL"
done

echo ""
echo "=== Resumen de Tráfico Nominal ==="
echo "Duración:             ${DURATION_SECONDS}s"
echo "Peticiones exitosas:  $SUCCESS_COUNT / $TOTAL"
echo "Peticiones con error: $ERROR_COUNT / $TOTAL"
RATE=$(echo "scale=1; $SUCCESS_COUNT * 100 / $TOTAL" | bc 2>/dev/null || echo "N/A")
echo "Tasa de éxito:        ${RATE}%"
echo "Tráfico completado exitosamente."
echo ""
echo "→ Abre Grafana en http://localhost:3000 para ver los datos."
