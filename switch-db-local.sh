#!/bin/bash
# =============================================================================
# Script para cambiar rápidamente entre bases de datos locales
# Mata el proceso actual de Mattermost y lo reinicia con otra BD
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Error: Debes especificar el número de base de datos (1, 2 o 3)${NC}"
    echo "Uso: ./switch-db-local.sh [1|2|3]"
    exit 1
fi

DB_NUM=$1

if [[ ! "$DB_NUM" =~ ^[1-3]$ ]]; then
    echo -e "${RED}Error: El número de base de datos debe ser 1, 2 o 3${NC}"
    exit 1
fi

DB_NAME="mattermost_test_${DB_NUM}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Cambiando a ${DB_NAME}                   ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Buscar y matar proceso de Mattermost si está corriendo
MATTERMOST_PID=$(pgrep -f "dist/mattermost" || true)

if [ -n "$MATTERMOST_PID" ]; then
    echo -e "${YELLOW}Deteniendo Mattermost (PID: ${MATTERMOST_PID})...${NC}"
    kill "$MATTERMOST_PID" 2>/dev/null || true
    sleep 2
    echo -e "  ${GREEN}✓ Mattermost detenido${NC}"
else
    echo -e "${YELLOW}Mattermost no estaba corriendo${NC}"
fi

echo ""

# Iniciar con la nueva BD
echo -e "${GREEN}Iniciando Mattermost con ${DB_NAME}...${NC}"
exec ./start-local.sh "$DB_NUM"
