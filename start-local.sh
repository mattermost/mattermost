#!/bin/bash
# =============================================================================
# Script para iniciar Mattermost local con base de datos específica
# Uso: ./start-local.sh [1|2|3]
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default a BD 1 si no se especifica
DB_NUM=${1:-1}

if [[ ! "$DB_NUM" =~ ^[1-3]$ ]]; then
    echo -e "${RED}Error: El número de base de datos debe ser 1, 2 o 3${NC}"
    echo "Uso: ./start-local.sh [1|2|3]"
    exit 1
fi

DB_NAME="mattermost_test_${DB_NUM}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Iniciando Mattermost                    ${NC}"
echo -e "${BLUE}  Base de datos: ${DB_NAME}                ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verificar que existe el binario
if [ ! -f "dist/mattermost" ]; then
    echo -e "${RED}Error: No se encontró dist/mattermost${NC}"
    echo "Ejecuta primero: ./setup-local-dev.sh"
    exit 1
fi

# Verificar directorios necesarios
if [ ! -d "dist/i18n" ]; then
    echo -e "${YELLOW}Creando directorio i18n...${NC}"
    mkdir -p dist/i18n
    cp -r server/i18n/* dist/i18n/ 2>/dev/null || echo -e "${YELLOW}Advertencia: No se pudieron copiar archivos i18n${NC}"
fi

if [ ! -d "dist/templates" ]; then
    echo -e "${YELLOW}Creando directorio templates...${NC}"
    mkdir -p dist/templates
    cp -r server/templates/* dist/templates/ 2>/dev/null || echo -e "${YELLOW}Advertencia: No se pudieron copiar templates${NC}"
fi

if [ ! -d "dist/client" ]; then
    echo -e "${YELLOW}Copiando client...${NC}"
    mkdir -p dist/client
    cp -r webapp/channels/dist/* dist/client/ 2>/dev/null || echo -e "${YELLOW}Advertencia: No se pudo copiar client${NC}"
fi

# Verificar PostgreSQL
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo -e "${YELLOW}Iniciando PostgreSQL...${NC}"
    brew services start postgresql@11 || brew services start postgresql
    sleep 2
fi

# Exportar variables de entorno para Mattermost
export MM_SQLSETTINGS_DRIVERNAME=postgres
export MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@localhost:5432/${DB_NAME}?sslmode=disable&connect_timeout=10"
export MM_SERVICESETTINGS_LISTENADDRESS=:8065
export MM_SERVICESETTINGS_SITEURL=http://localhost:8065
export MM_LOGSETTINGS_ENABLECONSOLE=true
export MM_LOGSETTINGS_CONSOLELEVEL=INFO
export MM_FILESETTINGS_DRIVERNAME=local
export MM_FILESETTINGS_DIRECTORY=./dist/data/files
export MM_LOGSETTINGS_ENABLEDIAGNOSTICS=false
export MM_SERVICESETTINGS_ENABLESECURITYFIXALERT=false

# Importante: Establecer el directorio de trabajo donde está mattermost
cd dist

echo -e "${GREEN}Mattermost iniciando en http://localhost:8065${NC}"
echo -e "${YELLOW}Presiona Ctrl+C para detener${NC}"
echo ""

# Iniciar Mattermost
exec ./mattermost
