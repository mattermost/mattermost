# ============================================================================
# Mattermost Local Testing Setup
# ============================================================================
# This script sets up a local Mattermost server using a Cloudron backup
# for testing custom builds before deployment.
#
# Prerequisites:
#   - Docker Desktop installed and running
#   - 7-Zip installed (for extracting .tar.gz)
#   - Copy local-test.config.example to local-test.config and configure
#
# Usage:
#   ./local-test.ps1 setup    - First-time setup (extract backup, create DB)
#   ./local-test.ps1 start    - Start the local server
#   ./local-test.ps1 stop     - Stop the local server
#   ./local-test.ps1 status   - Check container status
#   ./local-test.ps1 logs     - View server logs
#   ./local-test.ps1 clean    - Remove all test data
# ============================================================================

param(
    [Parameter(Position = 0)]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"

# Script directory and log file
$SCRIPT_DIR = $PSScriptRoot
$LOG_FILE = Join-Path $SCRIPT_DIR "local-test.log"
$CONFIG_FILE = Join-Path $SCRIPT_DIR "local-test.config"

# Initialize log file with timestamp (clears previous log)
$script:LogStartTime = Get-Date
"=" * 80 | Out-File $LOG_FILE -Encoding UTF8
"Log started: $($script:LogStartTime.ToString('yyyy-MM-dd HH:mm:ss'))" | Out-File $LOG_FILE -Append -Encoding UTF8
"Command: $Command" | Out-File $LOG_FILE -Append -Encoding UTF8
"=" * 80 | Out-File $LOG_FILE -Append -Encoding UTF8

# Logging function - writes to both console and log file
function Log {
    param(
        [Parameter(Position = 0, ValueFromPipeline = $true)]
        [string]$Message,
        [switch]$NoNewline,
        [ConsoleColor]$ForegroundColor
    )

    $timestamp = Get-Date -Format "HH:mm:ss"
    $logMessage = "[$timestamp] $Message"

    # Write to log file
    $logMessage | Out-File $LOG_FILE -Append -Encoding UTF8

    # Write to console
    $params = @{}
    if ($NoNewline) { $params['NoNewline'] = $true }
    if ($ForegroundColor) { $params['ForegroundColor'] = $ForegroundColor }

    Write-Host $Message @params
}

function Log-Error {
    param([string]$Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    "[$timestamp] ERROR: $Message" | Out-File $LOG_FILE -Append -Encoding UTF8
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

function Log-Warning {
    param([string]$Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    "[$timestamp] WARNING: $Message" | Out-File $LOG_FILE -Append -Encoding UTF8
    Write-Host "WARNING: $Message" -ForegroundColor Yellow
}

function Log-Success {
    param([string]$Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    "[$timestamp] $Message" | Out-File $LOG_FILE -Append -Encoding UTF8
    Write-Host $Message -ForegroundColor Green
}

# Execute command and log output
function Invoke-LoggedCommand {
    param(
        [string]$Command,
        [string]$Description,
        [switch]$SuppressOutput,
        [switch]$AllowFailure
    )

    if ($Description) {
        Log $Description
    }

    "Executing: $Command" | Out-File $LOG_FILE -Append -Encoding UTF8

    if ($SuppressOutput) {
        $output = Invoke-Expression $Command 2>&1
        $output | Out-File $LOG_FILE -Append -Encoding UTF8
    } else {
        # Capture and display output while logging
        $output = Invoke-Expression $Command 2>&1 | Tee-Object -Variable capturedOutput
        $capturedOutput | Out-File $LOG_FILE -Append -Encoding UTF8
    }

    if ($LASTEXITCODE -ne 0 -and !$AllowFailure) {
        "Command failed with exit code: $LASTEXITCODE" | Out-File $LOG_FILE -Append -Encoding UTF8
        return $false
    }
    return $true
}

# Check for config file
if (!(Test-Path $CONFIG_FILE)) {
    Log-Error "local-test.config not found"
    Log "Please copy local-test.config.example to local-test.config and configure it."
    exit 1
}

# Load config
$config = @{}
Get-Content $CONFIG_FILE | ForEach-Object {
    $line = $_.Trim()
    if ($line -and !$line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            $config[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

# Extract config values
$BACKUP_PATH = $config["BACKUP_PATH"]
$WORK_DIR = $config["WORK_DIR"]
$MM_PORT = if ($config["MM_PORT"]) { $config["MM_PORT"] } else { "8065" }
$PG_PORT = if ($config["PG_PORT"]) { $config["PG_PORT"] } else { "5432" }
$PG_USER = if ($config["PG_USER"]) { $config["PG_USER"] } else { "mmuser" }
$PG_PASSWORD = if ($config["PG_PASSWORD"]) { $config["PG_PASSWORD"] } else { "mostest" }
$PG_DATABASE = if ($config["PG_DATABASE"]) { $config["PG_DATABASE"] } else { "mattermost_test" }
$S3_BUCKET = $config["S3_BUCKET"]
$S3_ENDPOINT = $config["S3_ENDPOINT"]
$S3_ACCESS_KEY = $config["S3_ACCESS_KEY"]
$S3_SECRET_KEY = $config["S3_SECRET_KEY"]

$CONTAINER_NAME = "mm-local-test"
$PG_CONTAINER = "mm-local-postgres"

# Validate required config
if (!$BACKUP_PATH) {
    Log-Error "BACKUP_PATH not set in local-test.config"
    exit 1
}
if (!$WORK_DIR) {
    Log-Error "WORK_DIR not set in local-test.config"
    exit 1
}

# Log config (excluding secrets)
"Configuration loaded:" | Out-File $LOG_FILE -Append -Encoding UTF8
"  BACKUP_PATH: $BACKUP_PATH" | Out-File $LOG_FILE -Append -Encoding UTF8
"  WORK_DIR: $WORK_DIR" | Out-File $LOG_FILE -Append -Encoding UTF8
"  MM_PORT: $MM_PORT" | Out-File $LOG_FILE -Append -Encoding UTF8
"  PG_PORT: $PG_PORT" | Out-File $LOG_FILE -Append -Encoding UTF8
"  PG_USER: $PG_USER" | Out-File $LOG_FILE -Append -Encoding UTF8
"  PG_DATABASE: $PG_DATABASE" | Out-File $LOG_FILE -Append -Encoding UTF8

# ============================================================================
# Feature Flags - Parsed from Go source
# ============================================================================

# Custom flags we want enabled for local testing (not in upstream defaults)
$CUSTOM_FEATURE_FLAGS = @(
    "Encryption",
    "CustomChannelIcons",
    "HideDeletedMessagePlaceholder",
    "ThreadsInSidebar",
    "CustomThreadNames"
)

function Get-FeatureFlagsJson {
    <#
    .SYNOPSIS
    Parses feature_flags.go to extract default feature flags and returns JSON.
    #>
    param(
        [int]$Indent = 2
    )

    $featureFlagsFile = Join-Path $SCRIPT_DIR "server\public\model\feature_flags.go"
    $flags = @{}

    if (Test-Path $featureFlagsFile) {
        $content = Get-Content $featureFlagsFile -Raw

        # Parse featureFlagDefaults map: "FlagName": true,
        $pattern = '"(\w+)":\s*true'
        $matches = [regex]::Matches($content, $pattern)

        foreach ($match in $matches) {
            $flagName = $match.Groups[1].Value
            $flags[$flagName] = $true
        }

        "Parsed $($flags.Count) default feature flags from feature_flags.go" | Out-File $LOG_FILE -Append -Encoding UTF8
    } else {
        Log-Warning "feature_flags.go not found, using empty defaults"
    }

    # Add custom flags for local testing
    foreach ($flag in $CUSTOM_FEATURE_FLAGS) {
        $flags[$flag] = $true
    }

    # Build JSON
    $indent = " " * $Indent
    $lines = @()
    $sortedKeys = $flags.Keys | Sort-Object
    $lastKey = $sortedKeys[-1]

    foreach ($key in $sortedKeys) {
        $comma = if ($key -eq $lastKey) { "" } else { "," }
        $lines += "${indent}  `"$key`": true$comma"
    }

    $json = "${indent}`"FeatureFlags`": {`n"
    $json += ($lines -join "`n")
    $json += "`n${indent}}"

    return $json
}

# ============================================================================
# Command Functions
# ============================================================================

function Show-Help {
    Log ""
    Log "Mattermost Local Testing Setup"
    Log "=============================="
    Log ""
    Log "Usage: ./local-test.ps1 [command]"
    Log ""
    Log "Commands:"
    Log "  setup     - First-time setup (extract backup, create containers)"
    Log "  start     - Start the local Mattermost server"
    Log "  stop      - Stop all containers"
    Log "  status    - Show container status"
    Log "  logs      - View Mattermost server logs"
    Log "  psql      - Open PostgreSQL shell"
    Log "  clean     - Remove all test data and containers"
    Log "  build     - Build server binary for testing"
    Log "  webapp    - Build webapp from source and copy to test dir"
    Log "  docker    - Run using official Docker image (simpler, no code changes)"
    Log "  fix-config - Reset config.json to clean local settings"
    Log "  kill      - Kill the running Mattermost server process"
    Log "  s3-sync   - Download S3 storage files (uploads, plugins, etc.)"
    Log "  all       - Run everything: kill, setup, build, webapp, start"
    Log ""
    Log "Configuration:"
    Log "  Edit local-test.config with your backup path and settings"
    Log ""
    Log "Recommended workflow for testing code changes:"
    Log "  1. ./local-test.ps1 setup     (first time only)"
    Log "  2. ./local-test.ps1 build     (build server with your changes)"
    Log "  3. ./local-test.ps1 webapp    (build webapp with your changes)"
    Log "  4. ./local-test.ps1 start     (run and test)"
    Log ""
    Log "Log file: $LOG_FILE"
    Log ""
}

function Reset-Passwords {
    $RESET_TOOL = Join-Path $WORK_DIR "reset-passwords.exe"
    $CONN_STR = "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"

    Log "Building password reset tool..."
    $toolPath = Join-Path $SCRIPT_DIR "tools\reset-passwords"

    Push-Location $toolPath
    $result = & go build -o $RESET_TOOL . 2>&1
    $result | Out-File $LOG_FILE -Append -Encoding UTF8
    Pop-Location

    if ($LASTEXITCODE -ne 0) {
        if (!(Test-Path $RESET_TOOL)) {
            Log-Error "Failed to build reset-passwords tool."
            return $false
        }
        Log-Warning "Failed to rebuild reset-passwords tool. Using existing version."
    }

    # Run the tool
    Log "Running password reset tool..."
    $result = & $RESET_TOOL $CONN_STR "test" 2>&1
    $result | Out-File $LOG_FILE -Append -Encoding UTF8
    $result | ForEach-Object { Log $_ }

    if ($LASTEXITCODE -ne 0) {
        Log-Error "Failed to reset passwords."
        return $false
    }
    return $true
}

function Invoke-Setup {
    Log ""
    Log "=== Setting up Local Test Environment ==="
    Log ""
    Log "Work directory: $WORK_DIR"
    Log "Backup: $BACKUP_PATH"
    Log ""

    # Check backup exists
    if (!(Test-Path $BACKUP_PATH)) {
        Log-Error "Backup file not found: $BACKUP_PATH"
        exit 1
    }

    # Create work directory
    if (!(Test-Path $WORK_DIR)) {
        New-Item -ItemType Directory -Path $WORK_DIR -Force | Out-Null
        Log "Created work directory: $WORK_DIR"
    }

    # Check if Docker is running
    $dockerCheck = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    Log "Docker is running."

    # [1/5] Extract backup
    Log "[1/5] Extracting backup..."
    $backupDir = Join-Path $WORK_DIR "backup"
    $dumpFile = Join-Path $backupDir "postgresqldump"

    # Check if backup needs extraction (directory missing OR dump file missing)
    if (!(Test-Path $backupDir) -or !(Test-Path $dumpFile)) {
        if (Test-Path $backupDir) {
            Log "Backup directory exists but postgresqldump not found, re-extracting..."
            Remove-Item -Path $backupDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

        # Try 7z first (check PATH and common install location), then tar
        $sevenZipPath = $null
        $sevenZipCmd = Get-Command 7z -ErrorAction SilentlyContinue
        if ($sevenZipCmd) {
            $sevenZipPath = "7z"
        } elseif (Test-Path "C:\Program Files\7-Zip\7z.exe") {
            $sevenZipPath = "C:\Program Files\7-Zip\7z.exe"
        }

        if ($sevenZipPath) {
            Log "Using 7-Zip for extraction..."
            $result = & $sevenZipPath x $BACKUP_PATH -so 2>$null | & $sevenZipPath x -si -ttar -o"$backupDir" 2>&1
            $result | Out-File $LOG_FILE -Append -Encoding UTF8
        } else {
            Log "Using tar for extraction..."
            $result = & tar -xzf $BACKUP_PATH -C $backupDir 2>&1
            $result | Out-File $LOG_FILE -Append -Encoding UTF8
        }

        if ($LASTEXITCODE -ne 0) {
            Log-Error "Failed to extract backup"
            exit 1
        }
        Log-Success "Backup extracted successfully."
    } else {
        Log "Backup already extracted, skipping..."
    }

    # [2/5] Create PostgreSQL container
    Log "[2/5] Creating PostgreSQL container..."
    docker rm -f $PG_CONTAINER 2>$null | Out-Null

    $pgDataPath = Join-Path $WORK_DIR "pgdata"
    $dockerArgs = @(
        "run", "-d",
        "--name", $PG_CONTAINER,
        "-e", "POSTGRES_USER=$PG_USER",
        "-e", "POSTGRES_PASSWORD=$PG_PASSWORD",
        "-e", "POSTGRES_DB=$PG_DATABASE",
        "-p", "${PG_PORT}:5432",
        "-v", "${pgDataPath}:/var/lib/postgresql/data",
        "postgres:15-alpine"
    )

    "Docker command: docker $($dockerArgs -join ' ')" | Out-File $LOG_FILE -Append -Encoding UTF8
    $result = & docker @dockerArgs 2>&1
    $result | Out-File $LOG_FILE -Append -Encoding UTF8

    if ($LASTEXITCODE -ne 0) {
        Log-Error "Failed to create PostgreSQL container"
        exit 1
    }

    Log "Waiting for PostgreSQL to be ready..."
    $maxAttempts = 30
    $attempt = 0
    do {
        Start-Sleep -Seconds 1
        $attempt++
        $pgReady = docker exec $PG_CONTAINER pg_isready -U $PG_USER 2>$null
    } while ($LASTEXITCODE -ne 0 -and $attempt -lt $maxAttempts)

    if ($LASTEXITCODE -ne 0) {
        Log-Error "PostgreSQL failed to start within $maxAttempts seconds"
        exit 1
    }

    # Wait for database to be created (POSTGRES_DB env var)
    Log "Waiting for database '$PG_DATABASE' to be created..."
    $attempt = 0
    do {
        Start-Sleep -Seconds 1
        $attempt++
        $dbExists = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -c "SELECT 1" 2>$null
    } while ($LASTEXITCODE -ne 0 -and $attempt -lt 10)

    if ($LASTEXITCODE -ne 0) {
        Log-Error "Database '$PG_DATABASE' was not created"
        exit 1
    }
    Log-Success "PostgreSQL is ready."

    # [3/5] Restore database from backup
    Log "[3/5] Restoring database from backup..."
    $sqlDump = $null

    # Cloudron backups use "postgresqldump" (no extension)
    $cloudronDump = Join-Path $backupDir "postgresqldump"
    if (Test-Path $cloudronDump) {
        $sqlDump = $cloudronDump
    }

    # Fallback: look for .sql or .dump files
    if (!$sqlDump) {
        $sqlDump = Get-ChildItem -Path $backupDir -Recurse -Include "*.sql", "*.dump" -File | Select-Object -First 1 -ExpandProperty FullName
    }

    if ($sqlDump) {
        Log "Found database dump: $sqlDump"

        # Use Get-Content and pipe to docker exec
        $result = Get-Content $sqlDump -Raw | docker exec -i $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE 2>&1
        "Database restore output (truncated):" | Out-File $LOG_FILE -Append -Encoding UTF8
        ($result | Select-Object -First 50) | Out-File $LOG_FILE -Append -Encoding UTF8

        # Verify restore worked by checking for users
        $userCountResult = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -t -c "SELECT COUNT(*) FROM users" 2>$null
        $userCount = 0
        if ($userCountResult) {
            # Handle array output - join and trim
            $userCountStr = ($userCountResult -join "").Trim()
            if ($userCountStr -match '^\d+$') {
                $userCount = [int]$userCountStr
            }
        }
        Log "Database restored. Found $userCount users."

        if ($userCount -gt 0) {
            Log "Resetting all user passwords to 'test'..."
            $resetResult = Reset-Passwords
            if (!$resetResult) {
                exit 1
            }
        }
    } else {
        Log-Warning "No SQL dump found in backup. Database will be empty."
    }

    # [4/5] Copy data files
    Log "[4/5] Copying data files..."
    $backupDataDir = Join-Path $backupDir "data"
    $dataDir = Join-Path $WORK_DIR "data"
    if (Test-Path $backupDataDir) {
        Copy-Item -Path "$backupDataDir\*" -Destination $dataDir -Recurse -Force -ErrorAction SilentlyContinue
        Log "Data files copied."
    } else {
        if (!(Test-Path $dataDir)) {
            New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
        }
        Log "No data directory in backup, created empty data directory."
    }

    # Ensure plugin directories exist
    $pluginsDir = Join-Path $dataDir "plugins"
    $clientPluginsDir = Join-Path $dataDir "client\plugins"
    if (!(Test-Path $pluginsDir)) {
        New-Item -ItemType Directory -Path $pluginsDir -Force | Out-Null
    }
    if (!(Test-Path $clientPluginsDir)) {
        New-Item -ItemType Directory -Path $clientPluginsDir -Force | Out-Null
    }

    # Check if plugins were restored from backup
    $pluginCount = (Get-ChildItem -Path $pluginsDir -Directory -ErrorAction SilentlyContinue).Count
    if ($pluginCount -eq 0) {
        Log-Warning "No plugins found in backup. Run './local-test.ps1 s3-sync' to download plugins from S3."
    } else {
        Log "Found $pluginCount plugins in backup."
    }

    # [5/5] Create config file
    Log "[5/5] Creating config file..."
    $workDirUnix = $WORK_DIR -replace "\\", "/"
    $featureFlagsJson = Get-FeatureFlagsJson -Indent 2
    $configContent = @"
{
  "ServiceSettings": {
    "SiteURL": "http://localhost:$MM_PORT",
    "ListenAddress": ":$MM_PORT"
  },
  "SqlSettings": {
    "DriverName": "postgres",
    "DataSource": "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"
  },
  "FileSettings": {
    "Directory": "$workDirUnix/data"
  },
  "LogSettings": {
    "EnableConsole": true,
    "ConsoleLevel": "DEBUG"
  },
  "PluginSettings": {
    "Enable": true,
    "EnableUploads": true,
    "Directory": "$workDirUnix/data/plugins",
    "ClientDirectory": "$workDirUnix/data/client/plugins"
  },
$featureFlagsJson,
  "MattermostExtendedSettings": {
  }
}
"@
    $configPath = Join-Path $WORK_DIR "config.json"
    $configContent | Out-File $configPath -Encoding UTF8
    Log "Config file created: $configPath"

    Log ""
    Log-Success "=== Setup Complete ==="
    Log ""
    Log "PostgreSQL running on port $PG_PORT"
    Log "Data directory: $WORK_DIR\data"
    Log "Config file: $WORK_DIR\config.json"
    Log "Plugins directory: $WORK_DIR\data\plugins"
    Log ""
    Log "Next steps:"
    Log "  1. Build the server: ./local-test.ps1 build"
    if ($pluginCount -eq 0) {
        Log "  2. Download plugins: ./local-test.ps1 s3-sync"
        Log "  3. Start the server: ./local-test.ps1 start"
        Log "  4. Open http://localhost:$MM_PORT in your browser"
    } else {
        Log "  2. Start the server: ./local-test.ps1 start"
        Log "  3. Open http://localhost:$MM_PORT in your browser"
    }
    Log ""
}

function Invoke-Build {
    Log ""
    Log "=== Building Mattermost Server ==="
    Log ""

    $serverDir = Join-Path $SCRIPT_DIR "server"
    $outputPath = Join-Path $WORK_DIR "mattermost.exe"

    Push-Location $serverDir
    Log "Building from: $serverDir"
    Log "Output: $outputPath"

    $result = & go build -o $outputPath ./cmd/mattermost 2>&1
    $result | Out-File $LOG_FILE -Append -Encoding UTF8
    $result | ForEach-Object { Log $_ }

    Pop-Location

    if ($LASTEXITCODE -ne 0) {
        Log-Error "Build failed"
        exit 1
    }

    Log-Success "Build complete: $outputPath"
}

function Invoke-Webapp {
    Log ""
    Log "=== Building Mattermost Webapp ==="
    Log ""

    # Check Node.js version
    $nodeVersion = node --version 2>$null
    if (!$nodeVersion) {
        Log-Error "Node.js is not installed."
        Log "Please install Node.js 18.x-22.x from https://nodejs.org/"
        exit 1
    }

    $nodeMajor = [int]($nodeVersion -replace "v(\d+)\..*", '$1')
    Log "Detected Node.js version: $nodeMajor.x"

    # Check if Node version is compatible (18-30)
    if ($nodeMajor -lt 18 -or $nodeMajor -gt 30) {
        Log-Warning "Node.js $nodeMajor.x may not be compatible."
        Log "Mattermost webapp requires Node.js 18.x-22.x"
        Log ""
        Log "Options:"
        Log "  1. Install nvm-windows: https://github.com/coreybutler/nvm-windows/releases"
        Log "     Then run: nvm install 20.11.0 && nvm use 20.11.0"
        Log "  2. Try building anyway (may work)"
        Log ""
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Log "Cancelled."
            exit 1
        }
    }

    $webappDir = Join-Path $SCRIPT_DIR "webapp"

    Log ""
    Log "[1/3] Installing dependencies..."
    Push-Location $webappDir
    $env:NODE_OPTIONS = "--max-old-space-size=8192"

    $result = & npm install --force --legacy-peer-deps 2>&1
    $result | Out-File $LOG_FILE -Append -Encoding UTF8

    if ($LASTEXITCODE -ne 0) {
        Log-Error "npm install failed"
        Pop-Location
        exit 1
    }

    Log ""
    Log "[2/3] Building webapp (this may take several minutes)..."
    $result = & npm run build 2>&1
    $result | Out-File $LOG_FILE -Append -Encoding UTF8

    if ($LASTEXITCODE -ne 0) {
        Log-Error "Webapp build failed"
        Pop-Location
        exit 1
    }

    Pop-Location

    Log ""
    Log "[3/3] Copying built webapp to test directory..."
    $clientDir = Join-Path $WORK_DIR "client"
    if (Test-Path $clientDir) {
        Remove-Item -Path $clientDir -Recurse -Force
    }

    $distDir = Join-Path $webappDir "channels\dist"
    Copy-Item -Path $distDir -Destination $clientDir -Recurse -Force

    if ($LASTEXITCODE -ne 0) {
        Log-Error "Failed to copy webapp files"
        exit 1
    }

    Log ""
    Log-Success "=== Webapp Build Complete ==="
    Log ""
    Log "Built files copied to: $clientDir"
    Log ""
    Log "Next: Run './local-test.ps1 start' to test your changes"
    Log ""
}

function Invoke-Docker {
    Log ""
    Log "=== Running Mattermost via Docker ==="
    Log ""
    Log "This mode uses the official Mattermost Docker image with your database."
    Log "Use this for quick testing when you don't need code changes."
    Log ""

    # Start PostgreSQL if not running
    docker start $PG_CONTAINER 2>$null | Out-Null

    # Stop any existing Mattermost container
    docker rm -f $CONTAINER_NAME 2>$null | Out-Null

    Log "Starting Mattermost Docker container..."
    $dataPath = Join-Path $WORK_DIR "data"

    $dockerArgs = @(
        "run", "-d",
        "--name", $CONTAINER_NAME,
        "-p", "${MM_PORT}:8065",
        "-e", "MM_SQLSETTINGS_DRIVERNAME=postgres",
        "-e", "MM_SQLSETTINGS_DATASOURCE=postgres://${PG_USER}:${PG_PASSWORD}@host.docker.internal:${PG_PORT}/${PG_DATABASE}?sslmode=disable",
        "-e", "MM_SERVICESETTINGS_SITEURL=http://localhost:$MM_PORT",
        "-v", "${dataPath}:/mattermost/data",
        "mattermost/mattermost-team-edition:11.3.0"
    )

    "Docker command: docker $($dockerArgs -join ' ')" | Out-File $LOG_FILE -Append -Encoding UTF8
    $result = & docker @dockerArgs 2>&1
    $result | Out-File $LOG_FILE -Append -Encoding UTF8

    if ($LASTEXITCODE -ne 0) {
        Log-Error "Failed to start Docker container"
        exit 1
    }

    Log ""
    Log-Success "Mattermost is starting..."
    Log "View logs: docker logs -f $CONTAINER_NAME"
    Log "Open: http://localhost:$MM_PORT"
    Log ""
    Log "To stop: docker stop $CONTAINER_NAME"
    Log ""
}

function Invoke-FixConfig {
    Log ""
    Log "=== Resetting config.json for Local Testing ==="
    Log ""

    $configPath = Join-Path $WORK_DIR "config.json"

    # Backup existing config
    if (Test-Path $configPath) {
        $backupPath = Join-Path $WORK_DIR "config.json.backup"
        Copy-Item -Path $configPath -Destination $backupPath -Force
        Log "Backed up existing config to config.json.backup"
    }

    # Create clean local config
    $workDirUnix = $WORK_DIR -replace "\\", "/"
    $featureFlagsJson = Get-FeatureFlagsJson -Indent 2
    $configContent = @"
{
  "ServiceSettings": {
    "SiteURL": "http://localhost:$MM_PORT",
    "ListenAddress": ":$MM_PORT",
    "EnableDeveloper": true,
    "EnableTesting": false,
    "AllowCorsFrom": "*",
    "EnableLocalMode": false
  },
  "TeamSettings": {
    "SiteName": "Mattermost Local Test",
    "EnableUserCreation": true,
    "EnableOpenServer": true,
    "EnableCustomUserStatuses": true,
    "EnableLastActiveTime": true
  },
  "SqlSettings": {
    "DriverName": "postgres",
    "DataSource": "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable",
    "DataSourceReplicas": [],
    "MaxIdleConns": 20,
    "MaxOpenConns": 300
  },
  "FileSettings": {
    "DriverName": "local",
    "Directory": "$workDirUnix/data",
    "EnableFileAttachments": true,
    "EnablePublicLink": true
  },
  "LogSettings": {
    "EnableConsole": true,
    "ConsoleLevel": "DEBUG",
    "ConsoleJson": false,
    "EnableFile": true,
    "FileLevel": "INFO",
    "FileJson": false,
    "FileLocation": "$workDirUnix"
  },
  "PluginSettings": {
    "Enable": true,
    "EnableUploads": true,
    "Directory": "$workDirUnix/data/plugins",
    "ClientDirectory": "$workDirUnix/data/client/plugins"
  },
  "EmailSettings": {
    "EnableSignUpWithEmail": true,
    "EnableSignInWithEmail": true,
    "EnableSignInWithUsername": true,
    "SendEmailNotifications": false,
    "RequireEmailVerification": false
  },
  "RateLimitSettings": {
    "Enable": false
  },
  "PrivacySettings": {
    "ShowEmailAddress": true,
    "ShowFullName": true
  },
$featureFlagsJson,
  "MattermostExtendedSettings": {}
}
"@
    $configContent | Out-File $configPath -Encoding UTF8

    Log ""
    Log-Success "Config reset to clean local settings."
    Log ""
    Log "Key settings:"
    Log "  - Database: postgres://${PG_USER}:****@localhost:${PG_PORT}/${PG_DATABASE}"
    Log "  - Data dir: $WORK_DIR\data"
    Log "  - Plugins enabled"
    Log "  - Email verification disabled"
    Log "  - Rate limiting disabled"
    Log ""
}

function Invoke-Start {
    Log ""
    Log "=== Starting Local Mattermost ==="
    Log ""

    # Start PostgreSQL if not running
    docker start $PG_CONTAINER 2>$null | Out-Null

    # Check if binary exists
    $binaryPath = Join-Path $WORK_DIR "mattermost.exe"
    if (!(Test-Path $binaryPath)) {
        Log "Server binary not found. Building..."
        Invoke-Build
    }

    Log "Starting server on http://localhost:$MM_PORT"
    Log "Press Ctrl+C to stop"
    Log ""

    Push-Location $WORK_DIR
    $configPath = Join-Path $WORK_DIR "config.json"

    # Run server and capture output to log
    & $binaryPath server --config $configPath 2>&1 | ForEach-Object {
        $_ | Out-File $LOG_FILE -Append -Encoding UTF8
        Write-Host $_
    }

    Pop-Location
}

function Invoke-Stop {
    Log ""
    Log "=== Stopping Local Test Environment ==="
    Log ""
    docker stop $PG_CONTAINER 2>$null | Out-Null
    Log-Success "Stopped."
}

function Invoke-Kill {
    Log ""
    Log "=== Killing Mattermost Server ==="
    Log ""

    $process = Get-Process -Name "mattermost" -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Name "mattermost" -Force
        Log-Success "Mattermost server killed."
    } else {
        Log "No running mattermost.exe found."
    }
    Log "Done."
}

function Invoke-Status {
    Log ""
    Log "=== Container Status ==="
    Log ""
    $result = docker ps -a --filter "name=$PG_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    $result | ForEach-Object { Log $_ }
    Log ""
}

function Invoke-Logs {
    docker logs -f $PG_CONTAINER
}

function Invoke-Psql {
    Log "Connecting to PostgreSQL..."
    docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE
}

function Invoke-Clean {
    Log ""
    Log "=== Cleaning Up ==="
    Log ""
    Log "This will remove all test data and containers."
    $confirm = Read-Host "Are you sure? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Log "Cancelled."
        return
    }

    docker rm -f $PG_CONTAINER 2>$null | Out-Null
    if (Test-Path $WORK_DIR) {
        Remove-Item -Path $WORK_DIR -Recurse -Force
    }
    Log-Success "Cleanup complete."
}

function Invoke-S3Sync {
    Log ""
    Log "=== Downloading S3 Storage Files ==="
    Log ""

    # Check for required S3 config
    if (!$S3_BUCKET) {
        Log-Error "S3_BUCKET not set in local-test.config"
        Log ""
        Log "Add these settings to local-test.config:"
        Log "  S3_BUCKET=mattermost-modders"
        Log "  S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com"
        Log "  S3_ACCESS_KEY=your-access-key"
        Log "  S3_SECRET_KEY=your-secret-key"
        exit 1
    }

    if (!$S3_ACCESS_KEY) {
        Log-Error "S3_ACCESS_KEY not set in local-test.config"
        exit 1
    }

    if (!$S3_SECRET_KEY) {
        Log-Error "S3_SECRET_KEY not set in local-test.config"
        exit 1
    }

    # Check if AWS CLI is installed
    $awsCli = Get-Command aws -ErrorAction SilentlyContinue
    if (!$awsCli) {
        Log-Error "AWS CLI not found."
        Log ""
        Log "Install with: winget install Amazon.AWSCLI"
        Log "Or download from: https://aws.amazon.com/cli/"
        exit 1
    }

    # Create data directory if it doesn't exist
    $dataDir = Join-Path $WORK_DIR "data"
    if (!(Test-Path $dataDir)) {
        New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    }

    Log "Bucket: $S3_BUCKET"
    Log "Endpoint: $S3_ENDPOINT"
    Log "Destination: $dataDir"
    Log ""

    # Set AWS credentials for this session
    $env:AWS_ACCESS_KEY_ID = $S3_ACCESS_KEY
    $env:AWS_SECRET_ACCESS_KEY = $S3_SECRET_KEY

    # Build endpoint URL flag if endpoint is set
    $endpointFlag = @()
    if ($S3_ENDPOINT) {
        $endpointFlag = @("--endpoint-url", $S3_ENDPOINT)
    }

    Log "Syncing files from S3 (this may take a while)..."
    Log ""

    # Try with credentials
    $result = & aws s3 sync "s3://$S3_BUCKET/" $dataDir @endpointFlag --size-only --delete 2>&1
    $result | Out-File $LOG_FILE -Append -Encoding UTF8
    $result | ForEach-Object { Log $_ }

    if ($LASTEXITCODE -ne 0) {
        Log-Error "S3 sync failed"
        exit 1
    }

    Log ""
    Log-Success "=== S3 Sync Complete ==="
    Log ""
    Log "Files downloaded to: $dataDir"
    Log ""
    Log "Contents:"
    Get-ChildItem -Path $dataDir -Name | ForEach-Object { Log "  $_" }
    Log ""
}

function Invoke-Migrate {
    param(
        [string]$SubCommand = "status"
    )

    Log ""
    Log "=== Database Migrations ==="
    Log ""

    # Check PostgreSQL is running
    $pgRunning = docker ps --filter "name=$PG_CONTAINER" --format "{{.Names}}" 2>$null
    if (!$pgRunning) {
        Log "Starting PostgreSQL..."
        docker start $PG_CONTAINER 2>$null | Out-Null
        Start-Sleep -Seconds 2
    }

    switch ($SubCommand.ToLower()) {
        "status" {
            Log "Recent migrations:"
            $result = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -c "SELECT version, name FROM db_migrations ORDER BY version DESC LIMIT 10;" 2>&1
            $result | ForEach-Object { Log $_ }
        }
        "reset-encryption" {
            Log "Resetting encryption session keys migration (149)..."

            # Drop the table
            $result = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -c "DROP TABLE IF EXISTS encryptionsessionkeys;" 2>&1
            $result | ForEach-Object { Log $_ }

            # Remove migration record
            $result = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -c "DELETE FROM db_migrations WHERE version = 149;" 2>&1
            $result | ForEach-Object { Log $_ }

            Log-Success "Migration 149 reset. It will be re-applied on next server start."
        }
        default {
            Log "Usage: ./local-test.ps1 migrate [status|reset-encryption]"
            Log ""
            Log "Commands:"
            Log "  status           - Show recent migrations"
            Log "  reset-encryption - Reset encryption session keys table (migration 149)"
        }
    }
    Log ""
}

function Invoke-All {
    Log ""
    Log "=== Running Full Setup and Build ==="
    Log ""
    Log "This will run: kill, clean database, setup, build, webapp, start"
    Log ""

    Log "[Step 1/6] Killing any running server..."
    Invoke-Kill

    Log "[Step 2/6] Cleaning database for fresh restore..."
    docker rm -f $PG_CONTAINER 2>$null | Out-Null
    $pgDataPath = Join-Path $WORK_DIR "pgdata"
    if (Test-Path $pgDataPath) {
        Remove-Item -Path $pgDataPath -Recurse -Force
        Log "Database data removed, will restore fresh from backup."
    }

    Log "[Step 3/6] Setting up environment..."
    Invoke-Setup

    Log "[Step 4/6] Building server..."
    Invoke-Build

    Log "[Step 5/6] Building webapp..."
    Invoke-Webapp

    Log "[Step 6/6] Starting server..."
    Invoke-Start
}

# ============================================================================
# Main Command Router
# ============================================================================

# Save original directory and restore it on exit (including Ctrl+C)
$script:OriginalDirectory = Get-Location

try {
    switch ($Command.ToLower()) {
        "help"       { Show-Help }
        "setup"      { Invoke-Setup }
        "build"      { Invoke-Build }
        "webapp"     { Invoke-Webapp }
        "docker"     { Invoke-Docker }
        "fix-config" { Invoke-FixConfig }
        "start"      { Invoke-Start }
        "stop"       { Invoke-Stop }
        "kill"       { Invoke-Kill }
        "status"     { Invoke-Status }
        "logs"       { Invoke-Logs }
        "psql"       { Invoke-Psql }
        "clean"      { Invoke-Clean }
        "s3-sync"    { Invoke-S3Sync }
        "all"        { Invoke-All }
        default      {
            Log-Error "Unknown command: $Command"
            Show-Help
        }
    }
}
finally {
    # Always restore original directory, even on Ctrl+C
    Set-Location $script:OriginalDirectory

    # Log completion
    $endTime = Get-Date
    $duration = $endTime - $script:LogStartTime
    "" | Out-File $LOG_FILE -Append -Encoding UTF8
    "=" * 80 | Out-File $LOG_FILE -Append -Encoding UTF8
    "Log ended: $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))" | Out-File $LOG_FILE -Append -Encoding UTF8
    "Duration: $($duration.ToString('hh\:mm\:ss'))" | Out-File $LOG_FILE -Append -Encoding UTF8
    "=" * 80 | Out-File $LOG_FILE -Append -Encoding UTF8
}
