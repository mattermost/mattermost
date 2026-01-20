// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	plugin "github.com/hashicorp/go-plugin"
	"github.com/pkg/errors"
	"google.golang.org/grpc"

	"github.com/mattermost/mattermost/server/public/model"
)

// isPythonPlugin determines if a plugin manifest indicates a Python plugin.
// Detection uses:
// 1. Server.Runtime field explicitly set to "python"
// 2. Server executable ends with .py (fallback for backward compatibility)
func isPythonPlugin(manifest *model.Manifest) bool {
	if manifest == nil || manifest.Server == nil {
		return false
	}

	// Check explicit runtime declaration
	if manifest.Server.Runtime == "python" {
		return true
	}

	// Fallback: check executable extension for backward compatibility
	executable := manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH)
	return strings.HasSuffix(executable, ".py")
}

// findPythonInterpreter locates a Python interpreter for the given plugin directory.
// Search order:
// 1. Plugin venv (venv/ or .venv/)
// 2. System python3 via PATH
// 3. System python via PATH
// It never hardcodes paths like /usr/bin/python3 to support pyenv, brew, containers.
func findPythonInterpreter(pluginDir string) (string, error) {
	// Build list of venv paths to check based on OS
	var venvPaths []string
	if runtime.GOOS == "windows" {
		venvPaths = []string{
			filepath.Join(pluginDir, "venv", "Scripts", "python.exe"),
			filepath.Join(pluginDir, ".venv", "Scripts", "python.exe"),
		}
	} else {
		// Unix-like systems (Linux, macOS)
		venvPaths = []string{
			filepath.Join(pluginDir, "venv", "bin", "python"),
			filepath.Join(pluginDir, "venv", "bin", "python3"),
			filepath.Join(pluginDir, ".venv", "bin", "python"),
			filepath.Join(pluginDir, ".venv", "bin", "python3"),
		}
	}

	// Check venv paths first
	for _, path := range venvPaths {
		if _, err := os.Stat(path); err == nil {
			// Convert to absolute path for exec to find it
			absPath, err := filepath.Abs(path)
			if err != nil {
				return path, nil // Fall back to relative if Abs fails
			}
			return absPath, nil
		}
	}

	// Fall back to system Python via PATH
	for _, pythonCmd := range []string{"python3", "python"} {
		if path, err := exec.LookPath(pythonCmd); err == nil {
			return path, nil
		}
	}

	return "", errors.New("no Python interpreter found (checked venv and system PATH)")
}

// sanitizePythonScriptPath validates and returns the absolute path to a Python plugin script.
// It uses the same sanitation pattern as WithExecutableFromManifest to prevent path traversal.
func sanitizePythonScriptPath(pluginDir, executable string) (string, error) {
	// Clean and normalize the path
	cleaned := filepath.Clean(filepath.Join(".", executable))

	// Reject path traversal attempts
	if strings.HasPrefix(cleaned, "..") {
		return "", fmt.Errorf("invalid Python script path (path traversal): %s", executable)
	}

	// Build absolute path under plugin directory
	scriptPath := filepath.Join(pluginDir, cleaned)

	return scriptPath, nil
}

// buildPythonCommand creates an exec.Cmd for running a Python plugin.
// It sets the working directory and configures a graceful shutdown delay.
// The executable parameter should be relative to pluginDir (e.g., "plugin.py").
func buildPythonCommand(pythonPath, executable, pluginDir string) *exec.Cmd {
	cmd := exec.Command(pythonPath, executable)
	cmd.Dir = pluginDir
	// Allow 5 seconds for graceful shutdown before SIGKILL on context cancellation
	cmd.WaitDelay = 5 * time.Second
	return cmd
}

// WithCommandFromManifest creates a supervisor option that sets the ClientConfig.Cmd
// correctly for both Go and Python plugins.
// For Python plugins:
// - Uses venv-first interpreter discovery
// - Sets SecureConfig to nil (interpreter checksum would be meaningless)
// - Starts a gRPC PluginAPI server if apiImpl and registrar are provided
// - Sets MATTERMOST_PLUGIN_API_TARGET env var with the server address
// For Go plugins:
// - Delegates to existing WithExecutableFromManifest behavior
func WithCommandFromManifest(pluginInfo *model.BundleInfo, apiImpl API, registrar APIServerRegistrar) func(*supervisor, *plugin.ClientConfig) error {
	return func(sup *supervisor, clientConfig *plugin.ClientConfig) error {
		if isPythonPlugin(pluginInfo.Manifest) {
			return configurePythonCommand(pluginInfo, clientConfig, sup, apiImpl, registrar)
		}

		// For Go plugins, use the existing implementation
		return WithExecutableFromManifest(pluginInfo)(sup, clientConfig)
	}
}

// APIServerRegistrar is a function that registers the PluginAPI service with a gRPC server.
// This abstraction is used to break the import cycle between plugin and pluginapi/grpc/server.
type APIServerRegistrar func(grpcServer *grpc.Server, apiImpl API)

// startAPIServer starts a gRPC server that serves the PluginAPI service.
// It listens on a random available port and returns:
// - The server address (e.g., "localhost:54321") for the Python subprocess
// - A cleanup function to stop the server
// - An error if the server could not be started
func startAPIServer(apiImpl API, registrar APIServerRegistrar) (string, func(), error) {
	// Listen on a random available port
	listener, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return "", nil, errors.Wrap(err, "failed to create listener for PluginAPI server")
	}

	// Create a new gRPC server
	grpcServer := grpc.NewServer()

	// Register the PluginAPI service using the provided registrar
	registrar(grpcServer, apiImpl)

	// Start serving in a goroutine
	go func() {
		// Serve blocks until the server is stopped or an error occurs
		_ = grpcServer.Serve(listener)
	}()

	// Extract the assigned address
	addr := listener.Addr().String()

	// Create cleanup function that stops the server gracefully
	cleanup := func() {
		grpcServer.GracefulStop()
	}

	return addr, cleanup, nil
}

// configurePythonCommand sets up the ClientConfig.Cmd for a Python plugin.
// If apiImpl and registrar are provided, it starts a gRPC PluginAPI server and passes the
// address to the Python subprocess via the MATTERMOST_PLUGIN_API_TARGET env var.
func configurePythonCommand(pluginInfo *model.BundleInfo, clientConfig *plugin.ClientConfig, sup *supervisor, apiImpl API, registrar APIServerRegistrar) error {
	// Find Python interpreter (venv-first)
	pythonPath, err := findPythonInterpreter(pluginInfo.Path)
	if err != nil {
		return errors.Wrap(err, "failed to find Python interpreter for plugin")
	}

	// Get and sanitize the script path
	executable := pluginInfo.Manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH)
	if executable == "" {
		return fmt.Errorf("Python plugin executable not specified in manifest")
	}

	scriptPath, err := sanitizePythonScriptPath(pluginInfo.Path, executable)
	if err != nil {
		return err
	}

	// Verify the script file exists (using full path for the check)
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return fmt.Errorf("Python plugin script not found: %s", scriptPath)
	}

	// Build the command - pass executable name (relative to pluginDir), not full scriptPath
	// Since cmd.Dir is set to pluginDir, paths are resolved relative to it
	cmd := buildPythonCommand(pythonPath, executable, pluginInfo.Path)

	// Start API server if apiImpl and registrar are provided
	// This must happen BEFORE the Python subprocess starts so the port is ready
	if apiImpl != nil && registrar != nil {
		addr, cleanup, err := startAPIServer(apiImpl, registrar)
		if err != nil {
			return errors.Wrap(err, "failed to start PluginAPI server for Python plugin")
		}

		// Store cleanup function in supervisor for later shutdown
		sup.apiServerCleanup = cleanup

		// Set environment variable for Python subprocess
		// Preserve existing parent env vars and add the API target
		cmd.Env = append(os.Environ(), "MATTERMOST_PLUGIN_API_TARGET="+addr)
	}

	clientConfig.Cmd = cmd

	// For Python plugins, we don't use SecureConfig because:
	// 1. The checksum would be against the Python interpreter, not the plugin script
	// 2. The interpreter is typically shared across plugins
	// 3. Script integrity could be verified differently if needed in the future
	clientConfig.SecureConfig = nil

	return nil
}
