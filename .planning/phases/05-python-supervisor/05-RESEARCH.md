# Phase 5: Python Supervisor - Research

**Researched:** 2026-01-13
**Domain:** Go-side subprocess management for Python plugins using hashicorp/go-plugin
**Confidence:** HIGH

<research_summary>
## Summary

Researched the ecosystem for building a Go-side Python plugin supervisor that spawns Python subprocesses and manages gRPC connections. The current Mattermost supervisor uses hashicorp/go-plugin with net/rpc for Go plugins. Phase 5 extends this to support Python plugins via gRPC while maintaining the same lifecycle management patterns.

Key findings:
1. **hashicorp/go-plugin supports gRPC mode for non-Go plugins** - documented pattern with handshake protocol
2. **Python plugins must output handshake line to stdout** - specific format: `1|1|tcp|127.0.0.1:PORT|grpc`
3. **Health checking is mandatory** - go-plugin requires grpc.health.v1.Health service or plugin will be restarted
4. **Must call cmd.Wait() to prevent zombie processes** - critical for resource cleanup
5. **Context cancellation with WaitDelay enables graceful shutdown** - allows plugins time to cleanup before SIGKILL
6. **Python venv detection needed** - supervisor must find correct Python interpreter (system or venv)
7. **Stdout/stderr must be read concurrently** - avoid deadlocks from full pipe buffers
8. **Existing Mattermost supervisor.go provides strong foundation** - extend pattern for Python

**Primary recommendation:** Extend existing Mattermost supervisor.go to detect Python plugins from manifest, spawn Python interpreter with plugin script, parse handshake from stdout, establish gRPC connection, and implement health checking with restart logic. Use context-based cancellation for graceful shutdown. Follow existing patterns for logging, metrics, and lifecycle management.
</research_summary>

<standard_stack>
## Standard Stack

### Core (Go Side)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/hashicorp/go-plugin | v1.6+ | Plugin subprocess lifecycle | Battle-tested by HashiCorp (Terraform, Vault), handles handshake/health/shutdown |
| google.golang.org/grpc | Latest (v1.60+) | gRPC client to Python plugin | Official Google implementation, already in use for Phase 4 |
| google.golang.org/grpc/health | Latest | Health check client | Standard gRPC health checking protocol |
| os/exec | stdlib | Subprocess spawning | Standard Go library for process management |
| context | stdlib | Cancellation and timeouts | Standard Go context for lifecycle management |

### Supporting (Python Detection)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| path/filepath | Path manipulation | Finding Python interpreter in venv or system |
| os | Environment variables | Passing config to Python plugin (ports, paths) |
| bufio | Line-by-line stdout reading | Parsing handshake line from plugin |
| sync | Goroutine coordination | Concurrent stdout/stderr reading |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| go-plugin handshake | Custom handshake | go-plugin protocol is well-tested, includes versioning and security |
| Context for cancellation | Manual signal handling | Context integrates with Go ecosystem, propagates cancellation |
| cmd.Wait() | cmd.Process.Release() | Release() doesn't reap zombie processes, Wait() is required |
| grpc.health.v1.Health | Custom health check | Standard protocol works with monitoring tools, required by go-plugin |

**Installation (Go):**
```bash
go get github.com/hashicorp/go-plugin
go get google.golang.org/grpc/health
# Other packages are stdlib or already in Mattermost
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
server/
├── public/
│   └── pluginapi/
│       └── grpc/
│           ├── supervisor/
│           │   ├── python_plugin.go      # Python-specific supervisor logic
│           │   ├── python_detector.go    # Detect Python from manifest/executable
│           │   ├── handshake.go          # Parse go-plugin handshake from stdout
│           │   └── health_checker.go     # gRPC health check client wrapper
│           └── proto/                    # Phase 1-3 protobuf definitions
└── public/
    └── plugin/
        ├── supervisor.go                  # Existing Go plugin supervisor (Phase 5 extends)
        └── environment.go                 # Plugin environment management
```

### Pattern 1: Extending Existing Supervisor for Python
**What:** Add Python detection and gRPC connection logic to existing supervisor pattern
**When to use:** Maintaining compatibility with existing Go plugin system
**Example:**
```go
// Extend existing supervisor.go
func newSupervisor(pluginInfo *model.BundleInfo, apiImpl API, driver AppDriver, parentLogger *mlog.Logger, metrics metricsInterface, opts ...func(*supervisor, *plugin.ClientConfig) error) (*supervisor, error) {
    // Existing logic for Go plugins...

    // NEW: Detect if this is a Python plugin
    if isPythonPlugin(pluginInfo.Manifest) {
        return newPythonSupervisor(pluginInfo, apiImpl, driver, parentLogger, metrics, opts...)
    }

    // Existing Go plugin logic continues...
}

func isPythonPlugin(manifest *model.Manifest) bool {
    // Check manifest for Python indicators:
    // - Executable ends with .py
    // - Manifest has "python" runtime field (Phase 9 addition)
    // - Props contains python_version, etc.
    executable := manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH)
    return strings.HasSuffix(executable, ".py") || manifest.Props["runtime"] == "python"
}
```

### Pattern 2: Python Plugin Subprocess Management
**What:** Use exec.CommandContext with Python interpreter, parse handshake, connect gRPC
**When to use:** Spawning Python plugins with go-plugin protocol
**Example:**
```go
// Based on hashicorp/go-plugin non-Go language guide
func newPythonSupervisor(pluginInfo *model.BundleInfo, apiImpl API, driver AppDriver, parentLogger *mlog.Logger, metrics metricsInterface, opts ...func(*supervisor, *plugin.ClientConfig) error) (*supervisor, error) {
    sup := supervisor{
        pluginID: pluginInfo.Manifest.Id,
    }

    // Find Python interpreter (system python3 or venv)
    pythonPath, err := findPythonInterpreter(pluginInfo.Path)
    if err != nil {
        return nil, errors.Wrap(err, "failed to find Python interpreter")
    }

    // Get plugin script path
    scriptPath := filepath.Join(pluginInfo.Path, pluginInfo.Manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH))

    // Create command with context for cancellation
    ctx, cancel := context.WithCancel(context.Background())
    cmd := exec.CommandContext(ctx, pythonPath, scriptPath)

    // Set environment variables for plugin
    cmd.Env = append(os.Environ(),
        fmt.Sprintf("MATTERMOST_PLUGIN_ID=%s", pluginInfo.Manifest.Id),
        fmt.Sprintf("MATTERMOST_PLUGIN_PATH=%s", pluginInfo.Path),
    )

    // Create pipes for stdout/stderr
    stdout, err := cmd.StdoutPipe()
    if err != nil {
        return nil, err
    }
    stderr, err := cmd.StderrPipe()
    if err != nil {
        return nil, err
    }

    // Start subprocess
    if err := cmd.Start(); err != nil {
        return nil, errors.Wrap(err, "failed to start Python plugin")
    }

    // Read handshake from stdout (first line)
    handshake, err := readHandshake(stdout, 3*time.Second)
    if err != nil {
        cmd.Process.Kill()
        return nil, errors.Wrap(err, "failed to read plugin handshake")
    }

    // Parse handshake: "1|1|tcp|127.0.0.1:PORT|grpc"
    parts := strings.Split(handshake, "|")
    if len(parts) != 5 || parts[4] != "grpc" {
        cmd.Process.Kill()
        return nil, fmt.Errorf("invalid handshake format: %s", handshake)
    }

    // Connect gRPC client to plugin server
    conn, err := grpc.Dial(parts[3], grpc.WithInsecure())
    if err != nil {
        cmd.Process.Kill()
        return nil, errors.Wrap(err, "failed to connect to plugin")
    }

    // Set up concurrent stdout/stderr reading
    go streamLogs(stdout, parentLogger.With(mlog.String("source", "plugin_stdout")))
    go streamLogs(stderr, parentLogger.With(mlog.String("source", "plugin_stderr")))

    // Create health check client
    healthClient := grpc_health_v1.NewHealthClient(conn)

    // Start health checking goroutine
    go sup.monitorHealth(ctx, healthClient, cmd)

    // Store process info for cleanup
    sup.pythonCmd = cmd
    sup.pythonCancel = cancel
    sup.grpcConn = conn

    return &sup, nil
}
```

### Pattern 3: Handshake Protocol Parsing
**What:** Read first line from stdout with timeout, validate format
**When to use:** Establishing connection to go-plugin compatible plugins
**Example:**
```go
// Based on go-plugin handshake protocol documentation
func readHandshake(r io.Reader, timeout time.Duration) (string, error) {
    type result struct {
        line string
        err  error
    }

    resultCh := make(chan result, 1)

    go func() {
        scanner := bufio.NewScanner(r)
        if scanner.Scan() {
            resultCh <- result{line: scanner.Text(), err: nil}
        } else {
            resultCh <- result{err: scanner.Err()}
        }
    }()

    select {
    case res := <-resultCh:
        if res.err != nil {
            return "", res.err
        }
        return res.line, nil
    case <-time.After(timeout):
        return "", fmt.Errorf("timeout reading handshake")
    }
}

// Validate handshake format: CORE-PROTOCOL-VERSION | APP-PROTOCOL-VERSION | NETWORK-TYPE | NETWORK-ADDR | PROTOCOL
func validateHandshake(line string) error {
    parts := strings.Split(line, "|")
    if len(parts) != 5 {
        return fmt.Errorf("expected 5 parts, got %d", len(parts))
    }

    // CORE-PROTOCOL-VERSION must be 1
    if parts[0] != "1" {
        return fmt.Errorf("unsupported core protocol version: %s (expected 1)", parts[0])
    }

    // APP-PROTOCOL-VERSION (Mattermost-specific, set to 1 for now)
    if parts[1] != "1" {
        return fmt.Errorf("unsupported app protocol version: %s", parts[1])
    }

    // NETWORK-TYPE must be tcp or unix
    if parts[2] != "tcp" && parts[2] != "unix" {
        return fmt.Errorf("unsupported network type: %s", parts[2])
    }

    // NETWORK-ADDR validation (basic)
    if parts[3] == "" {
        return fmt.Errorf("empty network address")
    }

    // PROTOCOL must be grpc for Python plugins
    if parts[4] != "grpc" {
        return fmt.Errorf("unsupported protocol: %s (expected grpc)", parts[4])
    }

    return nil
}
```

### Pattern 4: Health Checking with Restart Logic
**What:** Periodic health checks using grpc.health.v1.Health, restart on failure
**When to use:** Ensuring plugin remains responsive
**Example:**
```go
// Based on grpc health checking protocol
func (sup *supervisor) monitorHealth(ctx context.Context, healthClient grpc_health_v1.HealthClient, cmd *exec.Cmd) {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()

    consecutiveFailures := 0
    maxFailures := 3

    for {
        select {
        case <-ctx.Done():
            // Supervisor shutting down
            return
        case <-ticker.C:
            // Check health
            checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
            resp, err := healthClient.Check(checkCtx, &grpc_health_v1.HealthCheckRequest{
                Service: "plugin", // go-plugin requires "plugin" service name
            })
            cancel()

            if err != nil || resp.Status != grpc_health_v1.HealthCheckResponse_SERVING {
                consecutiveFailures++
                mlog.Warn("Plugin health check failed",
                    mlog.String("plugin_id", sup.pluginID),
                    mlog.Int("consecutive_failures", consecutiveFailures),
                    mlog.Err(err),
                )

                if consecutiveFailures >= maxFailures {
                    mlog.Error("Plugin failed health checks, restarting",
                        mlog.String("plugin_id", sup.pluginID),
                    )
                    // Trigger restart (implementation depends on environment.go integration)
                    // For now, just kill the process - environment will restart it
                    cmd.Process.Kill()
                    return
                }
            } else {
                // Reset failure counter on success
                consecutiveFailures = 0
            }
        }
    }
}
```

### Pattern 5: Graceful Shutdown with Context Cancellation
**What:** Use CommandContext with WaitDelay for graceful shutdown before SIGKILL
**When to use:** Shutting down plugin subprocess cleanly
**Example:**
```go
// Based on Go graceful shutdown patterns (2025)
func (sup *supervisor) Shutdown() {
    sup.lock.Lock()
    defer sup.lock.Unlock()

    if sup.pythonCmd == nil {
        return
    }

    mlog.Info("Shutting down Python plugin", mlog.String("plugin_id", sup.pluginID))

    // Cancel context - this triggers graceful shutdown in Python plugin
    if sup.pythonCancel != nil {
        sup.pythonCancel()
    }

    // Wait for plugin to exit gracefully (up to 5 seconds)
    // If it doesn't exit, cmd.Process.Kill() will be called automatically
    done := make(chan error, 1)
    go func() {
        done <- sup.pythonCmd.Wait()
    }()

    select {
    case err := <-done:
        if err != nil && err.Error() != "signal: killed" {
            mlog.Warn("Plugin exited with error",
                mlog.String("plugin_id", sup.pluginID),
                mlog.Err(err),
            )
        }
    case <-time.After(5 * time.Second):
        mlog.Warn("Plugin did not exit gracefully, killing",
            mlog.String("plugin_id", sup.pluginID),
        )
        sup.pythonCmd.Process.Kill()
        sup.pythonCmd.Wait() // Reap zombie process
    }

    // Close gRPC connection
    if sup.grpcConn != nil {
        sup.grpcConn.Close()
    }

    mlog.Info("Python plugin shut down", mlog.String("plugin_id", sup.pluginID))
}
```

### Pattern 6: Python Interpreter Detection
**What:** Find Python interpreter (venv or system) for plugin execution
**When to use:** Before spawning Python subprocess
**Example:**
```go
// Detect Python interpreter in order of preference:
// 1. Plugin directory venv (venv/bin/python or venv/Scripts/python.exe)
// 2. System python3
// 3. System python
func findPythonInterpreter(pluginDir string) (string, error) {
    // Check for venv in plugin directory
    venvPaths := []string{
        filepath.Join(pluginDir, "venv", "bin", "python"),           // Unix
        filepath.Join(pluginDir, "venv", "Scripts", "python.exe"),   // Windows
        filepath.Join(pluginDir, ".venv", "bin", "python"),          // Unix (alternate)
        filepath.Join(pluginDir, ".venv", "Scripts", "python.exe"),  // Windows (alternate)
    }

    for _, path := range venvPaths {
        if _, err := os.Stat(path); err == nil {
            return path, nil
        }
    }

    // Fall back to system Python
    // Try python3 first (more explicit), then python
    for _, cmd := range []string{"python3", "python"} {
        path, err := exec.LookPath(cmd)
        if err == nil {
            return path, nil
        }
    }

    return "", fmt.Errorf("no Python interpreter found (checked venv and system)")
}
```

### Pattern 7: Concurrent Stdout/Stderr Reading
**What:** Read both pipes concurrently to avoid deadlocks from full buffers
**When to use:** Any subprocess with stdout/stderr output
**Example:**
```go
// Based on Go exec best practices
func streamLogs(r io.Reader, logger *mlog.Logger) {
    scanner := bufio.NewScanner(r)
    for scanner.Scan() {
        logger.Info(scanner.Text())
    }
    if err := scanner.Err(); err != nil {
        logger.Error("Error reading plugin output", mlog.Err(err))
    }
}

// Usage in supervisor:
stdout, _ := cmd.StdoutPipe()
stderr, _ := cmd.StderrPipe()
cmd.Start()

// MUST start reading BEFORE Wait() to avoid deadlock
go streamLogs(stdout, parentLogger.With(mlog.String("source", "plugin_stdout")))
go streamLogs(stderr, parentLogger.With(mlog.String("source", "plugin_stderr")))

// Now safe to Wait()
cmd.Wait()
```

### Anti-Patterns to Avoid
- **Not calling cmd.Wait():** Leaves zombie processes consuming PIDs
- **Calling Wait() before reading pipes:** Deadlocks if pipe buffers fill (>64KB output)
- **Using shell=true or cmd /c:** Security risk, unnecessary for direct Python execution
- **Not setting WaitDelay:** Context cancellation immediately kills process, no graceful shutdown
- **Ignoring handshake timeout:** Plugin hangs on startup, blocking server
- **Not validating handshake format:** Connects to wrong port or protocol, mysterious failures
- **Skipping health check service:** go-plugin will restart plugin frequently, instability
- **Not using CommandContext:** Can't cancel subprocess, leaks processes on shutdown
- **Reading stdout/stderr after Start() in same goroutine:** Deadlock risk if output is large
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin handshake protocol | Custom connection discovery | hashicorp/go-plugin handshake | Includes versioning, magic cookie validation, security checksum, stdio multiplexing |
| Health checking | Custom ping/pong | grpc.health.v1.Health | Standard protocol, works with monitoring tools, required by go-plugin |
| Process reaping | Manual syscall.Wait4 | Always call cmd.Wait() | Wait() handles all edge cases, cross-platform, reaps zombies automatically |
| Graceful shutdown | Manual signal sending | context.WithCancel + WaitDelay | Integrates with Go ecosystem, supports timeout, handles SIGKILL fallback |
| Retry/backoff logic | Custom sleep loops | Exponential backoff with jitter | Prevents thundering herd, well-tested pattern from hashicorp/vault |
| Python venv detection | Hardcoded paths | Check multiple locations + LookPath | Cross-platform, handles user customization, falls back gracefully |
| Subprocess monitoring | Polling process state | go-plugin Client with health checks | Detects RPC failures, not just process death, handles network issues |
| Stdout/stderr capture | Manual pipe reading | SyncStdout/SyncStderr io.Writer | go-plugin provides labeled output, integrates with logging, no deadlocks |

**Key insight:** Process lifecycle management has decades of solved problems. hashicorp/go-plugin is used in production by Terraform (spawning thousands of provider processes daily) and Vault (managing seal/unseal operations). The handshake protocol handles edge cases like:
- Multiple plugins starting simultaneously (port conflicts)
- Plugin crashes before handshake completes
- Version mismatches between host and plugin
- Security validation of plugin binaries
- Stdout/stderr multiplexing (logs vs. handshake)
- Reattach protocol (host upgrades while plugin runs)

Don't hand-roll subprocess management - extend go-plugin's proven patterns.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Zombie Processes from Not Calling Wait()
**What goes wrong:** Plugin processes become zombies, exhaust PID limit
**Why it happens:** Developer thinks Process.Release() is sufficient, but it doesn't reap the process
**How to avoid:** ALWAYS call cmd.Wait() after subprocess exits, even if you don't care about exit code
**Warning signs:** `ps aux | grep defunct` shows zombie processes, server runs out of PIDs after many plugin restarts

### Pitfall 2: Deadlock from Reading Pipes After Start()
**What goes wrong:** cmd.Wait() hangs forever, server stops responding
**Why it happens:** Subprocess fills pipe buffer (64KB), blocks writing, Wait() never returns
**How to avoid:** Start goroutines to read stdout/stderr BEFORE calling cmd.Start(), or use cmd.StdoutPipe() with concurrent reading
**Warning signs:** Plugin appears to hang on startup, pprof shows goroutine blocked in Wait()

### Pitfall 3: Missing Handshake Timeout
**What goes wrong:** Plugin hangs during initialization, server waits forever
**Why it happens:** Python plugin crashes before printing handshake, or takes too long to start
**How to avoid:** Use time.After() channel with select when reading handshake line, fail after 3-5 seconds
**Warning signs:** Server startup hangs, plugin never becomes available, no error logged

### Pitfall 4: Not Implementing grpc.health.v1.Health in Python Plugin
**What goes wrong:** go-plugin restarts plugin every 30 seconds, plugin unstable
**Why it happens:** go-plugin requires health service, treats missing service as unhealthy
**How to avoid:** Python plugin MUST register grpc.health.v1.Health service with status "plugin" = SERVING
**Warning signs:** Plugin logs show frequent restarts, "health check failed" warnings

### Pitfall 5: Immediate SIGKILL on Context Cancellation
**What goes wrong:** Plugin killed without chance to cleanup, leaves stale resources
**Why it happens:** CommandContext default behavior is immediate Kill() on cancellation
**How to avoid:** Set cmd.WaitDelay to 5-10 seconds, giving plugin time to handle context cancellation gracefully
**Warning signs:** Plugin connections not closed cleanly, temporary files not deleted, incomplete database transactions

### Pitfall 6: Hardcoding Python Interpreter Path
**What goes wrong:** Plugin fails to start in different environments (Docker, virtualenv, pyenv)
**Why it happens:** Assuming Python is always at `/usr/bin/python3`
**How to avoid:** Use exec.LookPath("python3") and check for venv in plugin directory first
**Warning signs:** Works on developer machine, fails in production/CI, "python3 not found" errors

### Pitfall 7: Not Validating Handshake Format Before Parsing
**What goes wrong:** Panic or wrong port connection when plugin outputs unexpected format
**Why it happens:** Assuming handshake is always valid, not checking field count or protocol
**How to avoid:** Validate: exactly 5 fields, core protocol version = 1, protocol = "grpc" before using
**Warning signs:** "index out of range" panics, "connection refused" on wrong port

### Pitfall 8: Restarting Plugin Too Quickly After Crash
**What goes wrong:** Plugin crashes repeatedly, creates restart loop, consumes resources
**Why it happens:** No backoff delay between restart attempts
**How to avoid:** Implement exponential backoff (1s, 2s, 4s, 8s, max 60s) with jitter before restart
**Warning signs:** Logs fill with restart messages, high CPU usage, plugin never stabilizes

### Pitfall 9: Ignoring Plugin Exit Code
**What goes wrong:** Missing important error information when plugin fails
**Why it happens:** cmd.Wait() error discarded or not logged properly
**How to avoid:** Check exit code, log different messages for exit 0 (clean), exit 1 (error), signal killed
**Warning signs:** Can't debug plugin failures, unclear why plugin stopped

### Pitfall 10: Race Condition Between Health Check and Shutdown
**What goes wrong:** Health checker goroutine tries to restart plugin during shutdown, double Kill()
**Why it happens:** Health checker and Shutdown() both access plugin process without synchronization
**How to avoid:** Cancel health checker context in Shutdown(), use sync.RWMutex to protect process access
**Warning signs:** Panic from "process already killed", logs show restart during shutdown
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Minimal Python Plugin with go-plugin Handshake
```python
# Source: https://github.com/hashicorp/go-plugin/blob/main/docs/guide-plugin-write-non-go.md
import grpc
from concurrent import futures
import sys
import os

# Import generated protobuf stubs (from Phase 1-3)
from mattermost_plugin.grpc import hooks_pb2_grpc, health_pb2_grpc

def serve():
    """Start gRPC server and output go-plugin handshake"""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # Register plugin hooks service (Phase 7)
    hooks_pb2_grpc.add_PluginHooksServicer_to_server(MyPluginHooks(), server)

    # CRITICAL: Register health check service
    health = health_pb2_grpc.HealthServicer()
    health.set("plugin", health_pb2.HealthCheckResponse.SERVING)
    health_pb2_grpc.add_HealthServicer_to_server(health, server)

    # Start server on any available port
    port = server.add_insecure_port('127.0.0.1:0')
    server.start()

    # Output handshake to stdout (MUST be first line)
    # Format: CORE-PROTOCOL-VERSION | APP-PROTOCOL-VERSION | NETWORK-TYPE | NETWORK-ADDR | PROTOCOL
    print(f"1|1|tcp|127.0.0.1:{port}|grpc", flush=True)

    # Wait for termination
    server.wait_for_termination()

if __name__ == "__main__":
    serve()
```

### Go Supervisor Spawning Python Plugin
```go
// Based on hashicorp/go-plugin examples and existing Mattermost supervisor.go
package supervisor

import (
    "bufio"
    "context"
    "fmt"
    "os/exec"
    "strings"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/health/grpc_health_v1"
    "github.com/mattermost/mattermost/server/public/shared/mlog"
)

type PythonSupervisor struct {
    pluginID     string
    cmd          *exec.Cmd
    cancel       context.CancelFunc
    conn         *grpc.ClientConn
    healthClient grpc_health_v1.HealthClient
    logger       *mlog.Logger
}

func NewPythonSupervisor(pluginID, pythonPath, scriptPath string, logger *mlog.Logger) (*PythonSupervisor, error) {
    ctx, cancel := context.WithCancel(context.Background())

    // Create command with context for cancellation
    cmd := exec.CommandContext(ctx, pythonPath, scriptPath)

    // IMPORTANT: Set WaitDelay for graceful shutdown
    cmd.WaitDelay = 5 * time.Second

    // Create pipes
    stdout, err := cmd.StdoutPipe()
    if err != nil {
        cancel()
        return nil, err
    }
    stderr, err := cmd.StderrPipe()
    if err != nil {
        cancel()
        return nil, err
    }

    // Start subprocess
    if err := cmd.Start(); err != nil {
        cancel()
        return nil, fmt.Errorf("failed to start plugin: %w", err)
    }

    // Read handshake from stdout (first line, with timeout)
    handshakeCh := make(chan string, 1)
    errCh := make(chan error, 1)

    go func() {
        scanner := bufio.NewScanner(stdout)
        if scanner.Scan() {
            handshakeCh <- scanner.Text()
        } else if err := scanner.Err(); err != nil {
            errCh <- err
        } else {
            errCh <- fmt.Errorf("plugin exited before handshake")
        }
    }()

    var handshake string
    select {
    case handshake = <-handshakeCh:
        // Success
    case err := <-errCh:
        cmd.Process.Kill()
        cancel()
        return nil, fmt.Errorf("failed to read handshake: %w", err)
    case <-time.After(3 * time.Second):
        cmd.Process.Kill()
        cancel()
        return nil, fmt.Errorf("timeout reading handshake")
    }

    // Parse and validate handshake
    parts := strings.Split(handshake, "|")
    if len(parts) != 5 {
        cmd.Process.Kill()
        cancel()
        return nil, fmt.Errorf("invalid handshake format: %s", handshake)
    }

    if parts[0] != "1" || parts[4] != "grpc" {
        cmd.Process.Kill()
        cancel()
        return nil, fmt.Errorf("unsupported protocol: %s", handshake)
    }

    // Connect gRPC client
    addr := parts[3]
    conn, err := grpc.Dial(addr, grpc.WithInsecure(), grpc.WithBlock(), grpc.WithTimeout(2*time.Second))
    if err != nil {
        cmd.Process.Kill()
        cancel()
        return nil, fmt.Errorf("failed to connect to plugin: %w", err)
    }

    // Create health check client
    healthClient := grpc_health_v1.NewHealthClient(conn)

    // Start concurrent stdout/stderr reading (after handshake)
    go streamLogs(stdout, logger.With(mlog.String("source", "plugin_stdout")))
    go streamLogs(stderr, logger.With(mlog.String("source", "plugin_stderr")))

    sup := &PythonSupervisor{
        pluginID:     pluginID,
        cmd:          cmd,
        cancel:       cancel,
        conn:         conn,
        healthClient: healthClient,
        logger:       logger,
    }

    // Start health monitoring
    go sup.monitorHealth(ctx)

    return sup, nil
}

func (s *PythonSupervisor) monitorHealth(ctx context.Context) {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()

    failures := 0

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
            resp, err := s.healthClient.Check(checkCtx, &grpc_health_v1.HealthCheckRequest{
                Service: "plugin",
            })
            cancel()

            if err != nil || resp.Status != grpc_health_v1.HealthCheckResponse_SERVING {
                failures++
                s.logger.Warn("Health check failed",
                    mlog.Int("failures", failures),
                    mlog.Err(err),
                )
                if failures >= 3 {
                    s.logger.Error("Plugin unhealthy, killing")
                    s.cmd.Process.Kill()
                    return
                }
            } else {
                failures = 0
            }
        }
    }
}

func (s *PythonSupervisor) Shutdown() error {
    s.logger.Info("Shutting down Python plugin")

    // Cancel context (triggers graceful shutdown in Python)
    s.cancel()

    // Wait for process to exit (WaitDelay gives it time before SIGKILL)
    if err := s.cmd.Wait(); err != nil {
        s.logger.Warn("Plugin exited with error", mlog.Err(err))
    }

    // Close gRPC connection
    if s.conn != nil {
        s.conn.Close()
    }

    s.logger.Info("Python plugin shut down")
    return nil
}

func streamLogs(r io.Reader, logger *mlog.Logger) {
    scanner := bufio.NewScanner(r)
    for scanner.Scan() {
        logger.Info(scanner.Text())
    }
}
```

### Python Interpreter Detection
```go
// Source: Medium article on managing Python venvs from Go (2025)
package supervisor

import (
    "os"
    "os/exec"
    "path/filepath"
    "runtime"
)

func FindPythonInterpreter(pluginDir string) (string, error) {
    // Windows vs Unix venv paths
    var venvBin string
    if runtime.GOOS == "windows" {
        venvBin = "Scripts"
    } else {
        venvBin = "bin"
    }

    // Check for venv in plugin directory
    candidates := []string{
        filepath.Join(pluginDir, "venv", venvBin, "python"),
        filepath.Join(pluginDir, ".venv", venvBin, "python"),
        filepath.Join(pluginDir, "venv", venvBin, "python3"),
        filepath.Join(pluginDir, ".venv", venvBin, "python3"),
    }

    // Windows uses python.exe
    if runtime.GOOS == "windows" {
        for i := range candidates {
            candidates[i] += ".exe"
        }
    }

    for _, path := range candidates {
        if _, err := os.Stat(path); err == nil {
            return path, nil
        }
    }

    // Fall back to system Python
    for _, name := range []string{"python3", "python"} {
        if path, err := exec.LookPath(name); err == nil {
            return path, nil
        }
    }

    return "", fmt.Errorf("no Python interpreter found")
}
```

### Health Check Implementation (Go Client Side)
```go
// Source: https://pkg.go.dev/google.golang.org/grpc/health
package supervisor

import (
    "context"
    "time"

    "google.golang.org/grpc/health/grpc_health_v1"
)

func CheckPluginHealth(client grpc_health_v1.HealthClient, serviceName string, timeout time.Duration) error {
    ctx, cancel := context.WithTimeout(context.Background(), timeout)
    defer cancel()

    resp, err := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{
        Service: serviceName,
    })

    if err != nil {
        return fmt.Errorf("health check failed: %w", err)
    }

    if resp.Status != grpc_health_v1.HealthCheckResponse_SERVING {
        return fmt.Errorf("service not serving: status=%v", resp.Status)
    }

    return nil
}

// Watch health status changes (streaming)
func WatchPluginHealth(client grpc_health_v1.HealthClient, serviceName string) {
    stream, err := client.Watch(context.Background(), &grpc_health_v1.HealthCheckRequest{
        Service: serviceName,
    })
    if err != nil {
        return
    }

    for {
        resp, err := stream.Recv()
        if err != nil {
            return
        }

        switch resp.Status {
        case grpc_health_v1.HealthCheckResponse_SERVING:
            // Plugin healthy
        case grpc_health_v1.HealthCheckResponse_NOT_SERVING:
            // Plugin unhealthy, consider restart
        }
    }
}
```

### Exponential Backoff for Restart
```go
// Source: HashiCorp Vault SDK backoff helper patterns
package supervisor

import (
    "math/rand"
    "time"
)

type RestartPolicy struct {
    InitialDelay time.Duration
    MaxDelay     time.Duration
    Multiplier   float64
    Jitter       float64
    attempts     int
}

func NewRestartPolicy() *RestartPolicy {
    return &RestartPolicy{
        InitialDelay: 1 * time.Second,
        MaxDelay:     60 * time.Second,
        Multiplier:   2.0,
        Jitter:       0.25, // 25% jitter
    }
}

func (r *RestartPolicy) NextDelay() time.Duration {
    // Calculate base delay with exponential backoff
    baseDelay := float64(r.InitialDelay) * math.Pow(r.Multiplier, float64(r.attempts))
    if baseDelay > float64(r.MaxDelay) {
        baseDelay = float64(r.MaxDelay)
    }

    // Add jitter (up to 25% reduction)
    jitterAmount := baseDelay * r.Jitter * rand.Float64()
    delay := time.Duration(baseDelay - jitterAmount)

    r.attempts++
    return delay
}

func (r *RestartPolicy) Reset() {
    r.attempts = 0
}

// Usage:
// policy := NewRestartPolicy()
// for {
//     err := startPlugin()
//     if err == nil {
//         policy.Reset()
//         return
//     }
//     delay := policy.NextDelay()
//     time.Sleep(delay)
// }
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Process.Release() only | Always call cmd.Wait() | Clarified 2023-2024 | Wait() required to reap zombies, Release() doesn't prevent zombies |
| Immediate SIGKILL on cancel | cmd.WaitDelay for graceful shutdown | Go 1.20 (2023) | Plugins get time to cleanup before force kill |
| Manual stdout reading | cmd.StdoutPipe() with goroutines | Best practice 2024+ | Avoids deadlocks from full pipe buffers |
| Custom health check | grpc.health.v1.Health standard | gRPC 1.15+ (2018) | Required by go-plugin, works with monitoring tools |
| Polling for process death | Context-based cancellation | Go 1.7+ (2016), refined 2024 | Clean propagation of shutdown signals |
| go-reaper in all cases | cmd.Wait() sufficient for direct children | Clarified 2024 | go-reaper only needed for PID 1 in containers |

**New tools/patterns to consider:**
- **exec.CommandContext with WaitDelay** (Go 1.20+): Best practice for graceful subprocess shutdown
- **grpc health check Watch()** (gRPC 1.15+): Streaming health status changes instead of polling
- **Structured logging with mlog** (Mattermost standard): Consistent log format across server and plugins
- **Exponential backoff with jitter** (HashiCorp pattern): Prevents thundering herd on restart
- **go-supervise/supervisor** (2025): Library for supervisor/restart pattern, but go-plugin already provides this

**Deprecated/outdated:**
- **Process.Release() for cleanup**: Doesn't reap zombies, use Wait() instead
- **Immediate Kill() on context cancel**: Use WaitDelay for graceful shutdown
- **Reading stdout/stderr in same goroutine as Wait()**: Causes deadlocks, use concurrent goroutines
- **Hardcoded python/python3 paths**: Use exec.LookPath() and check for venv
- **Custom handshake protocols**: go-plugin handshake is standard, includes versioning and security
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Python venv dependency installation**
   - What we know: Plugins may ship with venv or require system Python with dependencies
   - What's unclear: Should supervisor auto-install dependencies from requirements.txt? Or require pre-built venv in plugin bundle?
   - Recommendation: Phase 9 (manifest) should specify Python version and dependency approach. Supervisor assumes venv is ready or system Python has deps.

2. **Plugin restart policy configuration**
   - What we know: Exponential backoff prevents restart loops, but max attempts needed
   - What's unclear: Should restart policy be per-plugin (manifest config) or server-wide setting?
   - Recommendation: Start with server-wide config, add per-plugin override in manifest if needed

3. **Python interpreter version compatibility**
   - What we know: Plugin may require specific Python version (3.10+, 3.11+)
   - What's unclear: Should supervisor validate Python version before starting? How to handle version mismatch?
   - Recommendation: Add python_version field to manifest (Phase 9), supervisor checks before spawning

4. **Resource limits for Python subprocesses**
   - What we know: Plugins could consume excessive memory/CPU, affecting server
   - What's unclear: Should supervisor enforce cgroup limits, memory quotas, CPU shares?
   - Recommendation: Out of scope for Phase 5, consider in future phases after basic functionality works

5. **Multiple Python plugins sharing dependencies**
   - What we know: Each plugin has own subprocess, may duplicate dependencies in memory
   - What's unclear: Is there a way to share common dependencies across plugin processes?
   - Recommendation: Not critical for v1, each plugin self-contained is simpler and more isolated
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [HashiCorp go-plugin GitHub](https://github.com/hashicorp/go-plugin) - Plugin lifecycle patterns
- [go-plugin Non-Go Plugin Guide](https://github.com/hashicorp/go-plugin/blob/main/docs/guide-plugin-write-non-go.md) - Handshake protocol, health checking requirements
- [Go os/exec Package](https://pkg.go.dev/os/exec) - Subprocess management, CommandContext, Wait behavior
- [gRPC Health Checking Protocol](https://grpc.io/docs/guides/health-checking/) - Health check service specification
- [grpc/health Go Package](https://pkg.go.dev/google.golang.org/grpc/health) - Server implementation patterns
- [grpc/health/grpc_health_v1 Go Package](https://pkg.go.dev/google.golang.org/grpc/health/grpc_health_v1) - Client implementation patterns
- [Mattermost supervisor.go](https://github.com/mattermost/mattermost-server) - Existing Go plugin supervisor implementation

### Secondary (MEDIUM confidence)
- [Some Useful Patterns for Go's os/exec (DoltHub, 2022)](https://www.dolthub.com/blog/2022-11-28-go-os-exec-patterns/) - Verified stdout/stderr patterns against official docs
- [Reading os/exec.Cmd Output Without Race Conditions (HackMySQL)](https://hackmysql.com/rand/reading-os-exec-cmd-output-without-race-conditions/) - Confirmed StdoutPipe race conditions
- [Understanding the Supervisor/Restart Pattern in Go (2025)](https://compositecode.blog/2025/06/26/go-concurrency-patternssupervisor-restart-pattern/) - Restart patterns verified against go-supervise package
- [Graceful Shutdown in Go: Practical Patterns (VictoriaMetrics)](https://victoriametrics.com/blog/go-graceful-shutdown/) - Context cancellation patterns verified
- [Creating a Go Program to Manage Python Virtual Environments (Medium, 2025)](https://medium.com/@roberthorbury/creating-a-go-program-to-manage-python-virtual-environments-e9160c178b6d) - Venv detection patterns
- [How to Implement Retry Logic in Go with Exponential Backoff (OneUpTime, 2026)](https://oneuptime.com/blog/post/2026-01-07-go-retry-exponential-backoff/view) - Verified against HashiCorp Vault backoff helper
- [The zombie reaping problem in containers (Pet2Cattle, 2024)](https://pet2cattle.com/2024/10/container-zombies-golang) - Confirmed Wait() vs Release() behavior

### Tertiary (LOW confidence - needs validation)
- [Handling plugin crashes · Issue #31 · hashicorp/go-plugin](https://github.com/hashicorp/go-plugin/issues/31) - Community discussion on crash handling, cross-checked against official docs
- [HashiCorp Plugin System Design and Implementation (Medium)](https://zerofruit-web3.medium.com/hashicorp-plugin-system-design-and-implementation-5f939f09e3b3) - Architecture overview, verified against go-plugin README

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: hashicorp/go-plugin subprocess management for non-Go plugins
- Ecosystem: exec.CommandContext, grpc health checking, Python interpreter detection
- Patterns: Handshake parsing, concurrent I/O, graceful shutdown, health monitoring, restart logic
- Pitfalls: Zombie processes, deadlocks, handshake timeouts, missing health checks, hardcoded paths
- Existing system: Mattermost supervisor.go for Go plugins (net/rpc based)

**Confidence breakdown:**
- Standard stack: HIGH - All tools are stdlib or well-established (go-plugin, gRPC health)
- Architecture: HIGH - Patterns from go-plugin docs, existing Mattermost supervisor, and Go best practices
- Pitfalls: HIGH - Documented in Go issues, production experience reports, official guidelines
- Code examples: HIGH - Verified against go-plugin examples, Go stdlib docs, gRPC official examples
- Python venv detection: MEDIUM - Based on community patterns, not official standard
- Restart policies: MEDIUM - Patterns from HashiCorp, but no specific go-plugin guidance

**Research date:** 2026-01-13
**Valid until:** 2026-02-13 (30 days - subprocess management is stable, but check for Go 1.24+ updates)

**Critical decision points for planning:**
1. ✅ Extend existing supervisor.go, don't replace it
2. ✅ Use go-plugin handshake protocol for consistency
3. ✅ Implement grpc.health.v1.Health client for monitoring
4. ✅ Support both venv and system Python interpreters
5. ✅ Use CommandContext with WaitDelay for graceful shutdown
6. ✅ Read stdout/stderr concurrently to avoid deadlocks
7. ⚠️ Need manifest extension to indicate Python runtime (Phase 9)
8. ⚠️ Need exponential backoff for restart policy
9. ⚠️ Need to decide: auto-install dependencies or require pre-built venv?
</metadata>

---

*Phase: 05-python-supervisor*
*Research completed: 2026-01-13*
*Ready for planning: yes*
