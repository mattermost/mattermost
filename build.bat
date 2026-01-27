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

:: Check for uncommitted changes
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo WARNING: You have uncommitted changes.
    echo.
    git status --short
    echo.
    set /p CONTINUE="Continue anyway? (y/N): "
    if /i not "!CONTINUE!"=="y" (
        echo Aborted.
        exit /b 1
    )
)

:: Commit any staged changes
echo Committing changes...
git add .
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo No changes to commit or commit failed.
    echo Continuing with tag creation...
)

echo.
echo Creating tag v%VERSION%...
git tag -a v%VERSION% -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo.
    echo ERROR: Failed to create tag. Tag might already exist.
    echo.
    echo To delete existing tag:
    echo   git tag -d v%VERSION%
    echo   git push origin :refs/tags/v%VERSION%
    echo.
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
