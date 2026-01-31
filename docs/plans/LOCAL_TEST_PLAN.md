# Local Testing Setup Plan

## Current Status
The local test environment is partially working but the webapp isn't fully functional (shows background only).

## What's Already Done
1. ✅ `local-test.bat` created with setup/start/stop commands
2. ✅ `local-test.config` created with user's backup path
3. ✅ PostgreSQL container running (`mm-local-postgres`)
4. ✅ Database restored from Cloudron backup
5. ✅ Server binary built (`G:\mattermost-local-test\mattermost.exe`)
6. ✅ Client files downloaded from Mattermost 11.3.0 release
7. ✅ Server starts and responds to API ping

## Current Problem
The webapp shows only a background - likely missing configuration or the client files aren't being served correctly from the custom-built server.

## Root Cause Analysis Needed
1. The server is built from source but client files are from official 11.3.0 release
2. There may be version/hash mismatches between server and client
3. The config may be missing required settings

## Solution Options

### Option A: Use Official Release Binary (Recommended for Testing)
Instead of building from source, use the official Mattermost binary with our database:
```batch
# Download full release, use their binary + client together
# Only useful for testing database/data, not code changes
```

### Option B: Build Webapp from Source (Required for Testing Code Changes)
Need to fix Node.js version compatibility:
```batch
# Install Node.js 18.x (required by Mattermost webapp)
# Current: Node 24.x (too new)
# Use nvm-windows to switch versions
```

### Option C: Use Docker (Simplest)
Run official Mattermost Docker image with our restored database:
```batch
docker run -d --name mm-test \
  -p 8065:8065 \
  -e MM_SQLSETTINGS_DRIVERNAME=postgres \
  -e MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@host.docker.internal:5432/mattermost_test?sslmode=disable" \
  mattermost/mattermost-team-edition:11.3.0
```

## Recommended Fix Steps

### Step 1: Install Node Version Manager
```batch
# Download nvm-windows from: https://github.com/coreybutler/nvm-windows/releases
# Install it, then:
nvm install 18.20.0
nvm use 18.20.0
```

### Step 2: Build Webapp
```batch
cd G:\Modding\_Github\mattermost\webapp
npm install
npm run build
```

### Step 3: Copy Built Client to Test Dir
```batch
xcopy /E /I /Y "G:\Modding\_Github\mattermost\webapp\channels\dist" "G:\mattermost-local-test\client"
```

### Step 4: Restart Server
```batch
cd G:\Modding\_Github\mattermost
./local-test.bat stop
./local-test.bat start
```

## Directory Structure
```
G:\mattermost-local-test\
├── backup\              # Extracted Cloudron backup
│   ├── data\            # Mattermost data files
│   └── postgresqldump   # Database dump (restored)
├── client\              # Webapp files (needs rebuild)
├── data\                # Working data directory
├── config.json          # Local config
├── mattermost.exe       # Built server binary
└── pgdata\              # PostgreSQL data (Docker volume)
```

## Config File Location
`G:\mattermost-local-test\config.json` - Already configured with:
- SiteURL: http://localhost:8065
- Database: postgres://mmuser:mostest@localhost:5432/mattermost_test
- FileSettings.Directory: G:/mattermost-local-test/data

## Docker Container
- PostgreSQL: `mm-local-postgres` on port 5432
- Database: `mattermost_test`
- User: `mmuser` / Password: `mostest`

## Commands Reference
```batch
# Start PostgreSQL
docker start mm-local-postgres

# Stop PostgreSQL
docker stop mm-local-postgres

# Connect to database
docker exec -it mm-local-postgres psql -U mmuser -d mattermost_test

# Start Mattermost server
cd G:\mattermost-local-test
./mattermost.exe server --config config.json

# Check server status
curl http://localhost:8065/api/v4/system/ping
```

## Next Session TODO
1. Install nvm-windows and Node 18.x
2. Build webapp from source with our encryption changes
3. Copy built client to test directory
4. Restart and verify the full UI works
5. Test the encryption feature
