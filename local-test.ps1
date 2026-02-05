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

# Enable UTF-8 for Spectre Console and suppress encoding warning
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$env:IgnoreSpectreEncoding = $true

# Try to import PwshSpectreConsole for nice progress display
$script:HasSpectre = $false
try {
    Import-Module PwshSpectreConsole -ErrorAction Stop
    $script:HasSpectre = $true
} catch {
    # Module not installed, will use fallback display
}

# Script directory and log files
$SCRIPT_DIR = $PSScriptRoot
$LOG_FILE = Join-Path $SCRIPT_DIR "local-test.log"
$SERVER_LOG = Join-Path $SCRIPT_DIR "server.log"
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
# Production Config Helpers
# ============================================================================

function Get-BackupConfig {
    <#
    .SYNOPSIS
    Reads the production config.json from the backup directory.
    Returns the config as a PSCustomObject or $null if not found.
    #>
    $backupDir = Join-Path $WORK_DIR "backup"
    $configPath = Join-Path $backupDir "data\config.json"

    if (Test-Path $configPath) {
        try {
            $content = Get-Content $configPath -Raw -Encoding UTF8
            $config = $content | ConvertFrom-Json
            "Loaded production config from: $configPath" | Out-File $LOG_FILE -Append -Encoding UTF8
            return $config
        } catch {
            Log-Warning "Failed to parse backup config.json: $_"
            return $null
        }
    } else {
        Log-Warning "Backup config.json not found at: $configPath"
        return $null
    }
}

function Get-FeatureFlagsFromDatabase {
    <#
    .SYNOPSIS
    Queries the configurations table in the database for FeatureFlags.
    Returns $null if not available or on error.
    #>

    # Check if PostgreSQL is running
    $pgRunning = docker ps --filter "name=$PG_CONTAINER" --format "{{.Names}}" 2>$null
    if (!$pgRunning) {
        return $null
    }

    try {
        # Query the configurations table for the latest config
        $query = "SELECT value FROM configurations ORDER BY id DESC LIMIT 1;"
        $result = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -t -c $query 2>$null

        if ($result) {
            $configJson = ($result -join "").Trim()
            if ($configJson) {
                $dbConfig = $configJson | ConvertFrom-Json
                if ($dbConfig.PSObject.Properties['FeatureFlags']) {
                    $flags = [ordered]@{}
                    foreach ($prop in $dbConfig.FeatureFlags.PSObject.Properties) {
                        if ($prop.Value -eq $true) {
                            $flags[$prop.Name] = $true
                        }
                    }
                    "Loaded $($flags.Count) feature flags from database" | Out-File $LOG_FILE -Append -Encoding UTF8
                    return $flags
                }
            }
        }
    } catch {
        "Failed to query database for feature flags: $_" | Out-File $LOG_FILE -Append -Encoding UTF8
    }

    return $null
}

function Get-FeatureFlagsFromBackup {
    <#
    .SYNOPSIS
    Gets FeatureFlags from production config, database, or source code.
    Falls back to parsing feature_flags.go and adding custom flags.
    #>
    param(
        [Parameter(Mandatory=$false)]
        $BackupConfig,
        [switch]$TryDatabase
    )

    $flags = [ordered]@{}

    # Try to get from backup config first
    if ($BackupConfig -and $BackupConfig.PSObject.Properties['FeatureFlags']) {
        $prodFlags = $BackupConfig.FeatureFlags
        foreach ($prop in $prodFlags.PSObject.Properties) {
            if ($prop.Value -eq $true) {
                $flags[$prop.Name] = $true
            }
        }
        "Found $($flags.Count) feature flags in production config file" | Out-File $LOG_FILE -Append -Encoding UTF8
    }

    # If no flags in config file and database is available, try database
    if ($flags.Count -eq 0 -and $TryDatabase) {
        $dbFlags = Get-FeatureFlagsFromDatabase
        if ($dbFlags) {
            $flags = $dbFlags
        }
    }

    # If no flags found, try parsing from source code
    if ($flags.Count -eq 0) {
        $featureFlagsFile = Join-Path $SCRIPT_DIR "server\public\model\feature_flags.go"
        if (Test-Path $featureFlagsFile) {
            $content = Get-Content $featureFlagsFile -Raw
            $pattern = '"(\w+)":\s*true'
            $regexMatches = [regex]::Matches($content, $pattern)
            foreach ($m in $regexMatches) {
                $flagName = $m.Groups[1].Value
                $flags[$flagName] = $true
            }
            "Parsed $($flags.Count) default feature flags from feature_flags.go" | Out-File $LOG_FILE -Append -Encoding UTF8
        }
    }

    # Always enable our custom Mattermost Extended flags
    $customFlags = @(
        "Encryption",
        "CustomChannelIcons",
        "ThreadsInSidebar",
        "CustomThreadNames",
        "ErrorLogDashboard"
    )
    foreach ($flag in $customFlags) {
        $flags[$flag] = $true
    }

    return $flags
}

function Get-MattermostExtendedSettingsFromDatabase {
    <#
    .SYNOPSIS
    Queries the configurations table in the database for MattermostExtendedSettings.
    Returns $null if not available or on error.
    #>

    # Check if PostgreSQL is running
    $pgRunning = docker ps --filter "name=$PG_CONTAINER" --format "{{.Names}}" 2>$null
    if (!$pgRunning) {
        return $null
    }

    try {
        # Query the configurations table for the latest config
        $query = "SELECT value FROM configurations ORDER BY id DESC LIMIT 1;"
        $result = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -t -c $query 2>$null

        if ($result) {
            $configJson = ($result -join "").Trim()
            if ($configJson) {
                $dbConfig = $configJson | ConvertFrom-Json
                if ($dbConfig.PSObject.Properties['MattermostExtendedSettings']) {
                    "Loaded MattermostExtendedSettings from database" | Out-File $LOG_FILE -Append -Encoding UTF8
                    return $dbConfig.MattermostExtendedSettings
                }
            }
        }
    } catch {
        "Failed to query database for MattermostExtendedSettings: $_" | Out-File $LOG_FILE -Append -Encoding UTF8
    }

    return $null
}

function Get-MattermostExtendedSettingsFromBackup {
    <#
    .SYNOPSIS
    Gets MattermostExtendedSettings from database first, then backup config, then defaults.
    Returns default settings with our tweaks enabled if not found anywhere.
    #>
    param(
        [Parameter(Mandatory=$false)]
        $BackupConfig,
        [switch]$TryDatabase
    )

    # Try database first (most authoritative source)
    if ($TryDatabase) {
        $dbSettings = Get-MattermostExtendedSettingsFromDatabase
        if ($dbSettings) {
            return $dbSettings
        }
    }

    # Try backup config file
    if ($BackupConfig -and $BackupConfig.PSObject.Properties['MattermostExtendedSettings']) {
        "Found MattermostExtendedSettings in backup config" | Out-File $LOG_FILE -Append -Encoding UTF8
        return $BackupConfig.MattermostExtendedSettings
    }

    # Return default settings with our custom tweaks enabled for local testing
    "MattermostExtendedSettings not found, using defaults with tweaks enabled" | Out-File $LOG_FILE -Append -Encoding UTF8
    return [ordered]@{
        'Posts' = [ordered]@{
            'HideDeletedMessagePlaceholder' = $true
        }
        'Channels' = [ordered]@{
            'SidebarChannelSettings' = $true
        }
    }
}

function Get-PluginSettingsFromBackup {
    <#
    .SYNOPSIS
    Gets PluginSettings from production config.
    Preserves Plugins (plugin configs) and PluginStates (enabled/disabled).
    #>
    param(
        [Parameter(Mandatory=$false)]
        $BackupConfig
    )

    if ($BackupConfig -and $BackupConfig.PSObject.Properties['PluginSettings']) {
        $ps = $BackupConfig.PluginSettings

        # Count plugins and states
        $pluginCount = 0
        $enabledCount = 0

        if ($ps.PSObject.Properties['Plugins']) {
            $pluginCount = @($ps.Plugins.PSObject.Properties).Count
        }
        if ($ps.PSObject.Properties['PluginStates']) {
            foreach ($state in $ps.PluginStates.PSObject.Properties) {
                if ($state.Value.Enable -eq $true) {
                    $enabledCount++
                }
            }
        }

        "Found plugin settings: $pluginCount plugin configs, $enabledCount enabled plugins" | Out-File $LOG_FILE -Append -Encoding UTF8
        return $ps
    }
    return $null
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
    Log "  setup       - First-time setup (extract backup, create containers)"
    Log "  start       - Start server only (requires binary to exist)"
    Log "  start-build - Start server, auto-build if binary missing"
    Log "  stop        - Stop all containers"
    Log "  status      - Show container status"
    Log "  logs        - View Mattermost server logs"
    Log "  psql        - Open PostgreSQL shell"
    Log "  clean       - Remove all test data and containers"
    Log "  build       - Build server binary for testing"
    Log "  webapp      - Build webapp from source and copy to test dir"
    Log "  dev         - Run webapp in dev mode with hot reload"
    Log "  docker      - Run using official Docker image (simpler, no code changes)"
    Log "  fix-config  - Reset config.json to clean local settings"
    Log "  kill        - Kill the running Mattermost server process"
    Log "  restart     - Quick restart: kill, build, start"
    Log "  s3-sync     - Download S3 storage files (uploads, plugins, etc.)"
    Log "  all         - Dev setup: kill, setup, build server only, start"
    Log "  all-build   - Full setup: kill, setup, build server + webapp, start"
    Log "  demo        - Create fresh demo environment (no backup needed)"
    Log ""
    Log "Configuration:"
    Log "  Edit local-test.config with your backup path and settings"
    Log ""
    Log "Workflows:"
    Log ""
    Log "  Hot reload development (recommended):"
    Log "    Terminal 1: ./local-test.ps1 all        (backend only)"
    Log "    Terminal 2: ./local-test.ps1 dev        (webpack dev server)"
    Log "    Browser:    http://localhost:9005       (webapp with hot reload)"
    Log ""
    Log "  Production-like testing (built webapp):"
    Log "    ./local-test.ps1 all-build"
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

    # [5/5] Create config file (merging production settings with local overrides)
    Log "[5/5] Creating config file..."

    # Read production config from backup
    $backupConfig = Get-BackupConfig
    $workDirUnix = $WORK_DIR -replace "\\", "/"

    # Build config object - start with production or defaults
    $config = [ordered]@{}

    # ServiceSettings - local overrides
    $config['ServiceSettings'] = [ordered]@{
        'SiteURL' = "http://localhost:$MM_PORT"
        'ListenAddress' = ":$MM_PORT"
        'EnableDeveloper' = $true
        'EnableTesting' = $false
        'AllowCorsFrom' = '*'
        'EnableLocalMode' = $false
    }

    # TeamSettings - use production if available, or defaults
    if ($backupConfig -and $backupConfig.PSObject.Properties['TeamSettings']) {
        $config['TeamSettings'] = $backupConfig.TeamSettings
    } else {
        $config['TeamSettings'] = [ordered]@{
            'SiteName' = 'Mattermost Local Test'
            'EnableUserCreation' = $true
            'EnableOpenServer' = $true
            'EnableCustomUserStatuses' = $true
            'EnableLastActiveTime' = $true
        }
    }

    # SqlSettings - local database
    $config['SqlSettings'] = [ordered]@{
        'DriverName' = 'postgres'
        'DataSource' = "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"
        'DataSourceReplicas' = @()
        'MaxIdleConns' = 20
        'MaxOpenConns' = 300
    }

    # FileSettings - local storage (not S3)
    $config['FileSettings'] = [ordered]@{
        'DriverName' = 'local'
        'Directory' = "$workDirUnix/data"
        'EnableFileAttachments' = $true
        'EnablePublicLink' = $true
    }

    # LogSettings - local logging
    $config['LogSettings'] = [ordered]@{
        'EnableConsole' = $true
        'ConsoleLevel' = 'DEBUG'
        'ConsoleJson' = $false
        'EnableFile' = $true
        'FileLevel' = 'INFO'
        'FileJson' = $false
        'FileLocation' = "$workDirUnix"
    }

    # PluginSettings - merge production plugin configs with local paths
    $prodPluginSettings = Get-PluginSettingsFromBackup -BackupConfig $backupConfig
    $config['PluginSettings'] = [ordered]@{
        'Enable' = $true
        'EnableUploads' = $true
        'Directory' = "$workDirUnix/data/plugins"
        'ClientDirectory' = "$workDirUnix/data/client/plugins"
    }
    # Add production plugin configs and states if available
    if ($prodPluginSettings) {
        if ($prodPluginSettings.PSObject.Properties['Plugins']) {
            $config['PluginSettings']['Plugins'] = $prodPluginSettings.Plugins
        }
        if ($prodPluginSettings.PSObject.Properties['PluginStates']) {
            $config['PluginSettings']['PluginStates'] = $prodPluginSettings.PluginStates
        }
        if ($prodPluginSettings.PSObject.Properties['EnableMarketplace']) {
            $config['PluginSettings']['EnableMarketplace'] = $prodPluginSettings.EnableMarketplace
        }
        if ($prodPluginSettings.PSObject.Properties['EnableRemoteMarketplace']) {
            $config['PluginSettings']['EnableRemoteMarketplace'] = $prodPluginSettings.EnableRemoteMarketplace
        }
        if ($prodPluginSettings.PSObject.Properties['RequirePluginSignature']) {
            $config['PluginSettings']['RequirePluginSignature'] = $prodPluginSettings.RequirePluginSignature
        }
    }

    # EmailSettings - disable email in local
    $config['EmailSettings'] = [ordered]@{
        'EnableSignUpWithEmail' = $true
        'EnableSignInWithEmail' = $true
        'EnableSignInWithUsername' = $true
        'SendEmailNotifications' = $false
        'RequireEmailVerification' = $false
    }

    # RateLimitSettings - disable for local testing
    $config['RateLimitSettings'] = [ordered]@{
        'Enable' = $false
    }

    # PrivacySettings - use production or defaults
    if ($backupConfig -and $backupConfig.PSObject.Properties['PrivacySettings']) {
        $config['PrivacySettings'] = $backupConfig.PrivacySettings
    } else {
        $config['PrivacySettings'] = [ordered]@{
            'ShowEmailAddress' = $true
            'ShowFullName' = $true
        }
    }

    # FeatureFlags - from backup + custom Mattermost Extended flags
    $featureFlags = Get-FeatureFlagsFromBackup -BackupConfig $backupConfig -TryDatabase
    $config['FeatureFlags'] = $featureFlags

    # MattermostExtendedSettings - from database, backup, or defaults
    $extSettings = Get-MattermostExtendedSettingsFromBackup -BackupConfig $backupConfig -TryDatabase
    $config['MattermostExtendedSettings'] = $extSettings

    # Write config as JSON
    $configPath = Join-Path $WORK_DIR "config.json"
    $configJson = $config | ConvertTo-Json -Depth 10
    # Write without BOM (Go's JSON parser doesn't like BOM)
    [System.IO.File]::WriteAllText($configPath, $configJson)

    # Log what we loaded
    $pluginCount = 0
    $enabledCount = 0
    if ($config['PluginSettings']['Plugins']) {
        $pluginCount = @($config['PluginSettings']['Plugins'].PSObject.Properties).Count
    }
    if ($config['PluginSettings']['PluginStates']) {
        foreach ($state in $config['PluginSettings']['PluginStates'].PSObject.Properties) {
            if ($state.Value.Enable -eq $true) {
                $enabledCount++
            }
        }
    }
    # Count extended settings
    $extSettingsDesc = @()
    if ($extSettings.PSObject.Properties['Posts'] -and $extSettings.Posts.PSObject.Properties['HideDeletedMessagePlaceholder'] -and $extSettings.Posts.HideDeletedMessagePlaceholder -eq $true) {
        $extSettingsDesc += "HideDeletedPlaceholder"
    }
    if ($extSettings.PSObject.Properties['Channels'] -and $extSettings.Channels.PSObject.Properties['SidebarChannelSettings'] -and $extSettings.Channels.SidebarChannelSettings -eq $true) {
        $extSettingsDesc += "SidebarChannelSettings"
    }

    Log "Config file created: $configPath"
    Log "  - Plugin configs: $pluginCount, Enabled plugins: $enabledCount"
    Log "  - Feature flags: $($featureFlags.Count) ($(($featureFlags.Keys | Sort-Object) -join ', '))"
    if ($extSettingsDesc.Count -gt 0) {
        Log "  - Extended tweaks: $($extSettingsDesc -join ', ')"
    } else {
        Log "  - Extended tweaks: (none enabled)"
    }

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

function Invoke-WebappDev {
    Log ""
    Log "=== Starting Webapp in Development Mode ==="
    Log ""
    Log "This runs the webapp with hot reloading and FULL error messages."
    Log "Useful for debugging React errors like #130."
    Log ""

    # Check Node.js version
    $nodeVersion = node --version 2>$null
    if (!$nodeVersion) {
        Log-Error "Node.js is not installed."
        exit 1
    }

    $webappDir = Join-Path $SCRIPT_DIR "webapp\channels"

    # Check if node_modules exists
    $nodeModules = Join-Path $webappDir "node_modules"
    if (!(Test-Path $nodeModules)) {
        Log "node_modules not found. Running npm install first..."
        Push-Location (Join-Path $SCRIPT_DIR "webapp")
        $env:NODE_OPTIONS = "--max-old-space-size=8192"
        $result = & npm install --force --legacy-peer-deps 2>&1
        if ($LASTEXITCODE -ne 0) {
            Log-Error "npm install failed"
            Pop-Location
            exit 1
        }
        Pop-Location
    }

    # Separate log file for webapp output
    $WEBAPP_LOG = Join-Path $SCRIPT_DIR "webapp.log"

    # Initialize webapp log file
    "=" * 80 | Out-File $WEBAPP_LOG -Encoding UTF8
    "Webapp dev server started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $WEBAPP_LOG -Append -Encoding UTF8
    "=" * 80 | Out-File $WEBAPP_LOG -Append -Encoding UTF8

    Log "Starting development server..."
    Log "The webapp will proxy API requests to http://localhost:$MM_PORT"
    Log ""
    Log "Console output logged to: $WEBAPP_LOG"
    Log "Press Ctrl+C to stop"
    Log ""

    Push-Location $webappDir
    $env:NODE_OPTIONS = "--max-old-space-size=8192"

    # Run the dev server - it will show full React error messages
    # Note: The script is "dev-server" not "dev" (webpack serve --mode development)
    & npm run dev-server 2>&1 | ForEach-Object {
        $_ | Out-File $WEBAPP_LOG -Append -Encoding UTF8
        Write-Host $_
    }

    Pop-Location
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

    # Read production config from backup
    $backupConfig = Get-BackupConfig
    $workDirUnix = $WORK_DIR -replace "\\", "/"

    # Build config object - same logic as Invoke-Setup
    $config = [ordered]@{}

    # ServiceSettings - local overrides
    $config['ServiceSettings'] = [ordered]@{
        'SiteURL' = "http://localhost:$MM_PORT"
        'ListenAddress' = ":$MM_PORT"
        'EnableDeveloper' = $true
        'EnableTesting' = $false
        'AllowCorsFrom' = '*'
        'EnableLocalMode' = $false
    }

    # TeamSettings - use production if available, or defaults
    if ($backupConfig -and $backupConfig.PSObject.Properties['TeamSettings']) {
        $config['TeamSettings'] = $backupConfig.TeamSettings
    } else {
        $config['TeamSettings'] = [ordered]@{
            'SiteName' = 'Mattermost Local Test'
            'EnableUserCreation' = $true
            'EnableOpenServer' = $true
            'EnableCustomUserStatuses' = $true
            'EnableLastActiveTime' = $true
        }
    }

    # SqlSettings - local database
    $config['SqlSettings'] = [ordered]@{
        'DriverName' = 'postgres'
        'DataSource' = "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"
        'DataSourceReplicas' = @()
        'MaxIdleConns' = 20
        'MaxOpenConns' = 300
    }

    # FileSettings - local storage (not S3)
    $config['FileSettings'] = [ordered]@{
        'DriverName' = 'local'
        'Directory' = "$workDirUnix/data"
        'EnableFileAttachments' = $true
        'EnablePublicLink' = $true
    }

    # LogSettings - local logging
    $config['LogSettings'] = [ordered]@{
        'EnableConsole' = $true
        'ConsoleLevel' = 'DEBUG'
        'ConsoleJson' = $false
        'EnableFile' = $true
        'FileLevel' = 'INFO'
        'FileJson' = $false
        'FileLocation' = "$workDirUnix"
    }

    # PluginSettings - merge production plugin configs with local paths
    $prodPluginSettings = Get-PluginSettingsFromBackup -BackupConfig $backupConfig
    $config['PluginSettings'] = [ordered]@{
        'Enable' = $true
        'EnableUploads' = $true
        'Directory' = "$workDirUnix/data/plugins"
        'ClientDirectory' = "$workDirUnix/data/client/plugins"
    }
    if ($prodPluginSettings) {
        if ($prodPluginSettings.PSObject.Properties['Plugins']) {
            $config['PluginSettings']['Plugins'] = $prodPluginSettings.Plugins
        }
        if ($prodPluginSettings.PSObject.Properties['PluginStates']) {
            $config['PluginSettings']['PluginStates'] = $prodPluginSettings.PluginStates
        }
        if ($prodPluginSettings.PSObject.Properties['EnableMarketplace']) {
            $config['PluginSettings']['EnableMarketplace'] = $prodPluginSettings.EnableMarketplace
        }
        if ($prodPluginSettings.PSObject.Properties['EnableRemoteMarketplace']) {
            $config['PluginSettings']['EnableRemoteMarketplace'] = $prodPluginSettings.EnableRemoteMarketplace
        }
        if ($prodPluginSettings.PSObject.Properties['RequirePluginSignature']) {
            $config['PluginSettings']['RequirePluginSignature'] = $prodPluginSettings.RequirePluginSignature
        }
    }

    # EmailSettings - disable email in local
    $config['EmailSettings'] = [ordered]@{
        'EnableSignUpWithEmail' = $true
        'EnableSignInWithEmail' = $true
        'EnableSignInWithUsername' = $true
        'SendEmailNotifications' = $false
        'RequireEmailVerification' = $false
    }

    # RateLimitSettings - disable for local testing
    $config['RateLimitSettings'] = [ordered]@{
        'Enable' = $false
    }

    # PrivacySettings - use production or defaults
    if ($backupConfig -and $backupConfig.PSObject.Properties['PrivacySettings']) {
        $config['PrivacySettings'] = $backupConfig.PrivacySettings
    } else {
        $config['PrivacySettings'] = [ordered]@{
            'ShowEmailAddress' = $true
            'ShowFullName' = $true
        }
    }

    # FeatureFlags - from backup + custom Mattermost Extended flags
    $featureFlags = Get-FeatureFlagsFromBackup -BackupConfig $backupConfig -TryDatabase
    $config['FeatureFlags'] = $featureFlags

    # MattermostExtendedSettings - from database, backup, or defaults
    $extSettings = Get-MattermostExtendedSettingsFromBackup -BackupConfig $backupConfig -TryDatabase
    $config['MattermostExtendedSettings'] = $extSettings

    # Write config as JSON
    $configJson = $config | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($configPath, $configJson)

    # Log what we loaded
    $pluginCount = 0
    $enabledCount = 0
    if ($config['PluginSettings']['Plugins']) {
        $pluginCount = @($config['PluginSettings']['Plugins'].PSObject.Properties).Count
    }
    if ($config['PluginSettings']['PluginStates']) {
        foreach ($state in $config['PluginSettings']['PluginStates'].PSObject.Properties) {
            if ($state.Value.Enable -eq $true) {
                $enabledCount++
            }
        }
    }

    # Count extended settings
    $extSettingsDesc = @()
    if ($extSettings.PSObject.Properties['Posts'] -and $extSettings.Posts.PSObject.Properties['HideDeletedMessagePlaceholder'] -and $extSettings.Posts.HideDeletedMessagePlaceholder -eq $true) {
        $extSettingsDesc += "HideDeletedPlaceholder"
    }
    if ($extSettings.PSObject.Properties['Channels'] -and $extSettings.Channels.PSObject.Properties['SidebarChannelSettings'] -and $extSettings.Channels.SidebarChannelSettings -eq $true) {
        $extSettingsDesc += "SidebarChannelSettings"
    }

    Log ""
    Log-Success "Config reset to clean local settings with production plugin configs."
    Log ""
    Log "Key settings:"
    Log "  - Database: postgres://${PG_USER}:****@localhost:${PG_PORT}/${PG_DATABASE}"
    Log "  - Data dir: $WORK_DIR\data"
    Log "  - Plugin configs: $pluginCount, Enabled plugins: $enabledCount"
    Log "  - Feature flags: $($featureFlags.Count) ($(($featureFlags.Keys | Sort-Object) -join ', '))"
    if ($extSettingsDesc.Count -gt 0) {
        Log "  - Extended tweaks: $($extSettingsDesc -join ', ')"
    } else {
        Log "  - Extended tweaks: (none enabled)"
    }
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
        Log-Error "Server binary not found: $binaryPath"
        Log "Run './local-test.ps1 build' first, or use './local-test.ps1 start-build'"
        exit 1
    }

    # Check if config exists
    $configPath = Join-Path $WORK_DIR "config.json"
    if (!(Test-Path $configPath)) {
        Log-Error "Config not found: $configPath"
        Log "Run './local-test.ps1 setup' first"
        exit 1
    }

    Log "Starting server on http://localhost:$MM_PORT"
    Log "Press Ctrl+C to stop"
    Log ""
    Log "Server output logged to: $SERVER_LOG"
    Log ""

    # Initialize server log file
    "=" * 80 | Out-File $SERVER_LOG -Encoding UTF8
    "Server started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $SERVER_LOG -Append -Encoding UTF8
    "Command: $binaryPath server --config $configPath" | Out-File $SERVER_LOG -Append -Encoding UTF8
    "=" * 80 | Out-File $SERVER_LOG -Append -Encoding UTF8

    Push-Location $WORK_DIR

    # Run server and capture output to server log
    & $binaryPath server --config $configPath 2>&1 | ForEach-Object {
        $_ | Out-File $SERVER_LOG -Append -Encoding UTF8
        Write-Host $_
    }

    Pop-Location
}

function Invoke-StartBuild {
    Log ""
    Log "=== Starting Local Mattermost (with auto-build) ==="
    Log ""

    # Start PostgreSQL if not running
    docker start $PG_CONTAINER 2>$null | Out-Null

    # Check if binary exists, build if not
    $binaryPath = Join-Path $WORK_DIR "mattermost.exe"
    if (!(Test-Path $binaryPath)) {
        Log "Server binary not found. Building..."
        Invoke-Build
    }

    Log "Starting server on http://localhost:$MM_PORT"
    Log "Press Ctrl+C to stop"
    Log ""
    Log "Server output logged to: $SERVER_LOG"
    Log ""

    Push-Location $WORK_DIR
    $configPath = Join-Path $WORK_DIR "config.json"

    # Initialize server log file
    "=" * 80 | Out-File $SERVER_LOG -Encoding UTF8
    "Server started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $SERVER_LOG -Append -Encoding UTF8
    "Command: $binaryPath server --config $configPath" | Out-File $SERVER_LOG -Append -Encoding UTF8
    "=" * 80 | Out-File $SERVER_LOG -Append -Encoding UTF8

    # Run server and capture output to server log
    & $binaryPath server --config $configPath 2>&1 | ForEach-Object {
        $_ | Out-File $SERVER_LOG -Append -Encoding UTF8
        Write-Host $_
    }

    Pop-Location
}

function Invoke-Restart {
    Log ""
    Log "=== Restarting Local Mattermost ==="
    Log ""

    Invoke-Kill

    # Run build and wait for completion
    $binaryPath = Join-Path $WORK_DIR "mattermost.exe"
    $buildStartTime = Get-Date

    Invoke-Build

    # Verify build completed successfully
    if (!(Test-Path $binaryPath)) {
        Log-Error "Build failed - binary not found"
        exit 1
    }

    $binaryTime = (Get-Item $binaryPath).LastWriteTime
    if ($binaryTime -lt $buildStartTime) {
        Log-Error "Build may have failed - binary was not updated"
        exit 1
    }

    Log ""
    Log "Build verified, starting server..."
    Invoke-Start
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

function Invoke-Demo {
    Log ""
    Log "=== Setting up Demo Environment ==="
    Log ""
    Log "This creates a fresh Mattermost instance with demo data showcasing all features."
    Log "No backup file needed - everything is generated fresh."
    Log ""

    # Check Docker is running
    $dockerCheck = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    Log "Docker is running."

    # Create work directory
    if (!(Test-Path $WORK_DIR)) {
        New-Item -ItemType Directory -Path $WORK_DIR -Force | Out-Null
        Log "Created work directory: $WORK_DIR"
    }

    # [1/6] Create PostgreSQL container
    Log "[1/6] Creating PostgreSQL container..."
    docker rm -f $PG_CONTAINER 2>$null | Out-Null

    $pgDataPath = Join-Path $WORK_DIR "pgdata"
    if (Test-Path $pgDataPath) {
        Remove-Item -Path $pgDataPath -Recurse -Force
    }

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

    $result = & docker @dockerArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Failed to create PostgreSQL container"
        exit 1
    }

    # Wait for PostgreSQL
    Log "Waiting for PostgreSQL to be ready..."
    $maxAttempts = 30
    $attempt = 0
    do {
        Start-Sleep -Seconds 1
        $attempt++
        docker exec $PG_CONTAINER pg_isready -U $PG_USER 2>$null | Out-Null
    } while ($LASTEXITCODE -ne 0 -and $attempt -lt $maxAttempts)

    if ($LASTEXITCODE -ne 0) {
        Log-Error "PostgreSQL failed to start"
        exit 1
    }

    # Wait for database to be created
    $attempt = 0
    do {
        Start-Sleep -Seconds 1
        $attempt++
        docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -c "SELECT 1" 2>$null | Out-Null
    } while ($LASTEXITCODE -ne 0 -and $attempt -lt 10)

    Log-Success "PostgreSQL is ready."

    # [2/6] Generate demo config
    Log "[2/6] Generating demo config..."
    $configPath = Join-Path $WORK_DIR "config.json"
    $workDirUnix = $WORK_DIR -replace "\\", "/"

    # Build config as ordered hashtable (same approach as Invoke-FixConfig)
    $config = [ordered]@{}

    # ServiceSettings
    $config['ServiceSettings'] = [ordered]@{
        'SiteURL' = "http://localhost:$MM_PORT"
        'ListenAddress' = ":$MM_PORT"
        'EnableDeveloper' = $true
        'EnableTesting' = $false
        'AllowCorsFrom' = '*'
        'EnableLocalMode' = $false
    }

    # TeamSettings
    $config['TeamSettings'] = [ordered]@{
        'SiteName' = 'Mattermost Extended Demo'
        'EnableUserCreation' = $true
        'EnableOpenServer' = $true
        'EnableCustomUserStatuses' = $true
        'EnableLastActiveTime' = $true
    }

    # SqlSettings
    $config['SqlSettings'] = [ordered]@{
        'DriverName' = 'postgres'
        'DataSource' = "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"
        'DataSourceReplicas' = @()
        'MaxIdleConns' = 20
        'MaxOpenConns' = 300
    }

    # FileSettings
    $config['FileSettings'] = [ordered]@{
        'DriverName' = 'local'
        'Directory' = "$workDirUnix/data"
        'EnableFileAttachments' = $true
        'EnablePublicLink' = $true
        'MaxFileSize' = 104857600
    }

    # LogSettings
    $config['LogSettings'] = [ordered]@{
        'EnableConsole' = $true
        'ConsoleLevel' = 'DEBUG'
        'ConsoleJson' = $false
        'EnableFile' = $true
        'FileLevel' = 'INFO'
        'FileJson' = $false
        'FileLocation' = "$workDirUnix"
    }

    # PluginSettings
    $config['PluginSettings'] = [ordered]@{
        'Enable' = $true
        'EnableUploads' = $true
        'Directory' = "$workDirUnix/data/plugins"
        'ClientDirectory' = "$workDirUnix/data/client/plugins"
    }

    # EmailSettings - enable email/username login
    $config['EmailSettings'] = [ordered]@{
        'EnableSignUpWithEmail' = $true
        'EnableSignInWithEmail' = $true
        'EnableSignInWithUsername' = $true
        'SendEmailNotifications' = $false
        'RequireEmailVerification' = $false
    }

    # PasswordSettings - relaxed for demo
    $config['PasswordSettings'] = [ordered]@{
        'MinimumLength' = 5
        'Lowercase' = $false
        'Number' = $false
        'Uppercase' = $false
        'Symbol' = $false
    }

    # RateLimitSettings - disable for demo
    $config['RateLimitSettings'] = [ordered]@{
        'Enable' = $false
    }

    # FeatureFlags - ALL Mattermost Extended features enabled
    $config['FeatureFlags'] = [ordered]@{
        'Encryption' = $true
        'CustomChannelIcons' = $true
        'ThreadsInSidebar' = $true
        'CustomThreadNames' = $true
        'ErrorLogDashboard' = $true
        'SystemConsoleDarkMode' = $true
        'SystemConsoleHideEnterprise' = $true
        'SystemConsoleIcons' = $true
        'SuppressEnterpriseUpgradeChecks' = $true
        'ImageMulti' = $true
        'ImageSmaller' = $true
        'ImageCaptions' = $true
        'VideoEmbed' = $true
        'VideoLinkEmbed' = $true
        'AccurateStatuses' = $true
        'NoOffline' = $true
        'EmbedYoutube' = $true
        'SettingsResorted' = $true
        'PreferencesRevamp' = $true
        'PreferenceOverridesDashboard' = $true
        'HideUpdateStatusButton' = $true
    }

    # MattermostExtendedSettings
    $config['MattermostExtendedSettings'] = [ordered]@{
        'Posts' = [ordered]@{
            'HideDeletedMessagePlaceholder' = $true
        }
        'Channels' = [ordered]@{
            'SidebarChannelSettings' = $true
        }
        'Media' = [ordered]@{
            'MaxImageHeight' = 400
            'MaxImageWidth' = 600
            'CaptionFontSize' = 12
            'MaxVideoHeight' = 360
            'MaxVideoWidth' = 640
        }
        'Statuses' = [ordered]@{
            'InactivityTimeoutMinutes' = 5
            'HeartbeatIntervalSeconds' = 30
            'EnableStatusLogs' = $true
            'StatusLogRetentionDays' = 7
            'DNDInactivityTimeoutMinutes' = 30
        }
    }

    # LocalizationSettings
    $config['LocalizationSettings'] = [ordered]@{
        'DefaultServerLocale' = 'en'
        'DefaultClientLocale' = 'en'
        'AvailableLocales' = 'en'
    }

    # Write config
    $configJson = $config | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($configPath, $configJson)
    Log-Success "Config generated: $configPath"

    # [3/6] Create data directories
    Log "[3/6] Creating data directories..."
    $dataDir = Join-Path $WORK_DIR "data"
    $pluginsDir = Join-Path $dataDir "plugins"
    $clientPluginsDir = Join-Path $dataDir "client\plugins"

    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    New-Item -ItemType Directory -Path $pluginsDir -Force | Out-Null
    New-Item -ItemType Directory -Path $clientPluginsDir -Force | Out-Null
    Log-Success "Data directories created."

    # [4/6] Build server
    Log "[4/6] Building server..."
    Invoke-Build

    # [5/6] Generate demo data
    Log "[5/6] Generating demo data..."
    $generateScript = Join-Path $SCRIPT_DIR "demo-data\generate-demo.ps1"
    $jsonlPath = Join-Path $SCRIPT_DIR "demo-data\demo-data.jsonl"

    & powershell -File $generateScript -OutputPath $jsonlPath

    if (!(Test-Path $jsonlPath)) {
        Log-Error "Failed to generate demo data"
        exit 1
    }
    Log-Success "Demo data generated: $jsonlPath"

    # [6/6] Initialize database and import data
    Log "[6/6] Initializing database schema..."
    Log "Starting server briefly to create tables..."

    $binaryPath = Join-Path $WORK_DIR "mattermost.exe"

    # Start server in background
    $serverProcess = Start-Process -FilePath $binaryPath -ArgumentList "server", "--config", $configPath -WorkingDirectory $WORK_DIR -PassThru -NoNewWindow -RedirectStandardOutput "$WORK_DIR\init-stdout.log" -RedirectStandardError "$WORK_DIR\init-stderr.log"

    # Wait for server to initialize (check for tables)
    $timeout = 120
    $elapsed = 0
    $schemaReady = $false
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 3
        $elapsed += 3

        # Check if tables exist
        $tableCheck = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>$null
        if ($tableCheck) {
            $tableCount = [int]($tableCheck -join "").Trim()
            if ($tableCount -gt 50) {
                Log "Database schema created ($tableCount tables)"
                $schemaReady = $true
                break
            }
        }
        Log "Waiting for schema initialization... ($elapsed seconds, $tableCount tables)"
    }

    # Stop the server
    if (!$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2

    if (!$schemaReady) {
        Log-Warning "Schema initialization may have timed out. Check logs in $WORK_DIR"
    } else {
        Log-Success "Database schema initialized."
    }

    # Seed demo users directly via SQL (more reliable than bulk import)
    Log "Seeding demo users..."

    $seedTool = Join-Path $WORK_DIR "seed-demo-users.exe"
    $seedToolDir = Join-Path $SCRIPT_DIR "tools\seed-demo-users"

    # Build seed tool if not present
    if (!(Test-Path $seedTool)) {
        Log "Building seed-demo-users tool..."
        Push-Location $seedToolDir
        $result = & go build -o $seedTool . 2>&1
        Pop-Location
        if ($LASTEXITCODE -ne 0) {
            Log-Error "Failed to build seed-demo-users tool"
            $result | ForEach-Object { Log $_ }
            exit 1
        }
    }

    # Run the seed tool
    $connStr = "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"
    $seedResult = & $seedTool $connStr "demo123" 2>&1
    $seedResult | ForEach-Object { Log $_ }

    # Verify users were created
    $userCount = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -t -c "SELECT COUNT(*) FROM users" 2>$null
    if ($userCount) {
        $count = [int]($userCount -join "").Trim()
        if ($count -gt 0) {
            Log-Success "Seeded $count users successfully."
        } else {
            Log-Warning "No users were created. Check logs above."
        }
    }

    Log ""
    Log-Success "Demo environment ready!"
    Log ""
    Log "Next steps:"
    Log "  1. Run './local-test.ps1 start' to start the server"
    Log "  2. Open http://localhost:$MM_PORT"
    Log "  3. Login as 'admin' with password 'demo123'"
    Log ""
    Log "Demo users: admin, alice, bob, charlie, dana, eve (all password: demo123)"
    Log ""
    Log "All Mattermost Extended features are enabled!"
    Log ""
}

function Invoke-All {
    param(
        [switch]$BuildWebapp
    )

    $allStartTime = Get-Date
    $modeLabel = if ($BuildWebapp) { "Full Build" } else { "Dev Setup (server only)" }

    # Log to file
    "Starting $modeLabel..." | Out-File $LOG_FILE -Append -Encoding UTF8

    # Shared state for tracking progress
    $script:AllState = @{
        GoSuccess = $null
        GoOutput = @()
        WebappSuccess = $null
        WebappOutput = @()
        WebappStage = ""
        UserCount = 0
        Error = $null
        BuildWebapp = $BuildWebapp
    }

    # Path variables
    $serverDir = Join-Path $SCRIPT_DIR "server"
    $webappDir = Join-Path $SCRIPT_DIR "webapp"
    $outputPath = Join-Path $WORK_DIR "mattermost.exe"
    $clientDir = Join-Path $WORK_DIR "client"
    $pgDataPath = Join-Path $WORK_DIR "pgdata"
    $backupDir = Join-Path $WORK_DIR "backup"
    $dataDir = Join-Path $WORK_DIR "data"

    if ($script:HasSpectre) {
        # =====================================================================
        # SPECTRE CONSOLE VERSION - Nice progress display
        # =====================================================================
        $title = if ($BuildWebapp) { "Mattermost Local Test - Full Build" } else { "Mattermost Local Test - Dev Setup" }
        Write-SpectreRule $title -Color "Blue"
        Write-Host ""

        Invoke-SpectreCommandWithProgress -ScriptBlock {
            param([Spectre.Console.ProgressContext]$ctx)

            # Create all tasks upfront
            $taskKill = $ctx.AddTask("[blue]Kill server[/]")
            $taskClean = $ctx.AddTask("[blue]Clean database[/]")
            $taskPostgres = $ctx.AddTask("[blue]Start PostgreSQL[/]")
            $taskExtract = $ctx.AddTask("[blue]Extract backup[/]")
            $taskRestore = $ctx.AddTask("[blue]Restore database[/]")
            $taskConfig = $ctx.AddTask("[blue]Setup config[/]")
            $taskGo = $ctx.AddTask("[green]Go build[/]")
            $taskWebapp = if ($script:AllState.BuildWebapp) { $ctx.AddTask("[green]Webapp build[/]") } else { $null }
            $taskCopy = if ($script:AllState.BuildWebapp) { $ctx.AddTask("[blue]Copy webapp[/]") } else { $null }

            # Task 1: Kill server
            $taskKill.StartTask()
            $process = Get-Process -Name "mattermost" -ErrorAction SilentlyContinue
            if ($process) { Stop-Process -Name "mattermost" -Force }
            "Killed mattermost process" | Out-File $LOG_FILE -Append -Encoding UTF8
            $taskKill.Increment(100)

            # Task 2: Clean database
            $taskClean.StartTask()
            docker rm -f $PG_CONTAINER 2>$null | Out-Null
            if (Test-Path $pgDataPath) { Remove-Item -Path $pgDataPath -Recurse -Force }
            if (!(Test-Path $WORK_DIR)) { New-Item -ItemType Directory -Path $WORK_DIR -Force | Out-Null }
            "Cleaned database container" | Out-File $LOG_FILE -Append -Encoding UTF8
            $taskClean.Increment(100)

            # Check Docker
            $dockerCheck = docker info 2>&1
            if ($LASTEXITCODE -ne 0) {
                $script:AllState.Error = "Docker is not running"
                return
            }

            # Task 3: Start PostgreSQL (don't wait yet)
            $taskPostgres.StartTask()
            $dockerArgs = @(
                "run", "-d", "--name", $PG_CONTAINER,
                "-e", "POSTGRES_USER=$PG_USER", "-e", "POSTGRES_PASSWORD=$PG_PASSWORD",
                "-e", "POSTGRES_DB=$PG_DATABASE", "-p", "${PG_PORT}:5432",
                "-v", "${pgDataPath}:/var/lib/postgresql/data", "postgres:15-alpine"
            )
            $result = & docker @dockerArgs 2>&1
            "Started PostgreSQL container" | Out-File $LOG_FILE -Append -Encoding UTF8
            $taskPostgres.Increment(50)

            # Start parallel build jobs
            $taskGo.StartTask()
            if ($taskWebapp) { $taskWebapp.StartTask() }

            $goBuildJob = Start-Job -ScriptBlock {
                param($serverDir, $outputPath)
                Set-Location $serverDir
                $result = & go build -o $outputPath ./cmd/mattermost 2>&1
                @{ Success = ($LASTEXITCODE -eq 0); Output = $result; ExitCode = $LASTEXITCODE }
            } -ArgumentList $serverDir, $outputPath

            $webappBuildJob = $null
            if ($script:AllState.BuildWebapp) {
                $webappBuildJob = Start-Job -ScriptBlock {
                    param($webappDir)
                    Set-Location $webappDir
                    $env:NODE_OPTIONS = "--max-old-space-size=8192"
                    $output = @()
                    $output += "=== npm install ==="
                    $installResult = & npm install --force --legacy-peer-deps 2>&1
                    $output += $installResult
                    if ($LASTEXITCODE -ne 0) {
                        return @{ Success = $false; Output = $output; Stage = "npm install"; ExitCode = $LASTEXITCODE }
                    }
                    $output += ""; $output += "=== npm run build ==="
                    $buildResult = & npm run build 2>&1
                    $output += $buildResult
                    if ($LASTEXITCODE -ne 0) {
                        return @{ Success = $false; Output = $output; Stage = "npm build"; ExitCode = $LASTEXITCODE }
                    }
                    @{ Success = $true; Output = $output; Stage = "complete"; ExitCode = 0 }
                } -ArgumentList $webappDir
            }

            # Task 4: Extract backup (while builds run)
            $taskExtract.StartTask()
            $dumpFile = Join-Path $backupDir "postgresqldump"
            if (!(Test-Path $backupDir) -or !(Test-Path $dumpFile)) {
                if (Test-Path $backupDir) { Remove-Item -Path $backupDir -Recurse -Force }
                New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
                $sevenZipPath = $null
                $sevenZipCmd = Get-Command 7z -ErrorAction SilentlyContinue
                if ($sevenZipCmd) { $sevenZipPath = "7z" }
                elseif (Test-Path "C:\Program Files\7-Zip\7z.exe") { $sevenZipPath = "C:\Program Files\7-Zip\7z.exe" }
                if ($sevenZipPath) {
                    & $sevenZipPath x $BACKUP_PATH -so 2>$null | & $sevenZipPath x -si -ttar -o"$backupDir" 2>&1 | Out-Null
                } else {
                    & tar -xzf $BACKUP_PATH -C $backupDir 2>&1 | Out-Null
                }
                "Extracted backup" | Out-File $LOG_FILE -Append -Encoding UTF8
            } else {
                "Backup already extracted" | Out-File $LOG_FILE -Append -Encoding UTF8
            }
            $taskExtract.Increment(100)

            # Wait for PostgreSQL
            $maxAttempts = 30; $attempt = 0
            do {
                Start-Sleep -Seconds 1; $attempt++
                docker exec $PG_CONTAINER pg_isready -U $PG_USER 2>$null | Out-Null
            } while ($LASTEXITCODE -ne 0 -and $attempt -lt $maxAttempts)
            $attempt = 0
            do {
                Start-Sleep -Seconds 1; $attempt++
                docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -c "SELECT 1" 2>$null | Out-Null
            } while ($LASTEXITCODE -ne 0 -and $attempt -lt 10)
            "PostgreSQL ready" | Out-File $LOG_FILE -Append -Encoding UTF8
            $taskPostgres.Increment(50)

            # Task 5: Restore database
            $taskRestore.StartTask()
            $sqlDump = Join-Path $backupDir "postgresqldump"
            if (Test-Path $sqlDump) {
                Get-Content $sqlDump -Raw | docker exec -i $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE 2>&1 | Out-Null
                $userCountResult = docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -t -c "SELECT COUNT(*) FROM users" 2>$null
                if ($userCountResult) {
                    $userCountStr = ($userCountResult -join "").Trim()
                    if ($userCountStr -match '^\d+$') { $script:AllState.UserCount = [int]$userCountStr }
                }
                "Database restored ($($script:AllState.UserCount) users)" | Out-File $LOG_FILE -Append -Encoding UTF8
                if ($script:AllState.UserCount -gt 0) {
                    Reset-Passwords | Out-Null
                    "Passwords reset" | Out-File $LOG_FILE -Append -Encoding UTF8
                }
            }
            $taskRestore.Increment(100)

            # Task 6: Setup config
            $taskConfig.StartTask()
            $backupDataDir = Join-Path $backupDir "data"
            if (Test-Path $backupDataDir) {
                Copy-Item -Path "$backupDataDir\*" -Destination $dataDir -Recurse -Force -ErrorAction SilentlyContinue
            } elseif (!(Test-Path $dataDir)) {
                New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
            }
            $pluginsDir = Join-Path $dataDir "plugins"
            $clientPluginsDir = Join-Path $dataDir "client\plugins"
            if (!(Test-Path $pluginsDir)) { New-Item -ItemType Directory -Path $pluginsDir -Force | Out-Null }
            if (!(Test-Path $clientPluginsDir)) { New-Item -ItemType Directory -Path $clientPluginsDir -Force | Out-Null }

            # Build config
            $backupConfig = Get-BackupConfig
            $workDirUnix = $WORK_DIR -replace "\\", "/"
            $config = [ordered]@{}
            $config['ServiceSettings'] = [ordered]@{ 'SiteURL' = "http://localhost:$MM_PORT"; 'ListenAddress' = ":$MM_PORT"; 'EnableDeveloper' = $true; 'EnableTesting' = $false; 'AllowCorsFrom' = '*'; 'EnableLocalMode' = $false }
            if ($backupConfig -and $backupConfig.PSObject.Properties['TeamSettings']) { $config['TeamSettings'] = $backupConfig.TeamSettings }
            else { $config['TeamSettings'] = [ordered]@{ 'SiteName' = 'Mattermost Local Test'; 'EnableUserCreation' = $true; 'EnableOpenServer' = $true; 'EnableCustomUserStatuses' = $true; 'EnableLastActiveTime' = $true } }
            $config['SqlSettings'] = [ordered]@{ 'DriverName' = 'postgres'; 'DataSource' = "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"; 'DataSourceReplicas' = @(); 'MaxIdleConns' = 20; 'MaxOpenConns' = 300 }
            $config['FileSettings'] = [ordered]@{ 'DriverName' = 'local'; 'Directory' = "$workDirUnix/data"; 'EnableFileAttachments' = $true; 'EnablePublicLink' = $true }
            $config['LogSettings'] = [ordered]@{ 'EnableConsole' = $true; 'ConsoleLevel' = 'DEBUG'; 'ConsoleJson' = $false; 'EnableFile' = $true; 'FileLevel' = 'INFO'; 'FileJson' = $false; 'FileLocation' = "$workDirUnix" }
            $prodPluginSettings = Get-PluginSettingsFromBackup -BackupConfig $backupConfig
            $config['PluginSettings'] = [ordered]@{ 'Enable' = $true; 'EnableUploads' = $true; 'Directory' = "$workDirUnix/data/plugins"; 'ClientDirectory' = "$workDirUnix/data/client/plugins" }
            if ($prodPluginSettings) {
                if ($prodPluginSettings.PSObject.Properties['Plugins']) { $config['PluginSettings']['Plugins'] = $prodPluginSettings.Plugins }
                if ($prodPluginSettings.PSObject.Properties['PluginStates']) { $config['PluginSettings']['PluginStates'] = $prodPluginSettings.PluginStates }
            }
            $config['EmailSettings'] = [ordered]@{ 'EnableSignUpWithEmail' = $true; 'EnableSignInWithEmail' = $true; 'EnableSignInWithUsername' = $true; 'SendEmailNotifications' = $false; 'RequireEmailVerification' = $false }
            $config['RateLimitSettings'] = [ordered]@{ 'Enable' = $false }
            if ($backupConfig -and $backupConfig.PSObject.Properties['PrivacySettings']) { $config['PrivacySettings'] = $backupConfig.PrivacySettings }
            else { $config['PrivacySettings'] = [ordered]@{ 'ShowEmailAddress' = $true; 'ShowFullName' = $true } }
            $featureFlags = Get-FeatureFlagsFromBackup -BackupConfig $backupConfig -TryDatabase
            $config['FeatureFlags'] = $featureFlags
            $extSettings = Get-MattermostExtendedSettingsFromBackup -BackupConfig $backupConfig -TryDatabase
            $config['MattermostExtendedSettings'] = $extSettings
            $configPath = Join-Path $WORK_DIR "config.json"
            [System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 10))
            "Config created" | Out-File $LOG_FILE -Append -Encoding UTF8
            $taskConfig.Increment(100)

            # Wait for builds with progress updates
            $waitForWebapp = $script:AllState.BuildWebapp -and $webappBuildJob
            while ($goBuildJob.State -ne 'Completed' -or ($waitForWebapp -and $webappBuildJob.State -ne 'Completed')) {
                if ($goBuildJob.State -eq 'Completed' -and $taskGo.Value -lt 100) { $taskGo.Increment(100 - $taskGo.Value) }
                elseif ($taskGo.Value -lt 95) { $taskGo.Increment(2) }
                if ($waitForWebapp) {
                    if ($webappBuildJob.State -eq 'Completed' -and $taskWebapp.Value -lt 100) { $taskWebapp.Increment(100 - $taskWebapp.Value) }
                    elseif ($taskWebapp.Value -lt 95) { $taskWebapp.Increment(1) }
                }
                Start-Sleep -Milliseconds 500
            }
            $taskGo.Increment(100 - $taskGo.Value)
            if ($taskWebapp) { $taskWebapp.Increment(100 - $taskWebapp.Value) }

            # Get build results
            $goResult = Receive-Job $goBuildJob
            $script:AllState.GoSuccess = $goResult.Success
            $script:AllState.GoOutput = $goResult.Output
            $goResult.Output | Out-File $LOG_FILE -Append -Encoding UTF8
            Remove-Job $goBuildJob -Force

            if ($webappBuildJob) {
                $webappResult = Receive-Job $webappBuildJob
                $script:AllState.WebappSuccess = $webappResult.Success
                $script:AllState.WebappOutput = $webappResult.Output
                $script:AllState.WebappStage = $webappResult.Stage
                $webappResult.Output | Out-File $LOG_FILE -Append -Encoding UTF8
                Remove-Job $webappBuildJob -Force

                # Copy webapp
                if ($taskCopy) {
                    $taskCopy.StartTask()
                    if ($script:AllState.WebappSuccess) {
                        if (Test-Path $clientDir) { Remove-Item -Path $clientDir -Recurse -Force }
                        $distDir = Join-Path $webappDir "channels\dist"
                        Copy-Item -Path $distDir -Destination $clientDir -Recurse -Force
                        "Webapp copied" | Out-File $LOG_FILE -Append -Encoding UTF8
                    }
                    $taskCopy.Increment(100)
                }
            } else {
                $script:AllState.WebappSuccess = $true  # Not building, mark as success
            }
        }

        Write-Host ""

        # Check for errors
        if ($script:AllState.Error) {
            Log-Error $script:AllState.Error
            exit 1
        }
        if (-not $script:AllState.GoSuccess) {
            Log-Error "Go build failed:"
            $script:AllState.GoOutput | Select-Object -Last 20 | ForEach-Object { Write-Host $_ -ForegroundColor Red }
            exit 1
        }
        if ($script:AllState.BuildWebapp -and -not $script:AllState.WebappSuccess) {
            Log-Error "Webapp build failed at $($script:AllState.WebappStage):"
            $script:AllState.WebappOutput | Select-Object -Last 20 | ForEach-Object { Write-Host $_ -ForegroundColor Red }
            exit 1
        }

    } else {
        # =====================================================================
        # FALLBACK VERSION - Simple text output
        # =====================================================================
        Write-Host ""
        $title = if ($BuildWebapp) { "=== Mattermost Local Test - Full Build ===" } else { "=== Mattermost Local Test - Dev Setup ===" }
        Write-Host $title -ForegroundColor Cyan
        Write-Host ""

        # Simple task display
        function Show-Task { param([string]$Name, [string]$Status, [ConsoleColor]$Color = "White")
            Write-Host "  " -NoNewline
            switch ($Status) {
                "pending"  { Write-Host "[ ]" -NoNewline -ForegroundColor DarkGray }
                "running"  { Write-Host "[*]" -NoNewline -ForegroundColor Yellow }
                "done"     { Write-Host "[+]" -NoNewline -ForegroundColor Green }
                "failed"   { Write-Host "[X]" -NoNewline -ForegroundColor Red }
            }
            Write-Host " $Name" -ForegroundColor $Color
        }

        Show-Task "Kill server" "running"
        $process = Get-Process -Name "mattermost" -ErrorAction SilentlyContinue
        if ($process) { Stop-Process -Name "mattermost" -Force }

        Show-Task "Clean database" "running"
        docker rm -f $PG_CONTAINER 2>$null | Out-Null
        if (Test-Path $pgDataPath) { Remove-Item -Path $pgDataPath -Recurse -Force }
        if (!(Test-Path $WORK_DIR)) { New-Item -ItemType Directory -Path $WORK_DIR -Force | Out-Null }

        $dockerCheck = docker info 2>&1
        if ($LASTEXITCODE -ne 0) { Log-Error "Docker is not running"; exit 1 }

        Show-Task "Start PostgreSQL" "running"
        $dockerArgs = @("run", "-d", "--name", $PG_CONTAINER, "-e", "POSTGRES_USER=$PG_USER", "-e", "POSTGRES_PASSWORD=$PG_PASSWORD", "-e", "POSTGRES_DB=$PG_DATABASE", "-p", "${PG_PORT}:5432", "-v", "${pgDataPath}:/var/lib/postgresql/data", "postgres:15-alpine")
        & docker @dockerArgs 2>&1 | Out-Null

        $buildLabel = if ($BuildWebapp) { "Starting builds (Go + Webapp)..." } else { "Building Go server..." }
        Show-Task $buildLabel "running"
        $goBuildJob = Start-Job -ScriptBlock {
            param($serverDir, $outputPath)
            Set-Location $serverDir
            $result = & go build -o $outputPath ./cmd/mattermost 2>&1
            @{ Success = ($LASTEXITCODE -eq 0); Output = $result }
        } -ArgumentList $serverDir, $outputPath

        $webappBuildJob = $null
        if ($BuildWebapp) {
            $webappBuildJob = Start-Job -ScriptBlock {
                param($webappDir)
                Set-Location $webappDir
                $env:NODE_OPTIONS = "--max-old-space-size=8192"
                $output = @()
                $installResult = & npm install --force --legacy-peer-deps 2>&1
                $output += $installResult
                if ($LASTEXITCODE -ne 0) { return @{ Success = $false; Output = $output; Stage = "npm install" } }
                $buildResult = & npm run build 2>&1
                $output += $buildResult
                if ($LASTEXITCODE -ne 0) { return @{ Success = $false; Output = $output; Stage = "npm build" } }
                @{ Success = $true; Output = $output; Stage = "complete" }
            } -ArgumentList $webappDir
        }

        Show-Task "Extract backup" "running"
        $dumpFile = Join-Path $backupDir "postgresqldump"
        if (!(Test-Path $backupDir) -or !(Test-Path $dumpFile)) {
            if (Test-Path $backupDir) { Remove-Item -Path $backupDir -Recurse -Force }
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            $sevenZipPath = if (Get-Command 7z -ErrorAction SilentlyContinue) { "7z" } elseif (Test-Path "C:\Program Files\7-Zip\7z.exe") { "C:\Program Files\7-Zip\7z.exe" } else { $null }
            if ($sevenZipPath) { & $sevenZipPath x $BACKUP_PATH -so 2>$null | & $sevenZipPath x -si -ttar -o"$backupDir" 2>&1 | Out-Null }
            else { & tar -xzf $BACKUP_PATH -C $backupDir 2>&1 | Out-Null }
        }

        Write-Host "  Waiting for PostgreSQL..." -ForegroundColor DarkGray
        $maxAttempts = 30; $attempt = 0
        do { Start-Sleep -Seconds 1; $attempt++; docker exec $PG_CONTAINER pg_isready -U $PG_USER 2>$null | Out-Null } while ($LASTEXITCODE -ne 0 -and $attempt -lt $maxAttempts)
        $attempt = 0
        do { Start-Sleep -Seconds 1; $attempt++; docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE -c "SELECT 1" 2>$null | Out-Null } while ($LASTEXITCODE -ne 0 -and $attempt -lt 10)

        Show-Task "Restore database" "running"
        $sqlDump = Join-Path $backupDir "postgresqldump"
        if (Test-Path $sqlDump) {
            Get-Content $sqlDump -Raw | docker exec -i $PG_CONTAINER psql -U $PG_USER -d $PG_DATABASE 2>&1 | Out-Null
            Reset-Passwords | Out-Null
        }

        Show-Task "Setup config" "running"
        $backupDataDir = Join-Path $backupDir "data"
        if (Test-Path $backupDataDir) { Copy-Item -Path "$backupDataDir\*" -Destination $dataDir -Recurse -Force -ErrorAction SilentlyContinue }
        elseif (!(Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
        $pluginsDir = Join-Path $dataDir "plugins"; $clientPluginsDir = Join-Path $dataDir "client\plugins"
        if (!(Test-Path $pluginsDir)) { New-Item -ItemType Directory -Path $pluginsDir -Force | Out-Null }
        if (!(Test-Path $clientPluginsDir)) { New-Item -ItemType Directory -Path $clientPluginsDir -Force | Out-Null }

        $backupConfig = Get-BackupConfig; $workDirUnix = $WORK_DIR -replace "\\", "/"
        $config = [ordered]@{}
        $config['ServiceSettings'] = [ordered]@{ 'SiteURL' = "http://localhost:$MM_PORT"; 'ListenAddress' = ":$MM_PORT"; 'EnableDeveloper' = $true; 'EnableTesting' = $false; 'AllowCorsFrom' = '*'; 'EnableLocalMode' = $false }
        if ($backupConfig -and $backupConfig.PSObject.Properties['TeamSettings']) { $config['TeamSettings'] = $backupConfig.TeamSettings }
        else { $config['TeamSettings'] = [ordered]@{ 'SiteName' = 'Mattermost Local Test'; 'EnableUserCreation' = $true; 'EnableOpenServer' = $true } }
        $config['SqlSettings'] = [ordered]@{ 'DriverName' = 'postgres'; 'DataSource' = "postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}?sslmode=disable"; 'DataSourceReplicas' = @() }
        $config['FileSettings'] = [ordered]@{ 'DriverName' = 'local'; 'Directory' = "$workDirUnix/data" }
        $config['LogSettings'] = [ordered]@{ 'EnableConsole' = $true; 'ConsoleLevel' = 'DEBUG'; 'ConsoleJson' = $false; 'EnableFile' = $true; 'FileLevel' = 'INFO'; 'FileLocation' = "$workDirUnix" }
        $config['PluginSettings'] = [ordered]@{ 'Enable' = $true; 'EnableUploads' = $true; 'Directory' = "$workDirUnix/data/plugins"; 'ClientDirectory' = "$workDirUnix/data/client/plugins" }
        $config['EmailSettings'] = [ordered]@{ 'SendEmailNotifications' = $false; 'RequireEmailVerification' = $false }
        $config['RateLimitSettings'] = [ordered]@{ 'Enable' = $false }
        $featureFlags = Get-FeatureFlagsFromBackup -BackupConfig $backupConfig -TryDatabase; $config['FeatureFlags'] = $featureFlags
        $extSettings = Get-MattermostExtendedSettingsFromBackup -BackupConfig $backupConfig -TryDatabase; $config['MattermostExtendedSettings'] = $extSettings
        $configPath = Join-Path $WORK_DIR "config.json"
        [System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 10))

        Write-Host "  Waiting for builds..." -ForegroundColor DarkGray
        if ($BuildWebapp -and $webappBuildJob) {
            while ($goBuildJob.State -ne 'Completed' -or $webappBuildJob.State -ne 'Completed') {
                $goStatus = if ($goBuildJob.State -eq 'Completed') { "Done" } else { "..." }
                $webappStatus = if ($webappBuildJob.State -eq 'Completed') { "Done" } else { "..." }
                Write-Host "`r    Go: $goStatus | Webapp: $webappStatus    " -NoNewline
                Start-Sleep -Seconds 2
            }
        } else {
            while ($goBuildJob.State -ne 'Completed') {
                Write-Host "`r    Go: ...    " -NoNewline
                Start-Sleep -Seconds 2
            }
        }
        Write-Host ""

        $goResult = Receive-Job $goBuildJob
        Remove-Job $goBuildJob -Force
        if (-not $goResult.Success) { Log-Error "Go build failed"; $goResult.Output | Select-Object -Last 10 | ForEach-Object { Write-Host $_ }; exit 1 }

        if ($BuildWebapp -and $webappBuildJob) {
            $webappResult = Receive-Job $webappBuildJob
            Remove-Job $webappBuildJob -Force
            if (-not $webappResult.Success) { Log-Error "Webapp build failed at $($webappResult.Stage)"; $webappResult.Output | Select-Object -Last 10 | ForEach-Object { Write-Host $_ }; exit 1 }

            Show-Task "Copy webapp" "running"
            if (Test-Path $clientDir) { Remove-Item -Path $clientDir -Recurse -Force }
            Copy-Item -Path (Join-Path $webappDir "channels\dist") -Destination $clientDir -Recurse -Force
        }
    }

    # Summary
    $allEndTime = Get-Date
    $totalDuration = $allEndTime - $allStartTime
    Write-Host ""
    Write-Host "Setup complete in $($totalDuration.ToString('mm\:ss'))" -ForegroundColor Green
    Write-Host ""

    # Start server
    Write-Host "Starting server on http://localhost:$MM_PORT" -ForegroundColor Cyan
    if (-not $BuildWebapp) {
        Write-Host ""
        Write-Host "For hot reload, run in another terminal:" -ForegroundColor Yellow
        Write-Host "  ./local-test.ps1 dev" -ForegroundColor Yellow
        Write-Host "Then open http://localhost:9005" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Press Ctrl+C to stop"
    Write-Host ""

    Push-Location $WORK_DIR
    $binaryPath = Join-Path $WORK_DIR "mattermost.exe"
    $configPath = Join-Path $WORK_DIR "config.json"
    & $binaryPath server --config $configPath 2>&1 | ForEach-Object {
        $_ | Out-File $LOG_FILE -Append -Encoding UTF8
        Write-Host $_
    }
    Pop-Location
}

# ============================================================================
# Main Command Router
# ============================================================================

# Save original directory and restore it on exit (including Ctrl+C)
$script:OriginalDirectory = Get-Location

try {
    switch ($Command.ToLower()) {
        "help"        { Show-Help }
        "setup"       { Invoke-Setup }
        "build"       { Invoke-Build }
        "webapp"      { Invoke-Webapp }
        "webapp-dev"  { Invoke-WebappDev }
        "dev"         { Invoke-WebappDev }
        "docker"      { Invoke-Docker }
        "fix-config"  { Invoke-FixConfig }
        "start"       { Invoke-Start }
        "start-build" { Invoke-StartBuild }
        "stop"        { Invoke-Stop }
        "kill"        { Invoke-Kill }
        "restart"     { Invoke-Restart }
        "status"      { Invoke-Status }
        "logs"        { Invoke-Logs }
        "psql"        { Invoke-Psql }
        "clean"       { Invoke-Clean }
        "s3-sync"     { Invoke-S3Sync }
        "all"         { Invoke-All }
        "all-build"   { Invoke-All -BuildWebapp }
        "demo"        { Invoke-Demo }
        default       {
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
