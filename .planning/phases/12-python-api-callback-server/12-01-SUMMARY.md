---
phase: 12-python-api-callback-server
plan: 01
subsystem: plugin
tags: [grpc, python, api-callback, go-plugin]

# Dependency graph
requires:
  - phase: 11-server-integration
    provides: Python plugin support in Mattermost server
provides:
  - gRPC PluginAPI server startup for Python plugins
  - MATTERMOST_PLUGIN_API_TARGET env var passed to Python subprocess
  - Proper lifecycle management (cleanup on shutdown)
affects: [python-plugins, api-access]

# Tech tracking
tech-stack:
  added: []
  patterns: [APIServerRegistrar function type for breaking import cycles]

key-files:
  created: []
  modified:
    - server/public/plugin/python_supervisor.go
    - server/public/plugin/supervisor.go
    - server/public/plugin/environment.go
    - server/channels/app/plugin.go
    - server/public/plugin/python_supervisor_test.go
    - server/public/plugin/python_integration_test.go

key-decisions:
  - "APIServerRegistrar function type to break import cycle between plugin and apiserver packages"
  - "SetAPIServerRegistrar setter on Environment for dependency injection from app layer"
  - "API server cleanup happens AFTER Python process terminates for graceful disconnect"

patterns-established:
  - "Import cycle breaking: Use function types instead of direct imports"
  - "Dependency injection: SetAPIServerRegistrar pattern for cross-package dependencies"

issues-created: []

# Metrics
duration: 45min
completed: 2026-01-20
---

# Phase 12-01: Python API Callback Server Summary

**gRPC PluginAPI server for Python plugins with MATTERMOST_PLUGIN_API_TARGET env var and proper lifecycle management**

## Performance

- **Duration:** 45 min
- **Started:** 2026-01-20T14:00:00Z
- **Completed:** 2026-01-20T14:45:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added startAPIServer function to start gRPC PluginAPI server on random port
- Created APIServerRegistrar type to break import cycle between plugin and apiserver packages
- Integrated API server lifecycle into supervisor shutdown (cleanup after Python process terminates)
- Added unit tests for API server startup and lifecycle

## Task Commits

Each task was committed atomically:

1. **Task 1: Start gRPC PluginAPI server for Python plugins** - `453ab3dc74` (feat)
2. **Task 2: Wire API server lifecycle into supervisor shutdown** - `98eb666891` (feat)
3. **Task 3: Add tests for Python API callback** - `d486fb74f6` (test)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `server/public/plugin/python_supervisor.go` - Added startAPIServer, APIServerRegistrar type, updated WithCommandFromManifest
- `server/public/plugin/supervisor.go` - Added apiServerCleanup field and shutdown call
- `server/public/plugin/environment.go` - Added apiServerRegistrar field and SetAPIServerRegistrar method
- `server/channels/app/plugin.go` - Wire up API server registrar in plugin initialization
- `server/public/plugin/python_supervisor_test.go` - Added API server tests, updated existing tests
- `server/public/plugin/python_integration_test.go` - Updated WithCommandFromManifest calls

## Decisions Made
- **APIServerRegistrar function type**: Introduced to break the import cycle between plugin package (which imports grpc) and apiserver package (which imports plugin.API). The app layer passes the registrar function.
- **Setter method pattern**: Used SetAPIServerRegistrar on Environment instead of modifying NewEnvironment signature for backward compatibility.
- **Cleanup order**: API server cleanup happens AFTER Python process terminates to allow graceful gRPC disconnect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import cycle between plugin and apiserver packages**
- **Found during:** Task 1 (startAPIServer implementation)
- **Issue:** Direct import of apiserver from plugin package creates cycle since apiserver imports plugin.API
- **Fix:** Created APIServerRegistrar function type in plugin package, registrar provided by app layer
- **Files modified:** python_supervisor.go, environment.go, app/plugin.go
- **Verification:** Build passes with no import cycle errors
- **Committed in:** 453ab3dc74 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking), 0 deferred
**Impact on plan:** Auto-fix was essential for compilation. No scope creep.

## Issues Encountered
None

## Next Phase Readiness
- Python API callback server is complete
- Python plugins can now call back to Go API via MATTERMOST_PLUGIN_API_TARGET
- Phase 12 is complete, all phases done

---
*Phase: 12-python-api-callback-server*
*Completed: 2026-01-20*
