@echo off
REM SUPER FAST test - just compile check, no workspace setup
REM Use this for rapid iteration when fixing errors
REM Takes ~5-10 seconds after first run (Go caches everything)

setlocal
cd server

echo Testing compilation...
go build ./channels/app 2>&1 | findstr /V /C:"go: downloading"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [FAILED] Fix errors above and run again
    exit /b 1
)

echo.
echo [OK] Compilation successful!
echo Run './test-build.bat' for full test before pushing.
