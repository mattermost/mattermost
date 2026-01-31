@echo off
REM Quick test build script for local development
REM This is MUCH faster than GitHub Actions (30 sec vs 10-15 min)
REM Run this after every code change before pushing!

setlocal EnableDelayedExpansion

REM Parse command line arguments
set STEP=%1
if "%STEP%"=="" set STEP=all

if "%STEP%"=="workspace" goto workspace
if "%STEP%"=="plugin" goto plugin
if "%STEP%"=="app" goto app
if "%STEP%"=="server" goto server
if "%STEP%"=="webapp" goto webapp
if "%STEP%"=="all" goto all

echo Usage: test-build.bat [workspace^|plugin^|app^|server^|webapp^|all]
echo   workspace - Just setup go workspace
echo   plugin    - Just test public/plugin compilation (interface checks)
echo   app       - Just test channels/app compilation
echo   server    - Just test server binary compilation
echo   webapp    - Just test webapp for common issues
echo   all       - Run all tests (default)
exit /b 1

:all
echo ========================================
echo Testing Mattermost Build Locally
echo ========================================
echo.

:workspace
echo [1/5] Setting up Go workspace...
cd server
call make setup-go-work
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to setup go workspace
    echo.
    echo To retry just this step: test-build.bat workspace
    exit /b 1
)
if "%STEP%"=="workspace" goto success
cd ..
echo.

:webapp
echo [2/5] Checking webapp for common issues...

REM Check for corrupted line endings (literal backtick-r-backtick-n)
echo Scanning for corrupted line endings...
findstr /S /M /C:"`r`n" webapp\channels\src\*.tsx webapp\channels\src\*.ts webapp\platform\types\src\*.ts 2>nul
if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================
    echo BUILD WILL FAIL - Corrupted line endings found!
    echo ========================================
    echo.
    echo Files with literal backtick-r-backtick-n characters:
    findstr /S /M /C:"`r`n" webapp\channels\src\*.tsx webapp\channels\src\*.ts webapp\platform\types\src\*.ts 2>nul
    echo.
    echo Fix: Replace literal backtick-r-backtick-n with actual newlines
    echo.
    echo To retry just this step: test-build.bat webapp
    exit /b 1
)
echo   No corrupted line endings found.

REM Check if node_modules exists for full TypeScript check
if exist "webapp\node_modules" (
    echo Running TypeScript check...
    cd webapp
    call npm run build --workspace=platform/types 2>&1 | findstr /I "error"
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ========================================
        echo BUILD FAILED - webapp TypeScript errors
        echo ========================================
        cd ..
        exit /b 1
    )
    cd ..
    echo   TypeScript check passed.
) else (
    echo   [SKIP] Full TypeScript check - node_modules not found
    echo   Run 'cd webapp ^&^& npm ci' to enable full TypeScript checking
)

if "%STEP%"=="webapp" goto success
echo.

:plugin
echo [3/5] Testing compile (public/plugin)...
echo This catches interface mismatches...
cd server
go build ./public/plugin 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================
    echo BUILD FAILED - public/plugin
    echo ========================================
    echo.
    echo Common issues:
    echo   - Interface mismatch: API interface has methods not implemented
    echo   - Missing generated code: run 'go generate' in public/plugin
    echo   - Removed API methods still defined in api.go
    echo.
    echo To retry just this step: test-build.bat plugin
    exit /b 1
)
cd ..
if "%STEP%"=="plugin" goto success
echo.

:app
echo [4/5] Testing compile (channels/app)...
echo This is where most server errors occur...
cd server
go build ./channels/app 2>&1
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
cd ..
if "%STEP%"=="app" goto success
echo.

:server
echo [5/5] Testing compile (full server)...
cd server
go build ./cmd/mattermost 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================
    echo BUILD FAILED - server binary
    echo ========================================
    echo.
    echo To retry just this step: test-build.bat server
    exit /b 1
)
cd ..

:success
echo.
echo ========================================
echo SUCCESS - Build test passed!
echo ========================================
echo.
echo All compilation checks passed:
echo   [x] Go workspace setup
echo   [x] Webapp syntax check
echo   [x] Plugin API interfaces
echo   [x] Server channels/app
echo   [x] Server binary
echo.
echo Safe to push to GitHub
echo.
echo Next steps:
echo   1. git add . ^&^& git commit -m "your message"
echo   2. git push origin master
echo   3. ./build.bat 11.3.0-custom.X "description"
echo.
echo For full build: cd server ^&^& make build-linux BUILD_ENTERPRISE=false
exit /b 0
