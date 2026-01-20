---
phase: 05-python-supervisor
plan: 01
subsystem: plugin-system
tags: [python, subprocess, exec, hashicorp-go-plugin, venv]

# Dependency graph
requires:
  - phase: 04-go-grpc-server
    provides: gRPC server handlers for Plugin API
provides:
  - isPythonPlugin() detection function using manifest extension or props
  - findPythonInterpreter() with venv-first discovery
  - sanitizePythonScriptPath() for path traversal prevention
  - buildPythonCommand() for exec.Cmd construction
  - WithCommandFromManifest() unified option for Go and Python plugins
affects: [05-02-python-supervisor, 06-python-sdk-core, 07-python-hook-system]

# Tech tracking
tech-stack:
  added: []
  patterns: [venv-first interpreter discovery, manifest-based runtime detection]

key-files:
  created:
    - server/public/plugin/python_supervisor.go
    - server/public/plugin/python_supervisor_test.go
  modified: []

key-decisions:
  - "Python detection via .py extension or props.runtime='python' (no schema changes needed)"
  - "SecureConfig=nil for Python (interpreter checksum meaningless)"
  - "WaitDelay=5s for graceful shutdown"
  - "Venv paths checked in order: venv/bin/python, venv/bin/python3, .venv/bin/python, .venv/bin/python3"

patterns-established:
  - "Python plugin detection: isPythonPlugin(manifest) checks extension then props"
  - "Interpreter discovery: venv first, then exec.LookPath fallback"
  - "Path sanitization: same pattern as WithExecutableFromManifest"
  - "Command configuration: WithCommandFromManifest delegates to appropriate handler"

issues-created: []

# Metrics
duration: 15min
completed: 2026-01-16
---

# Phase 05-01: Python Supervisor Summary

**Python plugin runtime detection and subprocess command construction primitives for go-plugin integration**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-16T14:35:00Z
- **Completed:** 2026-01-16T14:50:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Python plugin detection via manifest executable extension (.py) and transitional props marker
- Cross-platform venv-first Python interpreter discovery (Windows and Unix paths)
- Secure script path sanitization preventing path traversal attacks
- Unified WithCommandFromManifest option handling both Go and Python plugins
- Comprehensive test coverage including venv detection, path traversal rejection, and command construction

## Task Commits

All tasks implemented in a single cohesive commit due to tight coupling:

1. **Task 1: Python plugin detection + interpreter discovery helpers** - `7ed0d26` (feat)
2. **Task 2: Supervisor ClientConfig option for Python plugins** - `7ed0d26` (feat)
3. **Task 3: Unit tests for Python command construction** - `7ed0d26` (test)

## Files Created/Modified

- `server/public/plugin/python_supervisor.go` - Python detection, interpreter discovery, command construction
- `server/public/plugin/python_supervisor_test.go` - Test coverage for all Python supervisor helpers

## Decisions Made

1. **Python detection strategy**: Use .py extension OR props.runtime="python" to avoid Phase 9 manifest schema changes while enabling Python plugin development

2. **SecureConfig handling**: Set to nil for Python plugins because:
   - Checksum would validate Python interpreter, not plugin script
   - Interpreter is shared across plugins
   - Script integrity could be verified differently if needed

3. **Interpreter search order**: venv > .venv > python3 > python
   - Prioritizes project-specific environments
   - Never hardcodes paths (/usr/bin/python3)
   - Works with pyenv, brew, containers

4. **Path sanitization**: Reuse exact pattern from WithExecutableFromManifest
   - filepath.Clean(filepath.Join(".", executable))
   - Reject if starts with ".."
   - Maintains security boundary consistency

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## Next Phase Readiness

- Helper functions ready for Phase 05-02 (Python supervisor lifecycle)
- WithCommandFromManifest can be used as a drop-in for Python plugins once gRPC handshake is implemented
- Tests verify no regression in existing Go plugin behavior

---
*Phase: 05-python-supervisor*
*Completed: 2026-01-16*
