#!/bin/bash
# =============================================================================
# Script para compilar solo el frontend (webapp)
# =============================================================================

echo "Compilando frontend..."
cd webapp

# Instalar dependencias (si no están instaladas)
npm install --legacy-peer-deps

# Compilar para producción
npm run build

echo "✓ Frontend compilado en webapp/channels/dist/"
echo ""
echo "Para copiarlo al directorio de distribución:"
echo "  rm -rf dist/client/*"
echo "  cp -r webapp/channels/dist/* dist/client/"
