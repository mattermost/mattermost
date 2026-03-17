# Documentación: Scripts de Setup para Mattermost Local

Este documento explica el propósito de cada script, las decisiones tomadas y el flujo de trabajo completo.

---

## Resumen de Scripts

| Script | Propósito |
|--------|-----------|
| `setup-local-dev.sh` | Configuración inicial completa |
| `start-local.sh` | Inicia Mattermost en primer plano |
| `start-local-bg.sh` | Inicia Mattermost en segundo plano y abre navegador |
| `stop-local.sh` | Detiene Mattermost |
| `switch-db-local.sh` | Cambia entre bases de datos rápidamente |
| `restore-backups.sh` | Restaura backups SQL en una BD específica |
| `build-frontend.sh` | Compila solo el frontend |

---

## 1. setup-local-dev.sh

### Propósito
Script de configuración inicial que prepara todo el entorno de desarrollo local.

### Decisiones de Diseño

#### ¿Por qué verificar requisitos primero?
```bash
# Verificar Go, Node, npm, PostgreSQL
```
**Decisión:** Fallar rápido si falta alguna dependencia en lugar de fallar a mitad del proceso.

#### ¿Por qué detectar usuario de PostgreSQL automáticamente?
```bash
CURRENT_USER=$(whoami)
if psql -h localhost -p 5432 -U "$CURRENT_USER" ...
```
**Decisión:** PostgreSQL en Mac puede usar el usuario del sistema o 'postgres'. El script intenta ambos para no depender de una configuración específica.

#### ¿Por qué crear el usuario 'mmuser'?
```bash
CREATE ROLE mmuser WITH LOGIN PASSWORD 'mostest';
```
**Decisión:** Mattermost necesita un usuario dedicado con permisos específicos. Usar 'mostest' como password mantiene consistencia con la configuración de desarrollo de Mattermost.

#### ¿Por qué 3 bases de datos?
```bash
for i in 1 2 3; do
    DB_NAME="mattermost_test_${i}"
```
**Decisión:** Permite probar diferentes escenarios:
- BD 1: Backup de producción A
- BD 2: Backup de producción B
- BD 3: Instalación limpia

#### ¿Por qué compilar webapp antes que servidor?
```bash
cd webapp && npm install && npm run build
cd server && go build ...
```
**Decisión:** El servidor copia los archivos del webapp compilado. Si se compila el servidor primero, los archivos del webapp no estarán listos.

#### ¿Por qué crear directorio `dist/`?
```bash
mkdir -p dist/config dist/logs dist/data/files dist/plugins dist/client dist/i18n dist/templates
```
**Decisión:** Mattermost espera una estructura específica de directorios. Al crear un directorio `dist/` separado, mantenemos el código fuente limpio y tenemos una instalación portable.

---

## 2. start-local.sh

### Propósito
Inicia Mattermost con una base de datos específica en primer plano.

### Decisiones de Diseño

#### ¿Por qué verificar directorios antes de iniciar?
```bash
if [ ! -d "dist/i18n" ]; then
    cp -r server/i18n/* dist/i18n/
```
**Decisión:** Si alguien borra accidentalmente el directorio `dist/`, el script se recupera automáticamente copiando los archivos necesarios.

#### ¿Por qué variables de entorno en lugar de config file?
```bash
export MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@localhost:5432/..."
```
**Decisión:** Las variables de entorno permiten cambiar la configuración sin modificar archivos. Esto facilita el switch entre BDs.

#### ¿Por qué `cd dist` antes de ejecutar?
```bash
cd dist
exec ./mattermost
```
**Decisión:** Mattermost busca archivos (i18n, templates) relativos a su directorio de ejecución. Ejecutar desde `dist/` asegura que encuentre todo.

#### ¿Por qué `exec`?
```bash
exec ./mattermost
```
**Decisión:** Reemplaza el proceso del script con Mattermost, permitiendo que Ctrl+C funcione directamente.

---

## 3. start-local-bg.sh

### Propósito
Inicia Mattermost en segundo plano y abre automáticamente el navegador.

### Decisiones de Diseño

#### ¿Por qué segundo plano?
```bash
nohup ./mattermost > ../mattermost.log 2>&1 &
```
**Decisión:** Libera la terminal para otros comandos y permite trabajar en el mismo terminal después de iniciar.

#### ¿Por qué `nohup`?
```bash
nohup ./mattermost ...
```
**Decisión:** Evita que el proceso se detenga cuando se cierra la terminal.

#### ¿Por qué verificar si ya está corriendo?
```bash
MATTERMOST_PID=$(pgrep -f "dist/mattermost" || true)
if [ -n "$MATTERMOST_PID" ]; then
    echo "Mattermost ya está corriendo"
```
**Decisión:** Evita iniciar múltiples instancias que causarían conflictos de puerto.

#### ¿Por qué `open`?
```bash
open http://localhost:8065
```
**Decisión:** Abre automáticamente el navegador predeterminado del Mac, ahorrando tiempo al usuario.

#### ¿Por qué sleep 5?
```bash
echo "Esperando a que el servidor esté listo..."
sleep 5
```
**Decisión:** Da tiempo a Mattermost para inicializarse antes de abrir el navegador. Evita mostrar "página no encontrada".

---

## 4. stop-local.sh

### Propósito
Detiene la instancia de Mattermost de forma segura.

### Decisiones de Diseño

#### ¿Por qué buscar por nombre de proceso?
```bash
MATTERMOST_PID=$(pgrep -f "dist/mattermost" || true)
```
**Decisión:** No necesitamos guardar el PID en un archivo. Buscamos el proceso directamente.

#### ¿Por qué intentar kill -9?
```bash
kill "$MATTERMOST_PID"
sleep 2
if pgrep -q "${MATTERMOST_PID}"; then
    kill -9 "$MATTERMOST_PID"
```
**Decisión:** Primero intenta un cierre graceful (SIGTERM), si no funciona, fuerza el cierre (SIGKILL).

---

## 5. switch-db-local.sh

### Propósito
Cambia rápidamente entre bases de datos sin recompilar.

### Decisiones de Diseño

#### ¿Por qué matar el proceso actual?
```bash
MATTERMOST_PID=$(pgrep -f "dist/mattermost" || true)
if [ -n "$MATTERMOST_PID" ]; then
    kill "$MATTERMOST_PID"
```
**Decisión:** Mattermost no puede cambiar de BD en caliente. Es necesario reiniciar.

#### ¿Por qué reutilizar start-local.sh?
```bash
exec ./start-local.sh "$DB_NUM"
```
**Decisión:** Evita duplicar código. Usa el mismo script de inicio con la nueva BD.

---

## 6. restore-backups.sh

### Propósito
Restaura archivos SQL de backup en una BD específica.

### Decisiones de Diseño

#### ¿Por qué terminar conexiones activas?
```bash
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${DB_NAME}'
```
**Decisión:** PostgreSQL no permite eliminar una BD con conexiones activas. Esto fuerza el cierre.

#### ¿Por qué DROP + CREATE en lugar de TRUNCATE?
```bash
psql ... -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql ... -c "CREATE DATABASE ${DB_NAME};"
```
**Decisión:** Un backup SQL completo incluye CREATE TABLE. Es más limpio recrear la BD desde cero.

#### ¿Por qué opción "limpiar"?
```bash
if [ "$BACKUP_PATH" = "limpiar" ]; then
```
**Decisión:** Permite resetear una BD a estado vacío sin necesidad de tener un archivo SQL vacío.

#### ¿Por qué confirmación del usuario?
```bash
read -p "¿Estás seguro? Esto eliminará todos los datos... [s/N]: " confirm
```
**Decisión:** Prevención de pérdida de datos accidental. El usuario debe confirmar explícitamente.

---

## 7. build-frontend.sh

### Propósito
Compila solo el frontend (React) sin tocar el backend.

### Decisiones de Diseño

#### ¿Por qué un script separado?
```bash
./build-frontend.sh
```
**Decisión:** Durante desarrollo frontend, se compila frecuentemente. Es más rápido no recompilar el backend Go cada vez.

#### ¿Por qué `--legacy-peer-deps`?
```bash
npm install --legacy-peer-deps
```
**Decisión:** Mattermost usa dependencias legacy que no siguen las reglas de peer dependencies modernas de npm.

---

## Flujo de Trabajo Completo

### Primera vez
```bash
# 1. Setup inicial (10-20 minutos)
./setup-local-dev.sh

# 2. Restaurar backups (opcional)
./restore-backups.sh ~/Desktop/backup1.sql 1
./restore-backups.sh ~/Desktop/backup2.sql 2
./restore-backups.sh limpiar 3

# 3. Iniciar en segundo plano
./start-local-bg.sh 1
```

### Desarrollo diario
```bash
# Iniciar
./start-local-bg.sh 1

# Hacer cambios en código...

# Recompilar frontend
./build-frontend.sh
rm -rf dist/client/*
cp -r webapp/channels/dist/* dist/client/

# Cambiar de BD para probar
./switch-db-local.sh 2

# Detener al finalizar
./stop-local.sh
```

---

## Estructura de Directorios Final

```
mattermost/
├── setup-local-dev.sh      # Setup inicial
├── start-local.sh          # Inicio en primer plano
├── start-local-bg.sh       # Inicio en segundo plano
├── stop-local.sh           # Detener
├── switch-db-local.sh      # Cambiar BD
├── restore-backups.sh      # Restaurar backups
├── build-frontend.sh       # Compilar frontend
├── bin/
│   └── mattermost          # Binario compilado
├── dist/                   # Instalación runnable
│   ├── mattermost
│   ├── config/
│   ├── i18n/
│   ├── templates/
│   ├── client/             # Frontend compilado
│   ├── data/
│   ├── logs/
│   └── plugins/
├── server/                 # Código fuente Go
├── webapp/                 # Código fuente React
└── mattermost.log          # Logs cuando corre en background
```

---

## Problemas Comunes y Soluciones

### "Error: unable to load Mattermost translation files"
**Causa:** Falta el directorio `i18n/`
**Solución:** `cp -r server/i18n/* dist/i18n/`

### "Failed find server templates"
**Causa:** Falta el directorio `templates/`
**Solución:** `cp -r server/templates/* dist/templates/`

### "permission denied to create database"
**Causa:** Usuario PostgreSQL sin permisos suficientes
**Solución:** Ejecutar manualmente en psql: `CREATE USER mmuser WITH SUPERUSER PASSWORD 'mostest';`

### Puerto 8065 ocupado
**Causa:** Otra instancia de Mattermost corriendo
**Solución:** `./stop-local.sh` o `pkill -f "dist/mattermost"`
