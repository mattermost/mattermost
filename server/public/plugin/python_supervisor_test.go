// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	plugin "github.com/hashicorp/go-plugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestIsPythonPlugin(t *testing.T) {
	tests := []struct {
		name     string
		manifest *model.Manifest
		expected bool
	}{
		{
			name:     "nil manifest",
			manifest: nil,
			expected: false,
		},
		{
			name: "Go plugin with executable",
			manifest: &model.Manifest{
				Id: "go-plugin",
				Server: &model.ManifestServer{
					Executable: "plugin",
				},
			},
			expected: false,
		},
		{
			name: "Python plugin with .py extension",
			manifest: &model.Manifest{
				Id: "python-plugin",
				Server: &model.ManifestServer{
					Executable: "plugin.py",
				},
			},
			expected: true,
		},
		{
			name: "python runtime from manifest field",
			manifest: &model.Manifest{
				Id: "python-runtime-manifest",
				Server: &model.ManifestServer{
					Runtime:    "python",
					Executable: "server/plugin", // No .py extension
				},
			},
			expected: true,
		},
		{
			name: "go runtime explicit",
			manifest: &model.Manifest{
				Id: "go-runtime-explicit",
				Server: &model.ManifestServer{
					Runtime:    "go",
					Executable: "server/plugin",
				},
			},
			expected: false,
		},
		{
			name: "python with full config",
			manifest: &model.Manifest{
				Id: "python-full-config",
				Server: &model.ManifestServer{
					Runtime:       "python",
					PythonVersion: "3.11",
					Executable:    "server/main.py",
					Python: &model.ManifestPython{
						DependencyMode: "venv",
						VenvPath:       "server/venv",
					},
				},
			},
			expected: true,
		},
		{
			name: "Plugin with platform-specific executables (Python)",
			manifest: &model.Manifest{
				Id: "python-multi-platform",
				Server: &model.ManifestServer{
					Executables: map[string]string{
						"linux-amd64":  "plugin.py",
						"darwin-amd64": "plugin.py",
					},
				},
			},
			expected: true,
		},
		{
			name: "Manifest without server",
			manifest: &model.Manifest{
				Id: "webapp-only",
			},
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := isPythonPlugin(tc.manifest)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestFindPythonInterpreter(t *testing.T) {
	t.Run("finds venv python when present", func(t *testing.T) {
		// Create temp plugin directory with fake venv
		dir, err := os.MkdirTemp("", "plugin-venv-test")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		// Create venv structure based on OS
		var venvPythonPath string
		if runtime.GOOS == "windows" {
			venvPythonPath = filepath.Join(dir, "venv", "Scripts", "python.exe")
		} else {
			venvPythonPath = filepath.Join(dir, "venv", "bin", "python")
		}

		// Create directory structure and fake interpreter file
		require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))
		require.NoError(t, os.WriteFile(venvPythonPath, []byte("#!/usr/bin/env python"), 0755))

		// Find interpreter
		found, err := findPythonInterpreter(dir)
		require.NoError(t, err)
		assert.Equal(t, venvPythonPath, found)
	})

	t.Run("finds .venv python when present", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "plugin-dotvenv-test")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		var venvPythonPath string
		if runtime.GOOS == "windows" {
			venvPythonPath = filepath.Join(dir, ".venv", "Scripts", "python.exe")
		} else {
			venvPythonPath = filepath.Join(dir, ".venv", "bin", "python")
		}

		require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))
		require.NoError(t, os.WriteFile(venvPythonPath, []byte("#!/usr/bin/env python"), 0755))

		found, err := findPythonInterpreter(dir)
		require.NoError(t, err)
		assert.Equal(t, venvPythonPath, found)
	})

	t.Run("prefers venv over .venv", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "plugin-both-venvs-test")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		var venvPath, dotVenvPath string
		if runtime.GOOS == "windows" {
			venvPath = filepath.Join(dir, "venv", "Scripts", "python.exe")
			dotVenvPath = filepath.Join(dir, ".venv", "Scripts", "python.exe")
		} else {
			venvPath = filepath.Join(dir, "venv", "bin", "python")
			dotVenvPath = filepath.Join(dir, ".venv", "bin", "python")
		}

		require.NoError(t, os.MkdirAll(filepath.Dir(venvPath), 0755))
		require.NoError(t, os.WriteFile(venvPath, []byte("venv python"), 0755))
		require.NoError(t, os.MkdirAll(filepath.Dir(dotVenvPath), 0755))
		require.NoError(t, os.WriteFile(dotVenvPath, []byte(".venv python"), 0755))

		found, err := findPythonInterpreter(dir)
		require.NoError(t, err)
		assert.Equal(t, venvPath, found)
	})

	t.Run("falls back to system python when no venv", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "plugin-no-venv-test")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		// This test requires python3 or python to be available on the system
		found, err := findPythonInterpreter(dir)

		// Skip if no system python is available
		if err != nil {
			t.Skip("No system Python available for fallback test")
		}

		assert.NotEmpty(t, found)
	})
}

func TestSanitizePythonScriptPath(t *testing.T) {
	tests := []struct {
		name        string
		pluginDir   string
		executable  string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "simple script name",
			pluginDir:   "/plugins/myplugin",
			executable:  "plugin.py",
			expectError: false,
		},
		{
			name:        "script in subdirectory",
			pluginDir:   "/plugins/myplugin",
			executable:  "server/plugin.py",
			expectError: false,
		},
		{
			name:        "path traversal attempt",
			pluginDir:   "/plugins/myplugin",
			executable:  "../../../etc/passwd",
			expectError: true,
			errorMsg:    "path traversal",
		},
		{
			name:        "path traversal with subdirectory",
			pluginDir:   "/plugins/myplugin",
			executable:  "server/../../../etc/passwd",
			expectError: true,
			errorMsg:    "path traversal",
		},
		{
			name:        "absolute path rejected via clean",
			pluginDir:   "/plugins/myplugin",
			executable:  "/etc/passwd",
			expectError: false, // filepath.Join handles this by making it relative
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, err := sanitizePythonScriptPath(tc.pluginDir, tc.executable)

			if tc.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.errorMsg)
			} else {
				require.NoError(t, err)
				assert.NotEmpty(t, result)
				// Ensure result is within plugin directory
				assert.True(t, filepath.HasPrefix(result, tc.pluginDir))
			}
		})
	}
}

func TestBuildPythonCommand(t *testing.T) {
	pythonPath := "/usr/bin/python3"
	scriptPath := "/plugins/myplugin/plugin.py"
	pluginDir := "/plugins/myplugin"

	cmd := buildPythonCommand(pythonPath, scriptPath, pluginDir)

	assert.Equal(t, pythonPath, cmd.Path)
	assert.Equal(t, []string{pythonPath, scriptPath}, cmd.Args)
	assert.Equal(t, pluginDir, cmd.Dir)
	assert.NotZero(t, cmd.WaitDelay)
}

func TestPythonCommandFromManifest(t *testing.T) {
	t.Run("configures Python plugin correctly", func(t *testing.T) {
		// Create temp plugin directory
		dir, err := os.MkdirTemp("", "python-plugin-test")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		// Create fake venv and script
		var venvPythonPath string
		if runtime.GOOS == "windows" {
			venvPythonPath = filepath.Join(dir, "venv", "Scripts", "python.exe")
		} else {
			venvPythonPath = filepath.Join(dir, "venv", "bin", "python")
		}
		require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))
		require.NoError(t, os.WriteFile(venvPythonPath, []byte("#!/usr/bin/env python"), 0755))

		// Create plugin script
		scriptPath := filepath.Join(dir, "plugin.py")
		require.NoError(t, os.WriteFile(scriptPath, []byte("# Python plugin"), 0644))

		// Create manifest
		manifest := &model.Manifest{
			Id: "python-test-plugin",
			Server: &model.ManifestServer{
				Executable: "plugin.py",
			},
		}

		bundleInfo := &model.BundleInfo{
			Path:     dir,
			Manifest: manifest,
		}

		clientConfig := &plugin.ClientConfig{}
		sup := &supervisor{}

		err = WithCommandFromManifest(bundleInfo, nil, nil)(sup, clientConfig)
		require.NoError(t, err)

		// Verify command was configured
		require.NotNil(t, clientConfig.Cmd)
		assert.Equal(t, venvPythonPath, clientConfig.Cmd.Path)
		assert.Contains(t, clientConfig.Cmd.Args, scriptPath)
		assert.Equal(t, dir, clientConfig.Cmd.Dir)

		// SecureConfig should be nil for Python plugins
		assert.Nil(t, clientConfig.SecureConfig)
	})

	t.Run("rejects path traversal in Python plugin", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "python-plugin-traversal-test")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		// Create venv
		var venvPythonPath string
		if runtime.GOOS == "windows" {
			venvPythonPath = filepath.Join(dir, "venv", "Scripts", "python.exe")
		} else {
			venvPythonPath = filepath.Join(dir, "venv", "bin", "python")
		}
		require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))
		require.NoError(t, os.WriteFile(venvPythonPath, []byte("#!/usr/bin/env python"), 0755))

		// Use .py extension to trigger Python detection, with path traversal
		manifest := &model.Manifest{
			Id: "malicious-plugin",
			Server: &model.ManifestServer{
				Executable: "../../../etc/passwd.py",
			},
		}

		bundleInfo := &model.BundleInfo{
			Path:     dir,
			Manifest: manifest,
		}

		clientConfig := &plugin.ClientConfig{}
		sup := &supervisor{}

		err = WithCommandFromManifest(bundleInfo, nil, nil)(sup, clientConfig)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "path traversal")
	})

	t.Run("fails when Python script does not exist", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "python-plugin-missing-script")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		// Create venv but no script
		var venvPythonPath string
		if runtime.GOOS == "windows" {
			venvPythonPath = filepath.Join(dir, "venv", "Scripts", "python.exe")
		} else {
			venvPythonPath = filepath.Join(dir, "venv", "bin", "python")
		}
		require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))
		require.NoError(t, os.WriteFile(venvPythonPath, []byte("#!/usr/bin/env python"), 0755))

		manifest := &model.Manifest{
			Id: "missing-script-plugin",
			Server: &model.ManifestServer{
				Executable: "nonexistent.py",
			},
		}

		bundleInfo := &model.BundleInfo{
			Path:     dir,
			Manifest: manifest,
		}

		clientConfig := &plugin.ClientConfig{}
		sup := &supervisor{}

		err = WithCommandFromManifest(bundleInfo, nil, nil)(sup, clientConfig)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})
}

// TestPythonSupervisor_HealthCheckSuccess tests the end-to-end spawning and
// health checking of a Python-style plugin using a fake Python interpreter.
// The fake interpreter is a compiled Go binary that:
// 1. Starts a gRPC server
// 2. Registers gRPC health service with "plugin" status SERVING
// 3. Registers PluginHooks service with basic Implemented() support
// 4. Prints the go-plugin handshake line to stdout
// 5. Blocks until killed
func TestPythonSupervisor_HealthCheckSuccess(t *testing.T) {
	// Create temp plugin directory
	pluginDir, err := os.MkdirTemp("", "python-plugin-integration-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginDir, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginDir, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile a fake "Python interpreter" that serves gRPC health checks and PluginHooks.
	// This binary ignores argv[1] (the script path) and just serves the
	// go-plugin handshake + gRPC services.
	utils.CompileGo(t, `
package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	return &pb.ImplementedResponse{Hooks: []string{}}, nil
}

func main() {
	// Ignore argv[1] (the script path) - we're pretending to be a Python interpreter
	// Start a gRPC server on a random port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()

	// Register gRPC health service with "plugin" status SERVING
	// This is required by go-plugin for health checking
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)

	// Register PluginHooks service (required by supervisor for Python plugins)
	pb.RegisterPluginHooksServer(grpcServer, &fakePluginHooks{})

	// Start serving in a goroutine
	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	// Print the go-plugin handshake line
	// Format: CORE-PROTOCOL-VERSION | APP-PROTOCOL-VERSION | NETWORK-TYPE | NETWORK-ADDR | PROTOCOL
	// For Mattermost plugins, APP-PROTOCOL-VERSION is 1 (from handshake.ProtocolVersion)
	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	// Block until SIGTERM or SIGINT
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create a dummy plugin.py file (content doesn't matter, the fake interpreter ignores it)
	scriptPath := filepath.Join(pluginDir, "plugin.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte("# Fake Python plugin script\n"), 0644))

	// Create plugin.json manifest that indicates this is a Python plugin
	manifest := &model.Manifest{
		Id:      "python-integration-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), manifestJSON, 0644))

	// Create bundle info
	bundle := model.BundleInfoForPath(pluginDir)
	require.NotNil(t, bundle.Manifest)

	// Create logger
	logger := mlog.CreateConsoleTestLogger(t)

	// Create supervisor using WithCommandFromManifest which will detect Python
	// and use the fake interpreter
	sup, err := newSupervisor(bundle, nil, nil, logger, nil, WithCommandFromManifest(bundle))
	require.NoError(t, err)
	require.NotNil(t, sup)
	defer sup.Shutdown()

	// Verify hooks are wired (Python plugins now have hooks through gRPC)
	require.NotNil(t, sup.Hooks(), "Python plugin should have hooks wired")

	// Verify health check succeeds - this proves gRPC Ping is working
	err = sup.PerformHealthCheck()
	require.NoError(t, err, "Health check should succeed for Python plugin")
}

// TestPythonPluginEnvironmentActivation tests that the Environment can
// activate and deactivate a Python plugin with hooks properly wired.
func TestPythonPluginEnvironmentActivation(t *testing.T) {
	// Create temp directories
	pluginDir, err := os.MkdirTemp("", "python-env-test-plugins")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	webappDir, err := os.MkdirTemp("", "python-env-test-webapp")
	require.NoError(t, err)
	defer os.RemoveAll(webappDir)

	// Create plugin subdirectory
	pluginPath := filepath.Join(pluginDir, "python-test-plugin")
	require.NoError(t, os.MkdirAll(pluginPath, 0755))

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginPath, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginPath, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile fake Python interpreter with PluginHooks service
	utils.CompileGo(t, `
package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	return &pb.ImplementedResponse{Hooks: []string{"OnActivate", "OnDeactivate"}}, nil
}

func (f *fakePluginHooks) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	return &pb.OnActivateResponse{}, nil
}

func (f *fakePluginHooks) OnDeactivate(ctx context.Context, req *pb.OnDeactivateRequest) (*pb.OnDeactivateResponse, error) {
	return &pb.OnDeactivateResponse{}, nil
}

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	pb.RegisterPluginHooksServer(grpcServer, &fakePluginHooks{})

	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create dummy plugin.py
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "plugin.py"), []byte("# Fake\n"), 0644))

	// Create plugin.json
	manifest := &model.Manifest{
		Id:      "python-test-plugin",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "plugin.json"), manifestJSON, 0644))

	// Create Environment
	logger := mlog.CreateConsoleTestLogger(t)
	env, err := NewEnvironment(
		func(m *model.Manifest) API { return nil },
		nil,
		pluginDir,
		webappDir,
		logger,
		nil,
	)
	require.NoError(t, err)
	defer env.Shutdown()

	// Activate the Python plugin
	retManifest, activated, err := env.Activate("python-test-plugin")
	require.NoError(t, err)
	assert.True(t, activated, "Plugin should be activated")
	assert.NotNil(t, retManifest)

	// Verify plugin is active
	assert.True(t, env.IsActive("python-test-plugin"))

	// Verify health check works through Environment
	err = env.PerformHealthCheck("python-test-plugin")
	require.NoError(t, err, "Health check should succeed through Environment")

	// Deactivate the plugin - hooks are now wired and OnDeactivate will be called
	result := env.Deactivate("python-test-plugin")
	assert.True(t, result, "Deactivate should return true")

	// Verify plugin is no longer active
	assert.False(t, env.IsActive("python-test-plugin"))
}

// TestPythonSupervisor_HandshakeTimeout tests that the supervisor times out
// when the fake Python interpreter never prints the handshake line.
func TestPythonSupervisor_HandshakeTimeout(t *testing.T) {
	// Create temp plugin directory
	pluginDir, err := os.MkdirTemp("", "python-timeout-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginDir, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginDir, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile a fake "Python interpreter" that blocks forever without printing handshake.
	// This simulates a startup hang (e.g., module import loop, deadlock, etc.)
	utils.CompileGo(t, `
package main

import (
	"os"
	"os/signal"
	"syscall"
)

func main() {
	// Ignore argv[1] (the script path)
	// Never print the handshake line - just block forever
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh
}
`, venvPythonPath)

	// Create a dummy plugin.py file
	scriptPath := filepath.Join(pluginDir, "plugin.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte("# Fake Python plugin script\n"), 0644))

	// Create plugin.json manifest
	manifest := &model.Manifest{
		Id:      "python-timeout-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), manifestJSON, 0644))

	// Create bundle info
	bundle := model.BundleInfoForPath(pluginDir)
	require.NotNil(t, bundle.Manifest)

	// Create logger
	logger := mlog.CreateConsoleTestLogger(t)

	// Record start time to verify timeout duration
	startTime := time.Now()

	// Attempt to create supervisor - should fail with timeout
	sup, err := newSupervisor(bundle, nil, nil, logger, nil, WithCommandFromManifest(bundle))

	// Verify we got an error
	require.Error(t, err)

	// Ensure the error mentions timeout or context deadline
	errMsg := err.Error()
	assert.True(t, strings.Contains(errMsg, "timeout") ||
		strings.Contains(errMsg, "deadline") ||
		strings.Contains(errMsg, "Unrecognized remote plugin message"),
		"Expected timeout-related error, got: %s", errMsg)

	// Verify it completed within a reasonable time (StartTimeout is 10s for Python plugins, add buffer)
	elapsed := time.Since(startTime)
	assert.Less(t, elapsed, 15*time.Second, "Should timeout within 15 seconds (StartTimeout + buffer)")

	// Supervisor should be nil on error
	if sup != nil {
		sup.Shutdown()
	}
}

// TestPythonSupervisor_InvalidHandshake tests that the supervisor fails
// when the fake Python interpreter prints an invalid handshake (wrong protocol).
func TestPythonSupervisor_InvalidHandshake(t *testing.T) {
	// Create temp plugin directory
	pluginDir, err := os.MkdirTemp("", "python-invalid-handshake-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginDir, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginDir, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile a fake "Python interpreter" that prints an invalid handshake.
	// The supervisor expects grpc protocol but we print netrpc.
	utils.CompileGo(t, `
package main

import (
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	// Start a listener to get a valid address
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}
	defer listener.Close()

	addr := listener.Addr().String()

	// Print handshake with netrpc protocol (supervisor expects grpc for Python plugins)
	// Format: CORE-PROTOCOL-VERSION | APP-PROTOCOL-VERSION | NETWORK-TYPE | NETWORK-ADDR | PROTOCOL
	fmt.Printf("1|1|tcp|%s|netrpc\n", addr)
	os.Stdout.Sync()

	// Block until SIGTERM
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh
}
`, venvPythonPath)

	// Create a dummy plugin.py file
	scriptPath := filepath.Join(pluginDir, "plugin.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte("# Fake Python plugin script\n"), 0644))

	// Create plugin.json manifest
	manifest := &model.Manifest{
		Id:      "python-invalid-handshake-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), manifestJSON, 0644))

	// Create bundle info
	bundle := model.BundleInfoForPath(pluginDir)
	require.NotNil(t, bundle.Manifest)

	// Create logger
	logger := mlog.CreateConsoleTestLogger(t)

	// Attempt to create supervisor - should fail due to protocol mismatch
	sup, err := newSupervisor(bundle, nil, nil, logger, nil, WithCommandFromManifest(bundle))

	// Verify we got an error
	require.Error(t, err)

	// Error message should indicate protocol issues
	errMsg := err.Error()
	assert.True(t, strings.Contains(errMsg, "protocol") ||
		strings.Contains(errMsg, "Incompatible") ||
		strings.Contains(errMsg, "grpc") ||
		strings.Contains(errMsg, "Unrecognized"),
		"Expected protocol-related error, got: %s", errMsg)

	// Supervisor should be nil on error
	if sup != nil {
		sup.Shutdown()
	}
}

// TestPythonSupervisor_MalformedHandshake tests that the supervisor fails
// when the fake Python interpreter prints a malformed handshake line.
func TestPythonSupervisor_MalformedHandshake(t *testing.T) {
	// Create temp plugin directory
	pluginDir, err := os.MkdirTemp("", "python-malformed-handshake-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginDir, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginDir, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile a fake "Python interpreter" that prints a malformed handshake.
	// The handshake should have 5 pipe-separated parts, we only print 2.
	utils.CompileGo(t, `
package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	// Print a malformed handshake (only 2 parts instead of 5)
	fmt.Printf("1|invalid\n")
	os.Stdout.Sync()

	// Block until SIGTERM
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh
}
`, venvPythonPath)

	// Create a dummy plugin.py file
	scriptPath := filepath.Join(pluginDir, "plugin.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte("# Fake Python plugin script\n"), 0644))

	// Create plugin.json manifest
	manifest := &model.Manifest{
		Id:      "python-malformed-handshake-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), manifestJSON, 0644))

	// Create bundle info
	bundle := model.BundleInfoForPath(pluginDir)
	require.NotNil(t, bundle.Manifest)

	// Create logger
	logger := mlog.CreateConsoleTestLogger(t)

	// Attempt to create supervisor - should fail due to malformed handshake
	sup, err := newSupervisor(bundle, nil, nil, logger, nil, WithCommandFromManifest(bundle))

	// Verify we got an error
	require.Error(t, err)

	// Error message should indicate parsing/format issues
	errMsg := err.Error()
	assert.True(t, strings.Contains(errMsg, "Unrecognized") ||
		strings.Contains(errMsg, "parse") ||
		strings.Contains(errMsg, "format") ||
		strings.Contains(errMsg, "invalid") ||
		strings.Contains(errMsg, "protocol"),
		"Expected parsing-related error, got: %s", errMsg)

	// Supervisor should be nil on error
	if sup != nil {
		sup.Shutdown()
	}
}

// TestPythonSupervisor_Restart tests the full crash and restart flow:
// 1. Start a healthy fake Python plugin
// 2. Verify health check succeeds
// 3. Kill the plugin process to simulate a crash
// 4. Verify health check fails after crash
// 5. Call RestartPlugin and verify health check succeeds again
func TestPythonSupervisor_Restart(t *testing.T) {
	// Create temp directories
	pluginDir, err := os.MkdirTemp("", "python-restart-test-plugins")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	webappDir, err := os.MkdirTemp("", "python-restart-test-webapp")
	require.NoError(t, err)
	defer os.RemoveAll(webappDir)

	// Create plugin subdirectory
	pluginPath := filepath.Join(pluginDir, "python-restart-test")
	require.NoError(t, os.MkdirAll(pluginPath, 0755))

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginPath, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginPath, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile fake Python interpreter that serves gRPC health checks and PluginHooks
	utils.CompileGo(t, `
package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	return &pb.ImplementedResponse{Hooks: []string{"OnActivate"}}, nil
}

func (f *fakePluginHooks) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	return &pb.OnActivateResponse{}, nil
}

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	pb.RegisterPluginHooksServer(grpcServer, &fakePluginHooks{})

	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create dummy plugin.py
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "plugin.py"), []byte("# Fake\n"), 0644))

	// Create plugin.json
	manifest := &model.Manifest{
		Id:      "python-restart-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "plugin.json"), manifestJSON, 0644))

	// Create Environment
	logger := mlog.CreateConsoleTestLogger(t)
	env, err := NewEnvironment(
		func(m *model.Manifest) API { return nil },
		nil,
		pluginDir,
		webappDir,
		logger,
		nil,
	)
	require.NoError(t, err)
	defer env.Shutdown()

	// Step 1: Activate the Python plugin
	retManifest, activated, err := env.Activate("python-restart-test")
	require.NoError(t, err)
	assert.True(t, activated, "Plugin should be activated")
	assert.NotNil(t, retManifest)
	assert.True(t, env.IsActive("python-restart-test"))

	// Step 2: Verify health check succeeds
	err = env.PerformHealthCheck("python-restart-test")
	require.NoError(t, err, "Initial health check should succeed")

	// Step 3: Kill the plugin process to simulate a crash
	// Access the registered plugin to get the supervisor and kill the underlying process
	rp, ok := env.registeredPlugins.Load("python-restart-test")
	require.True(t, ok, "Plugin should be registered")
	registeredPlug := rp.(registeredPlugin)
	require.NotNil(t, registeredPlug.supervisor, "Supervisor should exist")
	require.NotNil(t, registeredPlug.supervisor.client, "Client should exist")

	// Kill the plugin process
	registeredPlug.supervisor.client.Kill()

	// Step 4: Verify health check fails after crash
	// Use a short polling loop instead of arbitrary sleep
	healthCheckFailed := false
	for i := 0; i < 10; i++ {
		err = env.PerformHealthCheck("python-restart-test")
		if err != nil {
			healthCheckFailed = true
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	require.True(t, healthCheckFailed, "Health check should fail after killing the process")

	// Step 5: Call RestartPlugin and verify recovery
	err = env.RestartPlugin("python-restart-test")
	require.NoError(t, err, "RestartPlugin should succeed")

	// Verify the plugin is active again
	assert.True(t, env.IsActive("python-restart-test"), "Plugin should be active after restart")

	// Verify health check succeeds after restart
	// Use a short polling loop to allow for startup time
	healthCheckSucceeded := false
	for i := 0; i < 20; i++ {
		err = env.PerformHealthCheck("python-restart-test")
		if err == nil {
			healthCheckSucceeded = true
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	require.True(t, healthCheckSucceeded, "Health check should succeed after restart")
}

// TestPythonPluginHookDispatch tests end-to-end hook dispatch for Python plugins.
// It creates a fake Python interpreter that implements the PluginHooks gRPC service,
// verifies the supervisor wires hooks correctly, and tests that hook invocations work.
//
// Note: OnActivate is a special hook that is NOT tracked in hookNameToId (it's excluded
// from code generation), so we test with OnDeactivate and MessageHasBeenPosted which
// ARE tracked via sup.Implements().
func TestPythonPluginHookDispatch(t *testing.T) {
	// Create temp plugin directory
	pluginDir, err := os.MkdirTemp("", "python-hooks-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginDir, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginDir, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile a fake "Python interpreter" that serves:
	// 1. gRPC health service (required by go-plugin)
	// 2. PluginHooks service with Implemented, OnActivate, OnDeactivate, and MessageHasBeenPosted
	utils.CompileGo(t, `
package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// fakePluginHooks implements the PluginHooksServer interface
type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	// Report that we implement OnActivate, OnDeactivate, and MessageHasBeenPosted
	// Note: OnActivate is not in hookNameToId (excluded from generation), but OnDeactivate is
	return &pb.ImplementedResponse{
		Hooks: []string{"OnActivate", "OnDeactivate", "MessageHasBeenPosted"},
	}, nil
}

func (f *fakePluginHooks) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	return &pb.OnActivateResponse{}, nil
}

func (f *fakePluginHooks) OnDeactivate(ctx context.Context, req *pb.OnDeactivateRequest) (*pb.OnDeactivateResponse, error) {
	return &pb.OnDeactivateResponse{}, nil
}

func (f *fakePluginHooks) MessageHasBeenPosted(ctx context.Context, req *pb.MessageHasBeenPostedRequest) (*pb.MessageHasBeenPostedResponse, error) {
	return &pb.MessageHasBeenPostedResponse{}, nil
}

func main() {
	// Start a gRPC server on a random port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()

	// Register gRPC health service (required by go-plugin)
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)

	// Register PluginHooks service
	pluginHooks := &fakePluginHooks{}
	pb.RegisterPluginHooksServer(grpcServer, pluginHooks)

	// Start serving in a goroutine
	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	// Print the go-plugin handshake line
	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	// Block until SIGTERM or SIGINT
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create a dummy plugin.py file
	scriptPath := filepath.Join(pluginDir, "plugin.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte("# Fake Python plugin script\n"), 0644))

	// Create plugin.json manifest
	manifest := &model.Manifest{
		Id:      "python-hooks-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), manifestJSON, 0644))

	// Create bundle info
	bundle := model.BundleInfoForPath(pluginDir)
	require.NotNil(t, bundle.Manifest)

	// Create logger
	logger := mlog.CreateConsoleTestLogger(t)

	// Create supervisor using WithCommandFromManifest which will detect Python
	sup, err := newSupervisor(bundle, nil, nil, logger, nil, WithCommandFromManifest(bundle))
	require.NoError(t, err)
	require.NotNil(t, sup)
	defer sup.Shutdown()

	// Verify hooks are NOT nil (Python plugins now have hooks wired)
	require.NotNil(t, sup.Hooks(), "Python plugin should have hooks wired")

	// Verify health check succeeds
	err = sup.PerformHealthCheck()
	require.NoError(t, err, "Health check should succeed")

	// Verify Implemented() returns the hooks we registered
	impl, implErr := sup.Hooks().Implemented()
	require.NoError(t, implErr, "Implemented() should succeed")
	assert.Contains(t, impl, "OnActivate", "Implemented should include OnActivate")
	assert.Contains(t, impl, "OnDeactivate", "Implemented should include OnDeactivate")
	assert.Contains(t, impl, "MessageHasBeenPosted", "Implemented should include MessageHasBeenPosted")

	// Test 1: Verify Implements() returns true for OnDeactivate
	// Note: OnActivate is excluded from hookNameToId, so we test OnDeactivate instead
	assert.True(t, sup.Implements(OnDeactivateID), "sup.Implements(OnDeactivateID) should return true")

	// Test 2: Verify Implements() returns true for MessageHasBeenPosted
	assert.True(t, sup.Implements(MessageHasBeenPostedID), "sup.Implements(MessageHasBeenPostedID) should return true")

	// Test 3: Verify Implements() returns false for ChannelHasBeenCreated (not in implemented list)
	assert.False(t, sup.Implements(ChannelHasBeenCreatedID), "sup.Implements(ChannelHasBeenCreatedID) should return false")

	// Test 4: Call OnActivate and verify it succeeds
	err = sup.Hooks().OnActivate()
	require.NoError(t, err, "OnActivate should succeed")

	// Test 5: Call OnDeactivate and verify it succeeds
	err = sup.Hooks().OnDeactivate()
	require.NoError(t, err, "OnDeactivate should succeed")

	// Test 6: Call MessageHasBeenPosted and verify it doesn't error
	// (void hook, so we just verify no panic/error)
	sup.Hooks().MessageHasBeenPosted(nil, &model.Post{
		Id:        "test-post-id",
		ChannelId: "test-channel-id",
		UserId:    "test-user-id",
		Message:   "Test message",
	})
}
