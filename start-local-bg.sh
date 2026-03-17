#!/bin/bash
# =============================================================================
# Script para iniciar Mattermost en segundo plano y abrir navegador
# Uso: ./start-local-bg.sh [1|2|3]
# =============================================================================

# Default a BD 1 si no se especifica
DB_NUM=${1:-1}

if [[ ! "$DB_NUM" =~ ^[1-3]$ ]]; then
    echo "Error: El número de base de datos debe ser 1, 2 o 3"
    echo "Uso: ./start-local-bg.sh [1|2|3]"
    exit 1
fi

DB_NAME="mattermost_test_${DB_NUM}"

echo "============================================"
echo "  Iniciando Mattermost en segundo plano"
echo "  Base de datos: ${DB_NAME}"
echo "============================================"
echo ""

# Verificar que existe el binario
if [ ! -f "dist/mattermost" ]; then
    echo "Error: No se encontró dist/mattermost"
    echo "Ejecuta primero: ./setup-local-dev.sh"
    exit 1
fi

# Verificar directorios necesarios
if [ ! -d "dist/i18n" ]; then
    echo "Creando directorio i18n..."
    mkdir -p dist/i18n
    cp -r server/i18n/* dist/i18n/ 2>/dev/null || echo "Advertencia: No se pudieron copiar archivos i18n"
fi

if [ ! -d "dist/templates" ]; then
    echo "Creando directorio templates..."
    mkdir -p dist/templates
    cp -r server/templates/* dist/templates/ 2>/dev/null || echo "Advertencia: No se pudieron copiar templates"
fi

if [ ! -d "dist/client" ]; then
    echo "Copiando client..."
    mkdir -p dist/client
    cp -r webapp/channels/dist/* dist/client/ 2>/dev/null || echo "Advertencia: No se pudo copiar client"
fi

# Verificar PostgreSQL
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "Iniciando PostgreSQL..."
    brew services start postgresql@11 || brew services start postgresql
    sleep 2
fi

# Verificar si Mattermost ya está corriendo
MATTERMOST_PID=$(pgrep -f "dist/mattermost" || true)
if [ -n "$MATTERMOST_PID" ]; then
    echo "Mattermost ya está corriendo (PID: ${MATTERMOST_PID})"
    echo "Abriendo http://localhost:8065 ..."
    open http://localhost:8065
    exit 0
fi

# Exportar variables de entorno
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

# Iniciar en segundo plano
cd dist
nohup ./mattermost > ../mattermost.log 2>&1 &
MATTERMOST_PID=$!
cd ..

echo "Mattermost iniciado en segundo plano (PID: ${MATTERMOST_PID})"
echo ""
echo "Esperando a que el servidor esté listo..."
sleep 5

# Verificar que está corriendo
if pgrep -q "${MATTERMOST_PID}"; then
    echo "✓ Servidor listo!"
    echo ""
    echo "Abriendo navegador en http://localhost:8065 ..."
    open http://localhost:8065
    echo ""
    echo "Comandos útiles:"
    echo "  Ver logs:    tail -f mattermost.log"
    echo "  Detener:     ./stop-local.sh"
    echo "  Cambiar BD:  ./switch-db-local.sh [1|2|3]"
else
    echo "✗ Error: El servidor no se inició correctamente"
    echo "Verifica los logs: cat mattermost.log"
    exit 1
fi
