# Mattermost Extended - Development Guide

Custom Mattermost fork with server-side modifications. See [stalecontext/mattermost-extended](https://github.com/stalecontext/mattermost-extended).

## Development Philosophy: Test-Driven Development (TDD)

**Tests cannot run locally** - they require Linux/Docker/PostgreSQL infrastructure only available in GitHub Actions.

### TDD Workflow

```
1. Write test     → Define expected behavior in test file
2. Commit & push  → git add . && git commit -m "test: add X tests"
3. Run tests      → gh workflow run test.yml --ref $(git branch --show-current)
4. Verify FAIL    → Tests should fail (feature doesn't exist yet)
5. Implement      → Write the code to make tests pass
6. Commit & push  → git add . && git commit -m "feat: implement X"
7. Run tests      → gh workflow run test.yml --ref $(git branch --show-current)
8. Verify PASS    → All tests should pass
9. Release        → .\build.bat <version> "Description"
```

### Running Tests via GitHub CLI

```bash
# Run custom tests on current branch
gh workflow run test.yml --ref $(git branch --show-current)

# Run upstream tests (specific scope)
gh workflow run upstream-tests.yml -f test_scope=status

# Watch workflow progress
gh run watch

# View latest run
gh run list --workflow=test.yml --limit=1
```

### Test Scope Options (upstream-tests.yml)

| Scope | Tests |
|-------|-------|
| `status` | Status/Platform tests |
| `app` | App layer |
| `api` | API endpoints |
| `store` | Database layer |
| `full` | Everything |

---

## Repository Structure

| Repo | Purpose |
|------|---------|
| **mattermost** | Server + webapp (this repo) |
| **mattermost-cloudron-app** | Docker packaging for Cloudron |
| **mattermost-user-manager** | Plugins and management tools |

**Remotes:** `origin` → our fork, `upstream` → official mattermost/mattermost

---

## Quick Workflow

```bash
# 1. Write tests first (TDD!)
code server/channels/app/my_feature_test.go

# 2. Run tests to verify they fail
gh workflow run test.yml --ref $(git branch --show-current)

# 3. Implement feature
code server/channels/app/my_feature.go

# 4. Run tests to verify they pass
gh workflow run test.yml --ref $(git branch --show-current)

# 5. Release (runs tests automatically)
.\build.bat 11.3.0-custom.X "Description"
```

---

## Fork Strategy

Based on **stable release tags** (e.g., `v11.3.0`), not upstream master.

### Syncing with New Upstream Version

```bash
git fetch upstream
git checkout -b upgrade-11.4.0 v11.4.0
git log --oneline master --not v11.3.0  # List our commits
git cherry-pick <commit-hashes>          # Re-apply our changes
# Resolve conflicts, test build
git checkout master && git reset --hard upgrade-11.4.0
git push -f origin master
.\build.bat 11.4.0-custom.1 "Upgrade to 11.4.0"
```

---

## Settings Architecture

### Feature Flags
Major features gating entire functionality. Default: `false`.

| Flag | Purpose |
|------|---------|
| `AccurateStatuses` | Heartbeat-based LastActivityAt tracking |
| `NoOffline` | Prevent offline status for active users |
| `Encryption` | End-to-end message encryption |
| `CustomChannelIcons` | Custom icons for channels |
| `ThreadsInSidebar` | Threads under parent channels |
| `GuildedChatLayout` | Guilded-style UI layout |
| `ImageMulti/Smaller/Captions` | Image display options |
| `VideoEmbed/LinkEmbed` | Video player embeds |
| `EmbedYoutube` | Discord-style YouTube embeds |
| `ErrorLogDashboard` | JS error monitoring |
| `SystemConsoleDarkMode` | Admin console dark mode |
| `SettingsResorted` | Reorganized user settings |
| `PreferencesRevamp` | Shared preference definitions |
| `PreferenceOverridesDashboard` | Admin preference overrides |

### Tweaks
Small behavioral changes. Default: `false`.

| Section | Tweak | Purpose |
|---------|-------|---------|
| Posts | `HideDeletedMessagePlaceholder` | Hide "(message deleted)" |
| Channels | `SidebarChannelSettings` | Channel Settings in menu |
| Media | `MaxImageHeight/Width` | Image size limits |
| Statuses | `InactivityTimeoutMinutes` | Away timeout (default 5) |
| Statuses | `EnableStatusLogs` | Status change logging |

### Key Files

| Purpose | File |
|---------|------|
| Feature flags | `server/public/model/feature_flags.go` |
| Tweaks/Settings | `server/public/model/mattermost_extended_settings.go` |
| Client config | `server/config/client.go` |
| Admin UI | `webapp/channels/src/components/admin_console/admin_definition.tsx` |

---

## Adding Features

### New Feature Flag

1. **Server** - `server/public/model/feature_flags.go`:
   ```go
   MyFeature bool
   ```

2. **Admin UI** - `webapp/.../mattermost_extended_features.tsx`:
   ```typescript
   const MATTERMOST_EXTENDED_FLAGS = ['MyFeature', ...];
   ```

3. **Check in code**:
   ```go
   // Server
   if a.Config().FeatureFlags.MyFeature { }
   ```
   ```typescript
   // Webapp
   if (config.FeatureFlagMyFeature === 'true') { }
   ```

### New Tweak

1. **Server** - `server/public/model/mattermost_extended_settings.go`:
   ```go
   type MattermostExtendedPostsSettings struct {
       MyTweak *bool
   }
   ```

2. **Expose** - `server/config/client.go`:
   ```go
   props["MattermostExtendedMyTweak"] = strconv.FormatBool(*c.MattermostExtendedSettings.Posts.MyTweak)
   ```

3. **Admin UI** - `webapp/.../admin_definition.tsx`

### Environment Variables

```bash
# Feature flags: MM_FEATUREFLAGS_<UPPERCASE>
MM_FEATUREFLAGS_ACCURATESTATUSES=true

# Tweaks: MM_MATTERMOSTEXTENDEDSETTINGS_<SECTION>_<UPPERCASE>
MM_MATTERMOSTEXTENDEDSETTINGS_STATUSES_INACTIVITYTIMEOUTMINUTES=10
```

### Architecture Rules

1. All flags/tweaks default to `false`
2. Webapp values are strings - compare with `=== 'true'`
3. **CRITICAL**: When patching config, spread existing values:
   ```typescript
   { FeatureFlags: { ...config.FeatureFlags, MyFlag: true } }
   ```

---

## Version Numbering

- **Mattermost**: `v{base}-custom.{rev}` (e.g., `v11.3.0-custom.2`)
- **Cloudron**: `{major}.{minor}.{patch}` - bump minor for each custom version

---

## Build System

```bash
# Build & release (triggers GitHub Actions)
.\build.bat <version> "Description"

# Deploy to Cloudron (in mattermost-cloudron-app repo)
.\deploy.bat <version>
```

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | Release tags, manual | Custom test suite |
| `release.yml` | Release tags | Build artifacts |
| `upstream-tests.yml` | Manual | Upstream tests |

---

## Key Server Files

- `server/channels/app/status.go` - Status tracking
- `server/channels/app/user.go` - User management
- `server/channels/web/handlers.go` - HTTP/WebSocket
- `server/channels/store/sqlstore/status_store.go` - Database

---

## Project Skills (Gitignored)

Sensitive operational details are in `.claude/skills/` (not committed):

| Skill | Use For |
|-------|---------|
| `db-queries` | Production database access, SQL templates, container IDs |
| `deployment` | Cloudron deployment, server paths, Docker Hub |
| `local-testing` | Local server setup with production backup |

These skills contain credentials and server-specific info. Invoke with `/db-queries`, `/deployment`, or `/local-testing`.

---

## Local Testing (Manual/Browser)

Use `local-test.ps1` for running the server locally with a database backup:

```bash
./local-test.ps1 setup    # First-time: extract backup, create DB
./local-test.ps1 build    # Build server
./local-test.ps1 start    # Run at http://localhost:8065
./local-test.ps1 kill     # Stop server
```

See `local-test.config.example` for configuration.

---

## Links

- [GitHub Actions](https://github.com/stalecontext/mattermost-extended/actions)
- [Releases](https://github.com/stalecontext/mattermost-extended/releases)
- [Test Plan](./TEST_PLAN_MATTERMOST_EXTENDED.md)
