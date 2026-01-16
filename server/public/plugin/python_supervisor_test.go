// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"

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
			name: "Python plugin with runtime prop",
			manifest: &model.Manifest{
				Id: "python-plugin-props",
				Server: &model.ManifestServer{
					Executable: "main",
				},
				Props: map[string]any{
					"runtime": "python",
				},
			},
			expected: true,
		},
		{
			name: "Plugin with non-python runtime prop",
			manifest: &model.Manifest{
				Id: "node-plugin",
				Server: &model.ManifestServer{
					Executable: "main.js",
				},
				Props: map[string]any{
					"runtime": "node",
				},
			},
			expected: false,
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

		err = WithCommandFromManifest(bundleInfo)(sup, clientConfig)
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

		err = WithCommandFromManifest(bundleInfo)(sup, clientConfig)
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

		err = WithCommandFromManifest(bundleInfo)(sup, clientConfig)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})
}

// TestPythonSupervisor_HealthCheckSuccess tests the end-to-end spawning and
// health checking of a Python-style plugin using a fake Python interpreter.
// The fake interpreter is a compiled Go binary that:
// 1. Starts a gRPC server
// 2. Registers gRPC health service with "plugin" status SERVING
// 3. Prints the go-plugin handshake line to stdout
// 4. Blocks until killed
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

	// Compile a fake "Python interpreter" that serves gRPC health checks.
	// This binary ignores argv[1] (the script path) and just serves the
	// go-plugin handshake + gRPC health service.
	utils.CompileGo(t, `
package main

import (
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

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

	// Verify hooks are nil (Python plugins in Phase 5 don't have hooks)
	assert.Nil(t, sup.Hooks(), "Python plugin should have nil hooks in Phase 5")

	// Verify health check succeeds - this proves gRPC Ping is working
	err = sup.PerformHealthCheck()
	require.NoError(t, err, "Health check should succeed for Python plugin")
}

// TestPythonPluginEnvironmentActivation tests that the Environment can
// activate and deactivate a Python plugin without panicking on nil hooks.
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

	// Compile fake Python interpreter
	utils.CompileGo(t, `
package main

import (
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

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

	// Deactivate the plugin - this should not panic even with nil hooks
	result := env.Deactivate("python-test-plugin")
	assert.True(t, result, "Deactivate should return true")

	// Verify plugin is no longer active
	assert.False(t, env.IsActive("python-test-plugin"))
}
