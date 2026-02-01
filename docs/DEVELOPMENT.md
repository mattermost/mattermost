# Development Guide

How to set up a local development environment for Mattermost Extended.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Local Testing with Production Data](#local-testing-with-production-data)
- [Development Workflow](#development-workflow)
- [Code Structure](#code-structure)
- [Testing Changes](#testing-changes)
- [Common Tasks](#common-tasks)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Go | 1.22+ | Server development |
| Node.js | 20+ | Webapp development |
| Docker Desktop | Latest | PostgreSQL, local testing |
| Git | Latest | Version control |
| PowerShell | 5.1+ | Windows scripts |

### Optional Software

| Software | Purpose |
|----------|---------|
| 7-Zip | Extract Cloudron backups |
| AWS CLI | Sync S3 storage files |
| VS Code | Recommended editor |

---

## Quick Start

### Clone and Build

```bash
# Clone the repository
git clone https://github.com/stalecontext/mattermost-extended.git
cd mattermost-extended

# Build server
cd server
make build-linux BUILD_ENTERPRISE=false

# Build webapp
cd ../webapp
npm ci
npm run build
```

### Quick Validation

Before pushing changes, run quick tests:

```bash
# Quick server compile check (~5-10 seconds)
./quick-test.bat

# Full local build validation
./test-build.bat
```

---

## Local Testing with Production Data

The `local-test.ps1` script provides a complete local testing environment using your production Cloudron backup.

### Initial Setup

1. **Create configuration file:**

```bash
cp local-test.config.example local-test.config
```

2. **Edit `local-test.config`:**

```ini
# Path to your Cloudron backup file
BACKUP_PATH=G:\_Backups\Mattermost\app-backup-2026-01-31.tar.gz

# Directory for extracted backup and test data
WORK_DIR=G:\mattermost-local-test

# Server port
MM_PORT=8065

# PostgreSQL settings
PG_PORT=5432
PG_USER=mmuser
PG_PASSWORD=mostest
PG_DATABASE=mattermost_test

# S3 Storage (optional - for production file sync)
S3_BUCKET=your-bucket
S3_ENDPOINT=https://s3.your-provider.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
```

3. **Run setup:**

```bash
./local-test.ps1 setup
```

### Available Commands

| Command | Description |
|---------|-------------|
| `./local-test.ps1 setup` | Extract backup, create PostgreSQL container, restore database |
| `./local-test.ps1 build` | Build server binary from source |
| `./local-test.ps1 webapp` | Build webapp (slow, only if needed) |
| `./local-test.ps1 start` | Start local Mattermost server |
| `./local-test.ps1 kill` | Stop the running server |
| `./local-test.ps1 stop` | Stop PostgreSQL container |
| `./local-test.ps1 status` | Show container status |
| `./local-test.ps1 psql` | Open PostgreSQL shell |
| `./local-test.ps1 fix-config` | Reset config.json to clean local settings |
| `./local-test.ps1 s3-sync` | Download S3 storage files |
| `./local-test.ps1 clean` | Remove all test data and containers |
| `./local-test.ps1 all` | Full setup: kill, clean DB, setup, build, webapp, start |

### Typical Development Cycle

```bash
# First time setup
./local-test.ps1 setup

# Development loop
./local-test.ps1 build      # Rebuild server with changes
./local-test.ps1 start      # Run and test at http://localhost:8065

# Make code changes...

./local-test.ps1 kill       # Stop server
./local-test.ps1 build      # Rebuild
./local-test.ps1 start      # Test again
```

---

## Development Workflow

### Making Server Changes

1. **Edit code:**
   ```bash
   code server/channels/app/your_file.go
   ```

2. **Quick compile check:**
   ```bash
   ./quick-test.bat
   ```

3. **Full test:**
   ```bash
   ./local-test.ps1 build
   ./local-test.ps1 start
   # Test at http://localhost:8065
   ```

### Making Webapp Changes

1. **Edit code:**
   ```bash
   code webapp/channels/src/components/your_component.tsx
   ```

2. **For quick iteration, use webpack dev server:**
   ```bash
   cd webapp
   npm run dev
   # Runs at localhost:9005, proxies to server at :8065
   ```

3. **For production build:**
   ```bash
   ./local-test.ps1 webapp
   ```

### Adding a New Feature Flag

1. **Add to server model:**
   ```go
   // server/public/model/feature_flags.go
   type FeatureFlags struct {
       // ... existing flags ...
       MyNewFeature bool
   }
   ```

2. **Add to admin console:**
   ```typescript
   // webapp/channels/src/components/admin_console/admin_definition.tsx
   // In mattermost_extended.subsections.features.schema.settings:
   {
       type: 'bool',
       key: 'FeatureFlags.MyNewFeature',
       label: defineMessage({...}),
       help_text: defineMessage({...}),
   }
   ```

3. **Use in server code:**
   ```go
   if a.Config().FeatureFlags.MyNewFeature {
       // Feature enabled
   }
   ```

4. **Use in webapp code:**
   ```typescript
   const config = getConfig(state);
   if (config.FeatureFlagMyNewFeature === 'true') {
       // Feature enabled
   }
   ```

---

## Code Structure

### Server Key Files

| Path | Purpose |
|------|---------|
| `server/public/model/feature_flags.go` | Feature flag definitions |
| `server/public/model/encryption_key.go` | Encryption data models |
| `server/channels/api4/encryption.go` | Encryption API endpoints |
| `server/channels/store/sqlstore/encryption_session_key_store.go` | Key storage |
| `server/config/client.go` | Config exposed to webapp |

### Webapp Key Files

| Path | Purpose |
|------|---------|
| `webapp/channels/src/utils/encryption/` | Encryption library |
| `webapp/channels/src/store/encryption_middleware.ts` | Redux decryption |
| `webapp/channels/src/components/admin_console/mattermost_extended_features.tsx` | Admin UI |
| `webapp/channels/src/components/sidebar/` | Sidebar customizations |
| `webapp/channels/src/components/threading/thread_view/` | Thread enhancements |

### Database Migrations

| Path | Purpose |
|------|---------|
| `server/channels/db/migrations/postgres/000149_create_encryption_session_keys.up.sql` | Encryption keys table |
| `server/channels/db/migrations/postgres/000150_add_channel_props.up.sql` | Channel props column |
| `server/channels/db/migrations/postgres/000151_add_thread_props.up.sql` | Thread props column |

---

## Testing Changes

### Quick Server Check

```bash
# Compiles core packages only (~5-10 seconds)
./quick-test.bat
```

### Full Build Validation

```bash
# Complete build check before pushing
./test-build.bat

# This validates:
# - Go workspace setup
# - Webapp TypeScript
# - Plugin API
# - Full server binary
```

### Manual Testing

1. Start local server: `./local-test.ps1 start`
2. Open http://localhost:8065
3. Log in with a test account
4. Test your changes

### Resetting Local Environment

```bash
# Fix config issues
./local-test.ps1 fix-config

# Complete reset
./local-test.ps1 clean
./local-test.ps1 setup
```

---

## Common Tasks

### Check Current Version

```bash
git tag --list "v*-custom.*" --sort=-v:refname | head -5
```

### View Custom Commits

```bash
# All custom commits since base version
git log --oneline master --not v11.3.0
```

### Search for Code

```bash
# Find feature flag usage
grep -r "FeatureFlags.Encryption" server/

# Find component
grep -r "EncryptionToggle" webapp/
```

### Database Access (Local)

```bash
# Open psql shell
./local-test.ps1 psql

# Run query
SELECT * FROM users LIMIT 5;
```

### Debug Logging

Add debug logs to server code:

```go
import "github.com/mattermost/mattermost/server/public/shared/mlog"

mlog.Debug("Debug message", mlog.String("key", "value"))
```

View logs:
```bash
# Logs appear in terminal when running ./local-test.ps1 start
```

---

## Troubleshooting

### "Port 8065 already in use"

```bash
./local-test.ps1 kill
./local-test.ps1 start
```

### "Database connection failed"

```bash
./local-test.ps1 status   # Check if PostgreSQL is running
./local-test.ps1 stop     # Stop it
./local-test.ps1 setup    # Restart it
```

### "Build failed"

```bash
# Check Go version
go version

# Clean and rebuild
cd server
make clean
make build-linux BUILD_ENTERPRISE=false
```

### "npm install failed"

```bash
# Clear node_modules
cd webapp
rm -rf node_modules
npm ci
```

---

## Tips

1. **Use `quick-test.bat` frequently** - It's fast and catches most issues
2. **Run `test-build.bat` before pushing** - Catches issues CI would find
3. **Keep backups current** - Sync new backups for fresh test data
4. **Use the webpack dev server** - Much faster for webapp iteration
5. **Check logs** - Most issues are visible in server logs

---

*For release process, see [Build & Deploy](BUILD_DEPLOY.md).*
