# Local Testing Setup

## Quick Start

```batch
# First time setup (extract backup, create database)
./local-test.bat setup

# Fix config if restored from Cloudron backup
./local-test.bat fix-config

# Build and run
./local-test.bat build
./local-test.bat webapp     # Optional: only if testing webapp changes
./local-test.bat start
```

## Commands

| Command | Description |
|---------|-------------|
| `setup` | First-time setup: extract backup, create PostgreSQL, restore database |
| `start` | Start the local Mattermost server |
| `stop` | Stop PostgreSQL container |
| `status` | Show container status |
| `logs` | View PostgreSQL logs |
| `psql` | Open PostgreSQL shell |
| `clean` | Remove all test data and containers |
| `build` | Build server binary from source |
| `webapp` | Build webapp from source (requires Node 18-22) |
| `docker` | Run official Docker image (no code changes) |
| `fix-config` | Reset config.json to clean local settings |

## Workflow for Testing Code Changes

### Server-only changes (Go code)
```batch
./local-test.bat build
./local-test.bat start
```

### Webapp changes (React/TypeScript)
```batch
./local-test.bat webapp
./local-test.bat start
```

### Both server and webapp changes
```batch
./local-test.bat build
./local-test.bat webapp
./local-test.bat start
```

## Node.js Requirements

The webapp requires Node.js 18.x-22.x. If you have a different version:

### Option 1: Install nvm-windows
1. Download from: https://github.com/coreybutler/nvm-windows/releases
2. Install and restart terminal
3. Run:
   ```batch
   nvm install 20.11.0
   nvm use 20.11.0
   ```

### Option 2: Install Node 20 LTS directly
Download from: https://nodejs.org/

## Directory Structure

```
G:\mattermost-local-test\
├── backup\              # Extracted Cloudron backup
│   ├── data\            # Mattermost data files
│   └── postgresqldump   # Database dump
├── client\              # Webapp files (from build or official release)
├── data\                # Working data directory
├── plugins\             # Server plugins
├── config.json          # Local configuration
├── config.json.backup   # Backup of previous config (if fix-config was run)
├── mattermost.exe       # Built server binary
└── pgdata\              # PostgreSQL data (Docker volume)
```

## Configuration

Edit `local-test.config`:

```ini
# Path to Cloudron backup
BACKUP_PATH=G:\_Backups\Mattermost\app-backup-YYYY-MM-DD.tar.gz

# Working directory
WORK_DIR=G:\mattermost-local-test

# Server port (default: 8065)
MM_PORT=8065

# PostgreSQL settings
PG_PORT=5432
PG_USER=mmuser
PG_PASSWORD=mostest
PG_DATABASE=mattermost_test
```

## Troubleshooting

### Webapp shows only background

This usually means the config has invalid settings from Cloudron:

```batch
./local-test.bat fix-config
./local-test.bat start
```

### Database connection errors

Check PostgreSQL is running:
```batch
./local-test.bat status
docker start mm-local-postgres
```

### Webapp build fails

1. Check Node version: `node --version` (needs 18-22)
2. Clear node_modules and retry:
   ```batch
   cd webapp
   rmdir /s /q node_modules
   cd ..
   ./local-test.bat webapp
   ```

### Port already in use

Change `MM_PORT` in `local-test.config` to a different port.

## Docker Mode (Quick Testing)

If you just want to test the database/data without code changes:

```batch
./local-test.bat docker
```

This runs the official Mattermost 11.3.0 Docker image with your restored database.
