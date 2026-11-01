#!/usr/bin/env bash
# ==============================================================================
# simulate_incident.sh: Inyecta degradación y errores para disparar alertas SRE
# ==============================================================================
set -euo pipefail

TARGET_URL="${1:-http://localhost:8065}"
DURATION_SECONDS="${2:-45}"

echo "======================================================================"
echo "⚠️  INICIANDO SIMULACIÓN DE INCIDENTE Y DEGRADACIÓN DE ERROR BUDGET"
echo "Target: $TARGET_URL | Duración: ${DURATION_SECONDS}s"
echo "Objetivo: Generar ráfaga masiva de errores HTTP 4xx/5xx para superar"
echo "          el umbral de Burn Rate (>14.4x) y activar la alerta en Prometheus/Grafana"
echo "======================================================================"

END_TIME=$((SECONDS + DURATION_SECONDS))

FAILING_ENDPOINTS=(
  "/api/v4/channels/non-existent-channel-xyz/members"
  "/api/v4/users/fake-user-id-000000/teams"
  "/api/v4/posts/invalid-post-id-12345/thread"
  "/api/v4/system/logs"
  "/api/v4/teams/name/unknown-team-cluster"
)

ERROR_TOTAL=0

while [ $SECONDS -lt $END_TIME ]; do
  for endpoint in "${FAILING_ENDPOINTS[@]}"; do
    curl -s -X POST -H "Content-Type: application/json" -d '{"invalid":"data"}' -o /dev/null "$TARGET_URL$endpoint" &
    ((ERROR_TOTAL++))
  done
  sleep 0.1
done

wait
echo ""
echo "=== Simulación de Incidente Finalizada ==="
echo "Total de peticiones con error inyectadas: $ERROR_TOTAL"
echo "Revisa en Prometheus (http://localhost:9090/alerts) y en el panel Grafana (http://localhost:3000)"
echo "la activación de la regla: 'MattermostHighBurnRateCritical'."

