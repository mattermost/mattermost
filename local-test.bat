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
if "!BACKUP_PATH!"=="" (
    echo ERROR: BACKUP_PATH not set in local-test.config
    exit /b 1
)
if "!WORK_DIR!"=="" (
    echo ERROR: WORK_DIR not set in local-test.config
    exit /b 1
)

REM Set defaults
if "!MM_PORT!"=="" set "MM_PORT=8065"
if "!PG_PORT!"=="" set "PG_PORT=5432"
if "!PG_USER!"=="" set "PG_USER=mmuser"
if "!PG_PASSWORD!"=="" set "PG_PASSWORD=mostest"
if "!PG_DATABASE!"=="" set "PG_DATABASE=mattermost_test"

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
echo   setup     - First-time setup (extract backup, create containers)
echo   start     - Start the local Mattermost server
echo   stop      - Stop all containers
echo   status    - Show container status
echo   logs      - View Mattermost server logs
echo   psql      - Open PostgreSQL shell
echo   clean      - Remove all test data and containers
echo   build      - Build server binary for testing
echo   webapp     - Build webapp from source and copy to test dir
echo   docker     - Run using official Docker image (simpler, no code changes)
echo   fix-config - Reset config.json to clean local settings
echo   kill       - Kill the running Mattermost server process
echo   s3-sync   - Download S3 storage files (uploads, plugins, etc.)
echo.
echo Configuration:
echo   Edit local-test.config with your backup path and settings
echo.
echo Recommended workflow for testing code changes:
echo   1. local-test.bat setup     (first time only)
echo   2. local-test.bat build     (build server with your changes)
echo   3. local-test.bat webapp    (build webapp with your changes)
echo   4. local-test.bat start     (run and test)
echo.
goto :eof

:cmd_setup
echo.
echo === Setting up Local Test Environment ===
echo.
echo Work directory: !WORK_DIR!
echo Backup: !BACKUP_PATH!
echo.

REM Check backup exists
if not exist "!BACKUP_PATH!" (
    echo ERROR: Backup file not found: !BACKUP_PATH!
    exit /b 1
)

REM Create work directory
if not exist "!WORK_DIR!" mkdir "!WORK_DIR!"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop.
    exit /b 1
)

echo [1/5] Extracting backup...
if not exist "!WORK_DIR!\backup" (
    mkdir "!WORK_DIR!\backup"

    REM Try 7z first, then tar
    where 7z >nul 2>&1
    if !errorlevel!==0 (
        7z x "!BACKUP_PATH!" -so | 7z x -si -ttar -o"!WORK_DIR!\backup"
    ) else (
        tar -xzf "!BACKUP_PATH!" -C "!WORK_DIR!\backup"
    )

    if errorlevel 1 (
        echo ERROR: Failed to extract backup
        exit /b 1
    )
) else (
    echo Backup already extracted, skipping...
)

echo [2/5] Creating PostgreSQL container...
docker rm -f !PG_CONTAINER! >nul 2>&1
docker run -d ^
    --name !PG_CONTAINER! ^
    -e POSTGRES_USER=!PG_USER! ^
    -e POSTGRES_PASSWORD=!PG_PASSWORD! ^
    -e POSTGRES_DB=!PG_DATABASE! ^
    -p !PG_PORT!:5432 ^
    -v "!WORK_DIR!\pgdata:/var/lib/postgresql/data" ^
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
for /r "!WORK_DIR!\backup" %%f in (*.sql *.dump) do (
    set "SQL_DUMP=%%f"
)

if "!SQL_DUMP!"=="" (
    REM Cloudron backups use pg_dump format in a specific location
    for /r "!WORK_DIR!\backup" %%f in (*postgresql*) do (
        set "SQL_DUMP=%%f"
    )
)

if not "!SQL_DUMP!"=="" (
    echo Found database dump: !SQL_DUMP!
    docker exec -i !PG_CONTAINER! psql -U !PG_USER! -d !PG_DATABASE! < "!SQL_DUMP!"
) else (
    echo WARNING: No SQL dump found in backup. Database will be empty.
)

echo [4/5] Copying data files...
if exist "!WORK_DIR!\backup\data" (
    xcopy /E /I /Y "!WORK_DIR!\backup\data" "!WORK_DIR!\data" >nul
) else (
    mkdir "!WORK_DIR!\data" 2>nul
)

echo [5/5] Creating config file...
(
echo {
echo   "ServiceSettings": {
echo     "SiteURL": "http://localhost:!MM_PORT!",
echo     "ListenAddress": ":!MM_PORT!"
echo   },
echo   "SqlSettings": {
echo     "DriverName": "postgres",
echo     "DataSource": "postgres://!PG_USER!:!PG_PASSWORD!@localhost:!PG_PORT!/!PG_DATABASE!?sslmode=disable"
echo   },
echo   "FileSettings": {
echo     "Directory": "!WORK_DIR:\=/!/data"
echo   },
echo   "LogSettings": {
echo     "EnableConsole": true,
echo     "ConsoleLevel": "DEBUG"
echo   }
echo }
) > "!WORK_DIR!\config.json"

echo.
echo === Setup Complete ===
echo.
echo PostgreSQL running on port !PG_PORT!
echo Data directory: !WORK_DIR!\data
echo Config file: !WORK_DIR!\config.json
echo.
echo Next steps:
echo   1. Build the server: local-test.bat build
echo   2. Start the server: local-test.bat start
echo   3. Open http://localhost:!MM_PORT! in your browser
echo.
goto :eof

:cmd_build
echo.
echo === Building Mattermost Server ===
echo.
cd /d "!SCRIPT_DIR!server"
go build -o "!WORK_DIR!\mattermost.exe" ./cmd/mattermost
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)
echo Build complete: !WORK_DIR!\mattermost.exe
goto :eof

:cmd_webapp
echo.
echo === Building Mattermost Webapp ===
echo.

REM Check Node.js version
for /f "tokens=1 delims=v" %%a in ('node --version 2^>nul') do set "NODE_RAW=%%a"
for /f "tokens=1 delims=." %%a in ('node --version 2^>nul') do set "NODE_MAJOR=%%a"
set "NODE_MAJOR=!NODE_MAJOR:v=!"

if "!NODE_MAJOR!"=="" (
    echo ERROR: Node.js is not installed.
    echo Please install Node.js 18.x-22.x from https://nodejs.org/
    exit /b 1
)

echo Detected Node.js version: !NODE_MAJOR!.x

REM Check if Node version is compatible (18-24)
set "NODE_OK=0"
if !NODE_MAJOR! GEQ 18 if !NODE_MAJOR! LEQ 24 set "NODE_OK=1"

if "!NODE_OK!"=="0" (
    echo.
    echo WARNING: Node.js !NODE_MAJOR!.x may not be compatible.
    echo Mattermost webapp requires Node.js 18.x-22.x
    echo.
    echo Options:
    echo   1. Install nvm-windows: https://github.com/coreybutler/nvm-windows/releases
    echo      Then run: nvm install 20.11.0 ^&^& nvm use 20.11.0
    echo   2. Try building anyway ^(may work^)
    echo.
    set /p "CONTINUE=Continue anyway? (y/N): "
    if /i not "!CONTINUE!"=="y" (
        echo Cancelled.
        exit /b 1
    )
)

echo.
echo [1/3] Installing dependencies...
cd /d "!SCRIPT_DIR!webapp"
call npm install --force --legacy-peer-deps
if errorlevel 1 (
    echo ERROR: npm install failed
    exit /b 1
)

echo.
echo [2/3] Building webapp (this may take several minutes)...
call npm run build
if errorlevel 1 (
    echo ERROR: Webapp build failed
    exit /b 1
)

echo.
echo [3/3] Copying built webapp to test directory...
if exist "!WORK_DIR!\client" (
    rmdir /s /q "!WORK_DIR!\client"
)
xcopy /E /I /Y "!SCRIPT_DIR!webapp\channels\dist" "!WORK_DIR!\client" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy webapp files
    exit /b 1
)

echo.
echo === Webapp Build Complete ===
echo.
echo Built files copied to: !WORK_DIR!\client
echo.
echo Next: Run 'local-test.bat start' to test your changes
echo.
goto :eof

:cmd_docker
echo.
echo === Running Mattermost via Docker ===
echo.
echo This mode uses the official Mattermost Docker image with your database.
echo Use this for quick testing when you don't need code changes.
echo.

REM Start PostgreSQL if not running
docker start !PG_CONTAINER! >nul 2>&1

REM Stop any existing Mattermost container
docker rm -f !CONTAINER_NAME! >nul 2>&1

echo Starting Mattermost Docker container...
docker run -d ^
    --name !CONTAINER_NAME! ^
    -p !MM_PORT!:8065 ^
    -e MM_SQLSETTINGS_DRIVERNAME=postgres ^
    -e MM_SQLSETTINGS_DATASOURCE="postgres://!PG_USER!:!PG_PASSWORD!@host.docker.internal:!PG_PORT!/!PG_DATABASE!?sslmode=disable" ^
    -e MM_SERVICESETTINGS_SITEURL="http://localhost:!MM_PORT!" ^
    -v "!WORK_DIR!\data:/mattermost/data" ^
    mattermost/mattermost-team-edition:11.3.0

if errorlevel 1 (
    echo ERROR: Failed to start Docker container
    exit /b 1
)

echo.
echo Mattermost is starting...
echo View logs: docker logs -f !CONTAINER_NAME!
echo Open: http://localhost:!MM_PORT!
echo.
echo To stop: docker stop !CONTAINER_NAME!
echo.
goto :eof

:cmd_fix-config
echo.
echo === Resetting config.json for Local Testing ===
echo.

REM Backup existing config
if exist "!WORK_DIR!\config.json" (
    copy "!WORK_DIR!\config.json" "!WORK_DIR!\config.json.backup" >nul
    echo Backed up existing config to config.json.backup
)

REM Create clean local config
(
echo {
echo   "ServiceSettings": {
echo     "SiteURL": "http://localhost:!MM_PORT!",
echo     "ListenAddress": ":!MM_PORT!",
echo     "EnableDeveloper": true,
echo     "EnableTesting": false,
echo     "AllowCorsFrom": "*",
echo     "EnableLocalMode": false
echo   },
echo   "TeamSettings": {
echo     "SiteName": "Mattermost Local Test",
echo     "EnableUserCreation": true,
echo     "EnableOpenServer": true,
echo     "EnableCustomUserStatuses": true,
echo     "EnableLastActiveTime": true
echo   },
echo   "SqlSettings": {
echo     "DriverName": "postgres",
echo     "DataSource": "postgres://!PG_USER!:!PG_PASSWORD!@localhost:!PG_PORT!/!PG_DATABASE!?sslmode=disable",
echo     "DataSourceReplicas": [],
echo     "MaxIdleConns": 20,
echo     "MaxOpenConns": 300
echo   },
echo   "FileSettings": {
echo     "DriverName": "local",
echo     "Directory": "!WORK_DIR:\=/!/data",
echo     "EnableFileAttachments": true,
echo     "EnablePublicLink": true
echo   },
echo   "LogSettings": {
echo     "EnableConsole": true,
echo     "ConsoleLevel": "DEBUG",
echo     "ConsoleJson": false,
echo     "EnableFile": true,
echo     "FileLevel": "INFO",
echo     "FileJson": false,
echo     "FileLocation": "!WORK_DIR:\=/!"
echo   },
echo   "PluginSettings": {
echo     "Enable": true,
echo     "EnableUploads": true,
echo     "Directory": "./plugins",
echo     "ClientDirectory": "./client/plugins"
echo   },
echo   "EmailSettings": {
echo     "EnableSignUpWithEmail": true,
echo     "EnableSignInWithEmail": true,
echo     "EnableSignInWithUsername": true,
echo     "SendEmailNotifications": false,
echo     "RequireEmailVerification": false
echo   },
echo   "RateLimitSettings": {
echo     "Enable": false
echo   },
echo   "PrivacySettings": {
echo     "ShowEmailAddress": true,
echo     "ShowFullName": true
echo   }
echo }
) > "!WORK_DIR!\config.json"

echo.
echo Config reset to clean local settings.
echo.
echo Key settings:
echo   - Database: postgres://!PG_USER!:****@localhost:!PG_PORT!/!PG_DATABASE!
echo   - Data dir: !WORK_DIR!\data
echo   - Plugins enabled
echo   - Email verification disabled
echo   - Rate limiting disabled
echo.
goto :eof

:cmd_start
echo.
echo === Starting Local Mattermost ===
echo.

REM Start PostgreSQL if not running
docker start !PG_CONTAINER! >nul 2>&1

REM Check if binary exists
if not exist "!WORK_DIR!\mattermost.exe" (
    echo Server binary not found. Building...
    call :cmd_build
)

echo Starting server on http://localhost:!MM_PORT!
echo Press Ctrl+C to stop
echo.

cd /d "!WORK_DIR!"
"!WORK_DIR!\mattermost.exe" server --config "!WORK_DIR!\config.json"
goto :eof

:cmd_stop
echo.
echo === Stopping Local Test Environment ===
echo.
docker stop !PG_CONTAINER! >nul 2>&1
echo Stopped.
goto :eof

:cmd_kill
echo.
echo === Killing Mattermost Server ===
echo.
REM Kill mattermost.exe directly
taskkill /F /IM mattermost.exe >nul 2>&1
if !errorlevel!==0 (
    echo Mattermost server killed.
) else (
    echo No running mattermost.exe found.
)
echo Done.
goto :eof

:cmd_status
echo.
echo === Container Status ===
echo.
docker ps -a --filter "name=!PG_CONTAINER!" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
goto :eof

:cmd_logs
docker logs -f !PG_CONTAINER!
goto :eof

:cmd_psql
echo Connecting to PostgreSQL...
docker exec -it !PG_CONTAINER! psql -U !PG_USER! -d !PG_DATABASE!
goto :eof

:cmd_clean
echo.
echo === Cleaning Up ===
echo.
echo This will remove all test data and containers.
set /p "CONFIRM=Are you sure? (y/N): "
if /i not "!CONFIRM!"=="y" (
    echo Cancelled.
    goto :eof
)

docker rm -f !PG_CONTAINER! >nul 2>&1
if exist "!WORK_DIR!" (
    rmdir /s /q "!WORK_DIR!"
)
echo Cleanup complete.
goto :eof

:cmd_s3-sync
echo.
echo === Downloading S3 Storage Files ===
echo.

REM Check for required S3 config
if "!S3_BUCKET!"=="" (
    echo ERROR: S3_BUCKET not set in local-test.config
    echo.
    echo Add these settings to local-test.config:
    echo   S3_BUCKET=mattermost-modders
    echo   S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
    echo   S3_ACCESS_KEY=your-access-key
    echo   S3_SECRET_KEY=your-secret-key
    exit /b 1
)

if "!S3_ACCESS_KEY!"=="" (
    echo ERROR: S3_ACCESS_KEY not set in local-test.config
    exit /b 1
)

if "!S3_SECRET_KEY!"=="" (
    echo ERROR: S3_SECRET_KEY not set in local-test.config
    exit /b 1
)

REM Check if AWS CLI is installed
where aws >nul 2>&1
if errorlevel 1 (
    echo ERROR: AWS CLI not found.
    echo.
    echo Install with: winget install Amazon.AWSCLI
    echo Or download from: https://aws.amazon.com/cli/
    exit /b 1
)

REM Create data directory if it doesn't exist
if not exist "!WORK_DIR!\data" (
    mkdir "!WORK_DIR!\data"
)

echo Bucket: !S3_BUCKET!
echo Endpoint: !S3_ENDPOINT!
echo Destination: !WORK_DIR!\data
echo.

REM Set AWS credentials for this session
set "AWS_ACCESS_KEY_ID=!S3_ACCESS_KEY!"
set "AWS_SECRET_ACCESS_KEY=!S3_SECRET_KEY!"

REM Build endpoint URL flag if endpoint is set
set "ENDPOINT_FLAG="
if not "!S3_ENDPOINT!"=="" (
    set "ENDPOINT_FLAG=--endpoint-url !S3_ENDPOINT!"
)

echo Syncing files from S3 (this may take a while)...
echo.

REM Sync the entire bucket to local data directory (--delete removes files not in S3)
aws s3 sync "s3://!S3_BUCKET!/" "!WORK_DIR!\data" !ENDPOINT_FLAG! --size-only --delete --no-sign-request 2>nul
if errorlevel 1 (
    REM Try with credentials (no-sign-request failed)
    aws s3 sync "s3://!S3_BUCKET!/" "!WORK_DIR!\data" !ENDPOINT_FLAG! --size-only --delete
    if errorlevel 1 (
        echo ERROR: S3 sync failed
        exit /b 1
    )
)

echo.
echo === S3 Sync Complete ===
echo.
echo Files downloaded to: !WORK_DIR!\data
echo.
echo Contents:
dir /b "!WORK_DIR!\data" 2>nul
echo.
goto :eof
