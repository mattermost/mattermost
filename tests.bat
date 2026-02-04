@echo off
setlocal EnableDelayedExpansion

:: Mattermost Extended Test Runner
:: Runs the custom test suite locally before deployment
::
:: Usage:
::   tests.bat           - Run all custom tests
::   tests.bat quick     - Run unit tests only (no Docker needed)
::   tests.bat status    - Run status-related tests only
::   tests.bat store     - Run store tests only
::   tests.bat api       - Run API tests only
::   tests.bat stop      - Stop test containers

set SCRIPT_DIR=%~dp0
set PG_CONTAINER=mm-test-postgres
set REDIS_CONTAINER=mm-test-redis
set PG_PORT=5433
set REDIS_PORT=6380

:: Check for gotestsum
where gotestsum >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Installing gotestsum...
    go install gotest.tools/gotestsum@v1.11.0
)

if "%1"=="stop" goto :stop
if "%1"=="quick" goto :quick
if "%1"=="status" goto :status
if "%1"=="store" goto :store
if "%1"=="api" goto :api
if "%1"=="" goto :all

echo Unknown command: %1
echo Usage: tests.bat [quick^|status^|store^|api^|stop]
exit /b 1

:quick
echo.
echo === Running Unit Tests (No Docker Required) ===
echo.
cd /d "%SCRIPT_DIR%server"
call make setup-go-work 2>nul

echo.
echo [1/1] Model Tests (MattermostExtended + StatusLog)
gotestsum --format testname -- -v -run "TestMattermostExtended|TestStatusLog" ./public/model/... -timeout 10m
if %ERRORLEVEL% neq 0 (
    echo.
    echo FAILED: Unit tests failed
    exit /b 1
)

echo.
echo === All Unit Tests Passed ===
exit /b 0

:status
echo.
echo === Running Status Tests Only ===
call :start_containers
if %ERRORLEVEL% neq 0 exit /b 1

cd /d "%SCRIPT_DIR%server"

echo.
echo [1/4] AccurateStatuses Tests
gotestsum --format testname -- -v -run "TestUpdateActivityFromHeartbeat|TestUpdateActivityFromManualAction|TestUpdateActivityFromHeartbeatEdgeCases|TestSetStatusAwayIfNeededExtended" ./channels/app/platform/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [2/4] NoOffline Tests
gotestsum --format testname -- -v -run "TestSetOnlineIfNoOffline|TestNoOfflineWithAccurateStatuses|TestNoOfflineOnWebSocketConnect" ./channels/app/platform/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [3/4] DND Extended Tests
gotestsum --format testname -- -v -run "TestDNDInactivityTimeout|TestDNDRestoration|TestSetStatusDoNotDisturbExtended|TestSetStatusDoNotDisturbTimedExtended|TestSetStatusOutOfOfficeExtended|TestDNDWithNoOffline" ./channels/app/platform/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [4/4] Upstream Status Tests
gotestsum --format testname -- -v -run "TestSaveStatus|TestSetStatusOffline|TestQueueSetStatusOffline|TestTruncateDNDEndTime" ./channels/app/platform/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo === All Status Tests Passed ===
exit /b 0

:store
echo.
echo === Running Store Tests Only ===
call :start_containers
if %ERRORLEVEL% neq 0 exit /b 1

cd /d "%SCRIPT_DIR%server"

echo.
echo [1/3] Status Log Store Tests
gotestsum --format testname -- -v -run "TestStatusLogStore" ./channels/store/sqlstore/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [2/3] Encryption Session Key Store Tests
gotestsum --format testname -- -v -run "TestEncryptionSessionKeyStore" ./channels/store/sqlstore/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [3/3] Custom Channel Icon Store Tests
gotestsum --format testname -- -v -run "TestCustomChannelIconStore" ./channels/store/sqlstore/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo === All Store Tests Passed ===
exit /b 0

:api
echo.
echo === Running API Tests Only ===
call :start_containers
if %ERRORLEVEL% neq 0 exit /b 1

cd /d "%SCRIPT_DIR%server"

echo.
echo [1/5] Custom Channel Icon API Tests
gotestsum --format testname -- -v -run "TestCustomChannelIcon" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [2/5] Encryption API Tests
gotestsum --format testname -- -v -run "TestEncryption" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [3/5] Preference Override API Tests
gotestsum --format testname -- -v -run "TestPreferenceOverride" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [4/5] Error Log API Tests
gotestsum --format testname -- -v -run "TestErrorLog" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [5/5] Status Log API Tests
gotestsum --format testname -- -v -run "TestStatusLog" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo === All API Tests Passed ===
exit /b 0

:all
echo.
echo === Running Full Test Suite ===
call :start_containers
if %ERRORLEVEL% neq 0 exit /b 1

cd /d "%SCRIPT_DIR%server"
call make setup-go-work 2>nul

echo.
echo ========================================
echo UNIT TESTS
echo ========================================

echo.
echo [1/13] Model Tests (MattermostExtended + StatusLog)
gotestsum --format testname -- -v -run "TestMattermostExtended|TestStatusLog" ./public/model/... -timeout 10m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo ========================================
echo STORE TESTS
echo ========================================

echo.
echo [2/13] Status Log Store Tests
gotestsum --format testname -- -v -run "TestStatusLogStore" ./channels/store/sqlstore/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [3/13] Encryption Session Key Store Tests
gotestsum --format testname -- -v -run "TestEncryptionSessionKeyStore" ./channels/store/sqlstore/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [4/13] Custom Channel Icon Store Tests
gotestsum --format testname -- -v -run "TestCustomChannelIconStore" ./channels/store/sqlstore/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo ========================================
echo API TESTS
echo ========================================

echo.
echo [5/13] Custom Channel Icon API Tests
gotestsum --format testname -- -v -run "TestCustomChannelIcon" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [6/13] Encryption API Tests
gotestsum --format testname -- -v -run "TestEncryption" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [7/13] Preference Override API Tests
gotestsum --format testname -- -v -run "TestPreferenceOverride" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [8/13] Error Log API Tests
gotestsum --format testname -- -v -run "TestErrorLog" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [9/13] Status Log API Tests
gotestsum --format testname -- -v -run "TestStatusLog" ./channels/api4/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo ========================================
echo PLATFORM TESTS
echo ========================================

echo.
echo [10/13] AccurateStatuses Tests
gotestsum --format testname -- -v -run "TestUpdateActivityFromHeartbeat|TestUpdateActivityFromManualAction|TestUpdateActivityFromHeartbeatEdgeCases|TestSetStatusAwayIfNeededExtended" ./channels/app/platform/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [11/13] NoOffline Tests
gotestsum --format testname -- -v -run "TestSetOnlineIfNoOffline|TestNoOfflineWithAccurateStatuses|TestNoOfflineOnWebSocketConnect" ./channels/app/platform/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [12/13] DND Extended Tests
gotestsum --format testname -- -v -run "TestDNDInactivityTimeout|TestDNDRestoration|TestSetStatusDoNotDisturbExtended|TestSetStatusDoNotDisturbTimedExtended|TestSetStatusOutOfOfficeExtended|TestDNDWithNoOffline" ./channels/app/platform/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo [13/13] Upstream Status Tests
gotestsum --format testname -- -v -run "TestSaveStatus|TestSetStatusOffline|TestQueueSetStatusOffline|TestTruncateDNDEndTime" ./channels/app/platform/... -timeout 15m
if %ERRORLEVEL% neq 0 goto :test_failed

echo.
echo ========================================
echo ALL TESTS PASSED
echo ========================================
echo.
echo You may now run build.bat to create a release.
exit /b 0

:start_containers
echo.
echo Starting test containers...

:: Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Docker is not running. Please start Docker Desktop.
    exit /b 1
)

:: Start PostgreSQL if not running
docker ps --filter "name=%PG_CONTAINER%" --format "{{.Names}}" | findstr /c:"%PG_CONTAINER%" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Starting PostgreSQL container...
    docker run -d --name %PG_CONTAINER% -e POSTGRES_USER=mmuser -e POSTGRES_PASSWORD=mostest -e POSTGRES_DB=mattermost_test -p %PG_PORT%:5432 postgres:15 >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        :: Container might exist but be stopped
        docker start %PG_CONTAINER% >nul 2>&1
    )
    echo Waiting for PostgreSQL to be ready...
    timeout /t 5 /nobreak >nul
)

:: Start Redis if not running
docker ps --filter "name=%REDIS_CONTAINER%" --format "{{.Names}}" | findstr /c:"%REDIS_CONTAINER%" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Starting Redis container...
    docker run -d --name %REDIS_CONTAINER% -p %REDIS_PORT%:6379 redis:7 >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        docker start %REDIS_CONTAINER% >nul 2>&1
    )
    echo Waiting for Redis to be ready...
    timeout /t 3 /nobreak >nul
)

:: Set environment variables for tests
set MM_SQLSETTINGS_DRIVERNAME=postgres
set MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:mostest@localhost:%PG_PORT%/mattermost_test?sslmode=disable

echo Test containers ready.
exit /b 0

:stop
echo.
echo Stopping test containers...
docker stop %PG_CONTAINER% %REDIS_CONTAINER% >nul 2>&1
docker rm %PG_CONTAINER% %REDIS_CONTAINER% >nul 2>&1
echo Done.
exit /b 0

:test_failed
echo.
echo ========================================
echo TESTS FAILED - Do not run build.bat
echo ========================================
echo.
echo Fix the failing tests before deploying.
exit /b 1
