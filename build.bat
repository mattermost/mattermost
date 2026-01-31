@echo off
setlocal enabledelayedexpansion

:: Mattermost Extended Build Script
:: Usage: build.bat <version> "<commit message>"
:: Example: build.bat 11.3.0-custom.2 "Fix status tracking"

if "%~1"=="" (
    echo Usage: build.bat ^<version^> "^<commit message^>"
    echo Example: build.bat 11.3.0-custom.2 "Fix status tracking"
    exit /b 1
)

if "%~2"=="" (
    echo Usage: build.bat ^<version^> "^<commit message^>"
    echo Example: build.bat 11.3.0-custom.2 "Fix status tracking"
    exit /b 1
)

set VERSION=%~1
set COMMIT_MSG=%~2

:: Remove v prefix if present
set VERSION=%VERSION:v=%

echo.
echo ================================================================================
echo Mattermost Extended - Build and Release
echo ================================================================================
echo Version: v%VERSION%
echo Message: %COMMIT_MSG%
echo ================================================================================
echo.

:: Check for uncommitted changes - require clean working tree
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo.
    echo ERROR: You have uncommitted changes.
    echo.
    git status --short
    echo.
    echo Please commit your changes first with a proper message:
    echo   git add . ^&^& git commit -m "your message"
    echo.
    echo Then run build.bat again.
    exit /b 1
)

echo.
echo Creating tag v%VERSION%...

:: Check if tag already exists locally or remotely and remove it
git rev-parse v%VERSION% >nul 2>&1
if not errorlevel 1 (
    echo Tag v%VERSION% already exists locally. Removing...
    git tag -d v%VERSION%
)

git ls-remote --tags origin refs/tags/v%VERSION% | findstr /C:"v%VERSION%" >nul 2>&1
if not errorlevel 1 (
    echo Tag v%VERSION% already exists on remote. Removing...
    git push origin :refs/tags/v%VERSION%
)

git tag -a v%VERSION% -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo.
    echo ERROR: Failed to create tag.
    exit /b 1
)

echo.
echo Pushing to GitHub...
git push origin master
git push origin v%VERSION%
if errorlevel 1 (
    echo.
    echo ERROR: Failed to push to GitHub
    echo.
    echo Rolling back tag...
    git tag -d v%VERSION%
    exit /b 1
)

echo.
echo ================================================================================
echo SUCCESS! Build Started
echo ================================================================================
echo.
echo Tag v%VERSION% has been pushed to GitHub.
echo.
echo GitHub Actions is now building Mattermost:
echo - Team Edition: mattermost-team-%VERSION%-linux-amd64.tar.gz
echo - Enterprise: mattermost-%VERSION%-linux-amd64.tar.gz
echo.
echo Monitor build progress:
echo https://github.com/stalecontext/mattermost-extended/actions
echo.
echo This typically takes 10-15 minutes.
echo.
echo Once complete, the release will be available at:
echo https://github.com/stalecontext/mattermost-extended/releases/tag/v%VERSION%
echo.
echo Next step: Deploy to Cloudron
echo   cd ..\mattermost-cloudron-app
echo   .\deploy.bat %VERSION%
echo.
echo ================================================================================

endlocal
