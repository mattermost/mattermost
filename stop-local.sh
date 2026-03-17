#!/bin/bash
# =============================================================================
# Script para detener Mattermost
# =============================================================================

echo "Deteniendo Mattermost..."

MATTERMOST_PID=$(pgrep -f "dist/mattermost" || true)

if [ -n "$MATTERMOST_PID" ]; then
    kill "$MATTERMOST_PID" 2>/dev/null || true
    sleep 2

    # Verificar si sigue corriendo
    if pgrep -q "${MATTERMOST_PID}"; then
        echo "Forzando cierre..."
        kill -9 "$MATTERMOST_PID" 2>/dev/null || true
    fi

    echo "✓ Mattermost detenido"
else
    echo "Mattermost no está corriendo"
fi
