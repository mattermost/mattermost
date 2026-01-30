@echo off
REM Quick test build script for local development
REM This mimics what GitHub Actions does but faster (just compile check, no full build)

echo ========================================
echo Testing Mattermost Build Locally
echo ========================================
echo.

cd server

echo [1/3] Setting up Go workspace...
make setup-go-work
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to setup go workspace
    exit /b 1
)
echo.

echo [2/3] Testing compile (channels/app)...
go build -v ./channels/app
if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================
    echo BUILD FAILED - Fix errors above
    echo ========================================
    exit /b 1
)
echo.

echo [3/3] Testing compile (full server)...
go build -v ./cmd/mattermost
if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================
    echo BUILD FAILED - Fix errors above
    echo ========================================
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS - Build test passed!
echo ========================================
echo.
echo You can now safely push to GitHub.
echo To do a full build: cd server ^&^& make build-linux BUILD_ENTERPRISE=false
