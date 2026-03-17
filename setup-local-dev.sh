#!/bin/bash
# =============================================================================
# Script para configurar Mattermost completamente local (sin Docker)
# =============================================================================
# Requisitos:
#   - Go 1.21+ instalado
#   - Node 20.11+ instalado
#   - PostgreSQL (brew) instalado y corriendo
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Setup Mattermost Local (sin Docker)      ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verificar requisitos
echo -e "${YELLOW}Verificando requisitos...${NC}"

# Go
if ! command -v go &> /dev/null; then
    echo -e "${RED}Error: Go no está instalado${NC}"
    echo "Instálalo con: brew install go@1.21"
    exit 1
fi
GO_VERSION=$(go version | grep -o 'go[0-9]\+\.[0-9]\+' | head -1)
echo -e "  ${GREEN}✓ Go: ${GO_VERSION}${NC}"

# Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node no está instalado${NC}"
    echo "Instálalo con: brew install node@20"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "  ${GREEN}✓ Node: ${NODE_VERSION}${NC}"

# npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm no está instalado${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ npm: $(npm --version)${NC}"

# PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: PostgreSQL no está instalado${NC}"
    echo "Instálalo con: brew install postgresql@11"
    exit 1
fi

# Verificar PostgreSQL corriendo
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${YELLOW}PostgreSQL no está corriendo. Intentando iniciarlo...${NC}"
    brew services start postgresql@11 || brew services start postgresql
    sleep 3

    if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "${RED}Error: No se pudo iniciar PostgreSQL${NC}"
        echo "Intenta manualmente: brew services start postgresql@11"
        exit 1
    fi
fi
echo -e "  ${GREEN}✓ PostgreSQL: corriendo en localhost:5432${NC}"

echo ""
echo -e "${YELLOW}Todos los requisitos cumplidos ✓${NC}"
echo ""

# =============================================================================
# Crear bases de datos
# =============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Configurando bases de datos...           ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Detectar usuario de PostgreSQL
CURRENT_USER=$(whoami)
PG_USER=""

if psql -h localhost -p 5432 -U "$CURRENT_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    PG_USER="$CURRENT_USER"
    echo -e "  ${GREEN}✓ Usando usuario PostgreSQL: ${PG_USER}${NC}"
else
    if psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        PG_USER="postgres"
        echo -e "  ${GREEN}✓ Usando usuario PostgreSQL: ${PG_USER}${NC}"
    else
        echo -e "${RED}Error: No se pudo conectar a PostgreSQL${NC}"
        echo "Verifica que PostgreSQL esté configurado correctamente."
        echo ""
        echo "Puedes intentar manualmente:"
        echo "  psql -h localhost -p 5432 -U $(whoami) -d postgres"
        exit 1
    fi
fi

# Crear usuario mmuser si no existe
echo -e "${YELLOW}Creando usuario 'mmuser'...${NC}"
psql -h localhost -p 5432 -U "$PG_USER" -d postgres << EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mmuser') THEN
        CREATE ROLE mmuser WITH LOGIN PASSWORD 'mostest';
    END IF;
END
\$\$;

ALTER ROLE mmuser WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE postgres TO mmuser;
EOF

echo -e "  ${GREEN}✓ Usuario 'mmuser' listo${NC}"

# Crear las 3 bases de datos
for i in 1 2 3; do
    DB_NAME="mattermost_test_${i}"

    if psql -h localhost -p 5432 -U "$PG_USER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
        echo -e "  ${YELLOW}BD '${DB_NAME}' ya existe${NC}"
    else
        psql -h localhost -p 5432 -U "$PG_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"
        echo -e "  ${GREEN}✓ BD '${DB_NAME}' creada${NC}"
    fi

    psql -h localhost -p 5432 -U "$PG_USER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO mmuser;" > /dev/null 2>&1 || true
done

echo ""

# =============================================================================
# Compilar Mattermost
# =============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Compilando Mattermost...                 ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Crear directorio para binarios
mkdir -p bin

# Compilar webapp
echo -e "${YELLOW}Compilando webapp (esto puede tardar varios minutos)...${NC}"
cd webapp
npm install --legacy-peer-deps
npm run build
cd ..
echo -e "  ${GREEN}✓ Webapp compilado${NC}"

# Compilar servidor
echo -e "${YELLOW}Compilando servidor Go...${NC}"
cd server
export CGO_ENABLED=1
export GOOS=darwin
export GOARCH=amd64

# Ruta CORRECTA del main de Mattermost
go build -o ../bin/mattermost \
    -ldflags "-X 'github.com/mattermost/mattermost/server/v8/model.BuildNumber=dev' \
    -X 'github.com/mattermost/mattermost/server/v8/model.BuildDate=$(date -u +%Y%m%d)' \
    -X 'github.com/mattermost/mattermost/server/v8/model.BuildHash=dev'" \
    ./cmd/mattermost

cd ..
echo -e "  ${GREEN}✓ Servidor compilado: bin/mattermost${NC}"

# Crear estructura de directorios necesaria
echo -e "${YELLOW}Creando estructura de directorios...${NC}"
mkdir -p dist/config
mkdir -p dist/logs
mkdir -p dist/data/files
mkdir -p dist/plugins
mkdir -p dist/client
mkdir -p dist/i18n
mkdir -p dist/templates

# Copiar archivos necesarios
cp -r server/config/config.json dist/config/ 2>/dev/null || true
cp -r server/i18n/* dist/i18n/ 2>/dev/null || true
cp -r server/templates/* dist/templates/ 2>/dev/null || true
cp -r webapp/channels/dist/* dist/client/ 2>/dev/null || true
cp bin/mattermost dist/

echo -e "  ${GREEN}✓ Estructura creada en directorio 'dist/'${NC}"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup completado exitosamente!           ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Para iniciar Mattermost:"
echo "  ./start-local.sh [1|2|3]"
echo ""
echo "Para restaurar backups:"
echo "  ./restore-backups.sh ~/Desktop/backup1.sql 1"
echo ""
echo "Ejemplos:"
echo "  ./start-local.sh 1   # Usar mattermost_test_1"
echo "  ./start-local.sh 2   # Usar mattermost_test_2"
echo "  ./start-local.sh 3   # Usar mattermost_test_3"
echo ""
