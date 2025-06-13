package pluginmage

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
	"github.com/magefile/mage/target"
)

type Webapp mg.Namespace

// Dependencies installs webapp dependencies using npm
func (Webapp) Dependencies() error {
	if !info.Manifest.HasWebapp() {
		return nil
	}

	nodeModulesPath := filepath.Join("webapp", "node_modules")
	packageJSONPath := filepath.Join("webapp", "package.json")

	// Check if node_modules is newer than package.json
	newer, err := target.Path(nodeModulesPath, packageJSONPath)
	if err != nil {
		return fmt.Errorf("failed to check dependencies: %w", err)
	}
	if !newer {
		return nil // node_modules is up to date
	}

	Logger.Info("Installing webapp dependencies",
		"namespace", "webapp",
		"target", "dependencies")

	cmd := NewCmd("webapp", "installdeps", nil)
	if err := cmd.WorkingDir("webapp").Run("npm", "install"); err != nil {
		return fmt.Errorf("failed to install webapp dependencies: %w", err)
	}

	return nil
}

// Build builds the webapp if it exists
func (Build) Webapp() error {
	mg.Deps(Webapp.Dependencies)

	if !info.Manifest.HasWebapp() {
		return nil
	}

	cmd := NewCmd("build", "webapp", nil)

	// Clean dist directory before creating it
	if err := sh.Rm(filepath.Join("webapp", "dist")); err != nil {
		return fmt.Errorf("failed to clean webapp/dist directory: %w", err)
	}

	// Create dist directory if it doesn't exist
	if err := os.MkdirAll(filepath.Join("webapp", "dist"), 0755); err != nil {
		return fmt.Errorf("failed to create webapp/dist directory: %w", err)
	}

	Logger.Info("Building webapp",
		"namespace", "build",
		"target", "webapp")

	if err := cmd.WorkingDir("webapp").Run("npm", "run", "build"); err != nil {
		return fmt.Errorf("failed to build webapp: %w", err)
	}

	return nil
}

// Watch builds and watches the webapp for changes, rebuilding automatically
func (Webapp) Watch() error {
	mg.Deps(Webapp.Dependencies, Build.Server)
	mg.SerialDeps(Build.Bundle)

	if !info.Manifest.HasWebapp() {
		return nil
	}

	cmd := NewCmd("webapp", "watch", nil)
	npmCmd := "build:watch"
	if os.Getenv("MM_DEBUG") != "" {
		npmCmd = "debug:watch"
	}

	Logger.Info("Watching webapp for changes",
		"namespace", "webapp",
		"target", "watch",
		"mode", npmCmd)

	if err := cmd.WorkingDir("webapp").Run("npm", "run", npmCmd); err != nil {
		return fmt.Errorf("failed to watch webapp: %w", err)
	}

	return nil
}
