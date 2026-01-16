// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	plugin "github.com/hashicorp/go-plugin"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// isPythonPlugin determines if a plugin manifest indicates a Python plugin.
// Detection uses existing manifest fields without requiring schema changes:
// 1. Server executable ends with .py
// 2. Manifest props contains runtime="python" (transitional marker)
func isPythonPlugin(manifest *model.Manifest) bool {
	if manifest == nil {
		return false
	}

	// Check executable extension
	executable := manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH)
	if strings.HasSuffix(executable, ".py") {
		return true
	}

	// Check props for transitional runtime marker
	if manifest.Props != nil {
		if runtimeVal, ok := manifest.Props["runtime"]; ok {
			if runtimeStr, ok := runtimeVal.(string); ok && runtimeStr == "python" {
				return true
			}
		}
	}

	return false
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
			return path, nil
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
func buildPythonCommand(pythonPath, scriptPath, pluginDir string) *exec.Cmd {
	cmd := exec.Command(pythonPath, scriptPath)
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
// For Go plugins:
// - Delegates to existing WithExecutableFromManifest behavior
func WithCommandFromManifest(pluginInfo *model.BundleInfo) func(*supervisor, *plugin.ClientConfig) error {
	return func(sup *supervisor, clientConfig *plugin.ClientConfig) error {
		if isPythonPlugin(pluginInfo.Manifest) {
			return configurePythonCommand(pluginInfo, clientConfig)
		}

		// For Go plugins, use the existing implementation
		return WithExecutableFromManifest(pluginInfo)(sup, clientConfig)
	}
}

// configurePythonCommand sets up the ClientConfig.Cmd for a Python plugin.
func configurePythonCommand(pluginInfo *model.BundleInfo, clientConfig *plugin.ClientConfig) error {
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

	// Verify the script file exists
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return fmt.Errorf("Python plugin script not found: %s", scriptPath)
	}

	// Build the command
	cmd := buildPythonCommand(pythonPath, scriptPath, pluginInfo.Path)
	clientConfig.Cmd = cmd

	// For Python plugins, we don't use SecureConfig because:
	// 1. The checksum would be against the Python interpreter, not the plugin script
	// 2. The interpreter is typically shared across plugins
	// 3. Script integrity could be verified differently if needed in the future
	clientConfig.SecureConfig = nil

	return nil
}
