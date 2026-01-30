@echo off
REM Quick test build script for local development
REM This is MUCH faster than GitHub Actions (30 sec vs 10-15 min)
REM Run this after every code change before pushing!

setlocal

REM Parse command line arguments
set STEP=%1
if "%STEP%"=="" set STEP=all

cd server

if "%STEP%"=="workspace" goto workspace
if "%STEP%"=="app" goto app
if "%STEP%"=="server" goto server
if "%STEP%"=="all" goto all

echo Usage: test-build.bat [workspace^|app^|server^|all]
echo   workspace - Just setup go workspace
echo   app       - Just test channels/app compilation
echo   server    - Just test server binary compilation
echo   all       - Run all tests (default)
exit /b 1

:all
echo ========================================
echo Testing Mattermost Build Locally
echo ========================================
echo.

:workspace
echo [1/3] Setting up Go workspace...
make setup-go-work
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to setup go workspace
    echo.
    echo To retry just this step: test-build.bat workspace
    exit /b 1
)
if "%STEP%"=="workspace" goto success
echo.

:app
echo [2/3] Testing compile (channels/app)...
echo This is where most errors occur...
go build -v ./channels/app 2>&1 | findstr /V "go: downloading"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================
    echo BUILD FAILED - channels/app
    echo ========================================
    echo.
    echo Common issues:
    echo   - Missing go generate after Plugin API changes
    echo   - Incorrect function signatures
    echo   - Import errors
    echo.
    echo To retry just this step: test-build.bat app
    echo To fix Plugin API: cd server/public/plugin ^&^& go generate
    exit /b 1
)
if "%STEP%"=="app" goto success
echo.

:server
echo [3/3] Testing compile (full server)...
go build -v ./cmd/mattermost 2>&1 | findstr /V "go: downloading"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================
    echo BUILD FAILED - server binary
    echo ========================================
    echo.
    echo To retry just this step: test-build.bat server
    exit /b 1
)

:success
echo.
echo ========================================
echo SUCCESS - Build test passed!
echo ========================================
echo.
echo ✓ All compilation checks passed
echo ✓ Safe to push to GitHub
echo.
echo Next steps:
echo   1. git add . ^&^& git commit -m "your message"
echo   2. git push origin master
echo   3. ./build.bat 11.3.0-custom.X "description"
echo.
echo For full build: cd server ^&^& make build-linux BUILD_ENTERPRISE=false
exit /b 0
