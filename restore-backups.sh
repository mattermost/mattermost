#!/bin/bash
# =============================================================================
# Script para restaurar backups SQL en las bases de datos locales
# =============================================================================
# Uso: ./restore-backups.sh [ruta_al_backup] [numero_bd]
#
# Ejemplos:
#   ./restore-backups.sh ~/Desktop/backup1.sql 1
#   ./restore-backups.sh ~/Desktop/backup2.sql 2
#   ./restore-backups.sh limpiar 3
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función de uso
usage() {
    echo -e "${BLUE}Uso:${NC}"
    echo "  ./restore-backups.sh [ruta_al_backup.sql] [numero_bd]"
    echo "  ./restore-backups.sh limpiar [numero_bd]"
    echo ""
    echo -e "${BLUE}Ejemplos:${NC}"
    echo "  ./restore-backups.sh ~/Desktop/backup1.sql 1   # Restaurar backup en BD 1"
    echo "  ./restore-backups.sh ~/Desktop/backup2.sql 2   # Restaurar backup en BD 2"
    echo "  ./restore-backups.sh limpiar 3                 # Dejar BD 3 limpia"
    echo ""
    echo -e "${BLUE}Bases de datos disponibles:${NC}"
    echo "  1 = mattermost_test_1"
    echo "  2 = mattermost_test_2"
    echo "  3 = mattermost_test_3 (limpia por defecto)"
    exit 1
}

# Validar argumentos
if [ $# -lt 2 ]; then
    usage
fi

BACKUP_PATH="$1"
DB_NUM="$2"

# Validar número de BD
if [[ ! "$DB_NUM" =~ ^[1-3]$ ]]; then
    echo -e "${RED}Error: El número de base de datos debe ser 1, 2 o 3${NC}"
    exit 1
fi

DB_NAME="mattermost_test_${DB_NUM}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Restaurando backup en ${DB_NAME}         ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verificar PostgreSQL
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${YELLOW}Iniciando PostgreSQL...${NC}"
    brew services start postgresql@11 || brew services start postgresql
    sleep 2
fi

# Detectar usuario de PostgreSQL
CURRENT_USER=$(whoami)
PG_USER=""

if psql -h localhost -p 5432 -U "$CURRENT_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    PG_USER="$CURRENT_USER"
else
    if psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        PG_USER="postgres"
    else
        echo -e "${RED}Error: No se pudo conectar a PostgreSQL${NC}"
        exit 1
    fi
fi

# Si es "limpiar", solo recreamos la BD vacía
if [ "$BACKUP_PATH" = "limpiar" ]; then
    echo -e "${YELLOW}Limpiando ${DB_NAME}...${NC}"

    # Terminar conexiones activas
    psql -h localhost -p 5432 -U "$PG_USER" -d postgres << EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${DB_NAME}'
AND pid <> pg_backend_pid();
EOF

    # Eliminar y recrear la BD
    psql -h localhost -p 5432 -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    psql -h localhost -p 5432 -U "$PG_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"

    # Otorgar permisos a mmuser
    psql -h localhost -p 5432 -U "$PG_USER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO mmuser;" 2>/dev/null || true

    echo -e "${GREEN}✓ ${DB_NAME} está ahora limpia${NC}"
    exit 0
fi

# Verificar que el archivo existe
if [ ! -f "$BACKUP_PATH" ]; then
    echo -e "${RED}Error: No se encontró el archivo: ${BACKUP_PATH}${NC}"
    exit 1
fi

echo -e "${YELLOW}Archivo de backup: ${BACKUP_PATH}${NC}"
echo -e "${YELLOW}Base de datos destino: ${DB_NAME}${NC}"
echo ""

# Confirmar
read -p "¿Estás seguro? Esto eliminará todos los datos actuales en ${DB_NAME}. [s/N]: " confirm
if [[ ! "$confirm" =~ ^[sS]$ ]]; then
    echo -e "${YELLOW}Operación cancelada${NC}"
    exit 0
fi

echo ""

# Terminar conexiones activas a la BD
echo -e "${YELLOW}Cerrando conexiones activas...${NC}"
psql -h localhost -p 5432 -U "$PG_USER" -d postgres << EOF > /dev/null 2>&1
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${DB_NAME}'
AND pid <> pg_backend_pid();
EOF

# Eliminar y recrear la BD
echo -e "${YELLOW}Recreando base de datos...${NC}"
psql -h localhost -p 5432 -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql -h localhost -p 5432 -U "$PG_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"

# Otorgar permisos a mmuser
psql -h localhost -p 5432 -U "$PG_USER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO mmuser;" 2>/dev/null || true

# Restaurar el backup
echo -e "${YELLOW}Restaurando backup (esto puede tardar)...${NC}"
psql -h localhost -p 5432 -U mmuser -d "${DB_NAME}" < "$BACKUP_PATH"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Backup restaurado exitosamente!          ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Base de datos: ${DB_NAME}"
echo "Backup: ${BACKUP_PATH}"
echo ""
echo "Ahora puedes iniciar Mattermost con:"
echo "  ./start-local.sh ${DB_NUM}"
