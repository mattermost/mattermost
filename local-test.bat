@echo off
setlocal EnableDelayedExpansion

REM ============================================================================
REM Mattermost Local Testing Setup
REM ============================================================================
REM This script sets up a local Mattermost server using a Cloudron backup
REM for testing custom builds before deployment.
REM
REM Prerequisites:
REM   - Docker Desktop installed and running
REM   - 7-Zip installed (for extracting .tar.gz)
REM   - Copy local-test.config.example to local-test.config and configure
REM
REM Usage:
REM   local-test.bat setup    - First-time setup (extract backup, create DB)
REM   local-test.bat start    - Start the local server
REM   local-test.bat stop     - Stop the local server
REM   local-test.bat status   - Check container status
REM   local-test.bat logs     - View server logs
REM   local-test.bat clean    - Remove all test data
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
set "CONFIG_FILE=%SCRIPT_DIR%local-test.config"

REM Check for config file
if not exist "%CONFIG_FILE%" (
    echo ERROR: local-test.config not found
    echo Please copy local-test.config.example to local-test.config and configure it.
    exit /b 1
)

REM Load config
for /f "usebackq tokens=1,* delims==" %%a in ("%CONFIG_FILE%") do (
    set "line=%%a"
    if not "!line:~0,1!"=="#" (
        if not "%%a"=="" (
            set "%%a=%%b"
        )
    )
)

REM Validate required config
if "%BACKUP_PATH%"=="" (
    echo ERROR: BACKUP_PATH not set in local-test.config
    exit /b 1
)
if "%WORK_DIR%"=="" (
    echo ERROR: WORK_DIR not set in local-test.config
    exit /b 1
)

REM Set defaults
if "%MM_PORT%"=="" set "MM_PORT=8065"
if "%PG_PORT%"=="" set "PG_PORT=5432"
if "%PG_USER%"=="" set "PG_USER=mmuser"
if "%PG_PASSWORD%"=="" set "PG_PASSWORD=mostest"
if "%PG_DATABASE%"=="" set "PG_DATABASE=mattermost_test"

set "CONTAINER_NAME=mm-local-test"
set "PG_CONTAINER=mm-local-postgres"

REM Parse command
set "CMD=%~1"
if "%CMD%"=="" set "CMD=help"

goto cmd_%CMD% 2>nul || goto cmd_help

:cmd_help
echo.
echo Mattermost Local Testing Setup
echo ==============================
echo.
echo Usage: local-test.bat [command]
echo.
echo Commands:
echo   setup    - First-time setup (extract backup, create containers)
echo   start    - Start the local Mattermost server
echo   stop     - Stop all containers
echo   status   - Show container status
echo   logs     - View Mattermost server logs
echo   psql     - Open PostgreSQL shell
echo   clean    - Remove all test data and containers
echo   build    - Build server binary for testing
echo.
echo Configuration:
echo   Edit local-test.config with your backup path and settings
echo.
goto :eof

:cmd_setup
echo.
echo === Setting up Local Test Environment ===
echo.
echo Work directory: %WORK_DIR%
echo Backup: %BACKUP_PATH%
echo.

REM Check backup exists
if not exist "%BACKUP_PATH%" (
    echo ERROR: Backup file not found: %BACKUP_PATH%
    exit /b 1
)

REM Create work directory
if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop.
    exit /b 1
)

echo [1/5] Extracting backup...
if not exist "%WORK_DIR%\backup" (
    mkdir "%WORK_DIR%\backup"

    REM Try 7z first, then tar
    where 7z >nul 2>&1
    if !errorlevel!==0 (
        7z x "%BACKUP_PATH%" -so | 7z x -si -ttar -o"%WORK_DIR%\backup"
    ) else (
        tar -xzf "%BACKUP_PATH%" -C "%WORK_DIR%\backup"
    )

    if errorlevel 1 (
        echo ERROR: Failed to extract backup
        exit /b 1
    )
) else (
    echo Backup already extracted, skipping...
)

echo [2/5] Creating PostgreSQL container...
docker rm -f %PG_CONTAINER% >nul 2>&1
docker run -d ^
    --name %PG_CONTAINER% ^
    -e POSTGRES_USER=%PG_USER% ^
    -e POSTGRES_PASSWORD=%PG_PASSWORD% ^
    -e POSTGRES_DB=%PG_DATABASE% ^
    -p %PG_PORT%:5432 ^
    -v "%WORK_DIR%\pgdata:/var/lib/postgresql/data" ^
    postgres:15-alpine

if errorlevel 1 (
    echo ERROR: Failed to create PostgreSQL container
    exit /b 1
)

echo Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

echo [3/5] Restoring database from backup...
REM Find the SQL dump in the backup
set "SQL_DUMP="
for /r "%WORK_DIR%\backup" %%f in (*.sql *.dump) do (
    set "SQL_DUMP=%%f"
)

if "%SQL_DUMP%"=="" (
    REM Cloudron backups use pg_dump format in a specific location
    for /r "%WORK_DIR%\backup" %%f in (*postgresql*) do (
        set "SQL_DUMP=%%f"
    )
)

if not "%SQL_DUMP%"=="" (
    echo Found database dump: %SQL_DUMP%
    docker exec -i %PG_CONTAINER% psql -U %PG_USER% -d %PG_DATABASE% < "%SQL_DUMP%"
) else (
    echo WARNING: No SQL dump found in backup. Database will be empty.
)

echo [4/5] Copying data files...
if exist "%WORK_DIR%\backup\data" (
    xcopy /E /I /Y "%WORK_DIR%\backup\data" "%WORK_DIR%\data" >nul
) else (
    mkdir "%WORK_DIR%\data" 2>nul
)

echo [5/5] Creating config file...
(
echo {
echo   "ServiceSettings": {
echo     "SiteURL": "http://localhost:%MM_PORT%",
echo     "ListenAddress": ":%MM_PORT%"
echo   },
echo   "SqlSettings": {
echo     "DriverName": "postgres",
echo     "DataSource": "postgres://%PG_USER%:%PG_PASSWORD%@localhost:%PG_PORT%/%PG_DATABASE%?sslmode=disable"
echo   },
echo   "FileSettings": {
echo     "Directory": "%WORK_DIR:\=/%/data"
echo   },
echo   "LogSettings": {
echo     "EnableConsole": true,
echo     "ConsoleLevel": "DEBUG"
echo   }
echo }
) > "%WORK_DIR%\config.json"

echo.
echo === Setup Complete ===
echo.
echo PostgreSQL running on port %PG_PORT%
echo Data directory: %WORK_DIR%\data
echo Config file: %WORK_DIR%\config.json
echo.
echo Next steps:
echo   1. Build the server: local-test.bat build
echo   2. Start the server: local-test.bat start
echo   3. Open http://localhost:%MM_PORT% in your browser
echo.
goto :eof

:cmd_build
echo.
echo === Building Mattermost Server ===
echo.
cd /d "%SCRIPT_DIR%server"
go build -o "%WORK_DIR%\mattermost.exe" ./cmd/mattermost
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)
echo Build complete: %WORK_DIR%\mattermost.exe
goto :eof

:cmd_start
echo.
echo === Starting Local Mattermost ===
echo.

REM Start PostgreSQL if not running
docker start %PG_CONTAINER% >nul 2>&1

REM Check if binary exists
if not exist "%WORK_DIR%\mattermost.exe" (
    echo Server binary not found. Building...
    call :cmd_build
)

echo Starting server on http://localhost:%MM_PORT%
echo Press Ctrl+C to stop
echo.

cd /d "%WORK_DIR%"
"%WORK_DIR%\mattermost.exe" server --config "%WORK_DIR%\config.json"
goto :eof

:cmd_stop
echo.
echo === Stopping Local Test Environment ===
echo.
docker stop %PG_CONTAINER% >nul 2>&1
echo Stopped.
goto :eof

:cmd_status
echo.
echo === Container Status ===
echo.
docker ps -a --filter "name=%PG_CONTAINER%" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
goto :eof

:cmd_logs
docker logs -f %PG_CONTAINER%
goto :eof

:cmd_psql
echo Connecting to PostgreSQL...
docker exec -it %PG_CONTAINER% psql -U %PG_USER% -d %PG_DATABASE%
goto :eof

:cmd_clean
echo.
echo === Cleaning Up ===
echo.
echo This will remove all test data and containers.
set /p "CONFIRM=Are you sure? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    goto :eof
)

docker rm -f %PG_CONTAINER% >nul 2>&1
if exist "%WORK_DIR%" (
    rmdir /s /q "%WORK_DIR%"
)
echo Cleanup complete.
goto :eof
