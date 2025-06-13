package pluginmage

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

// Bundle creates a distributable bundle of the plugin
func (Build) Bundle() error {
	mg.Deps(Build.Server, Build.Webapp)

	// Clean dist directory
	if err := sh.Rm("dist"); err != nil {
		return fmt.Errorf("failed to clean dist directory: %w", err)
	}

	// Create dist directory and plugin subdirectory
	pluginDir := filepath.Join("dist", info.Manifest.Id)
	if err := os.MkdirAll(pluginDir, 0755); err != nil {
		return fmt.Errorf("failed to create plugin directory: %w", err)
	}

	// Copy plugin.json to dist/plugin_id/
	if err := sh.Copy(filepath.Join(pluginDir, "plugin.json"), "plugin.json"); err != nil {
		return fmt.Errorf("failed to copy plugin.json: %w", err)
	}

	// Copy server files if they exist
	if info.Manifest.HasServer() {
		if err := copyDir(filepath.Join("server", "dist"), filepath.Join(pluginDir, "server", "dist")); err != nil {
			return fmt.Errorf("failed to copy server files: %w", err)
		}
	}

	// Copy webapp files if they exist
	if info.Manifest.HasWebapp() {
		if err := copyDir(filepath.Join("webapp", "dist"), filepath.Join(pluginDir, "webapp", "dist")); err != nil {
			return fmt.Errorf("failed to copy webapp files: %w", err)
		}
	}

	// Copy assets if directory is set and exists
	if info.AssetsDir != "" {
		if err := copyDir(info.AssetsDir, filepath.Join(pluginDir, "assets")); err != nil {
			return fmt.Errorf("failed to copy assets: %w", err)
		}
	}

	// Create the bundle in dist directory
	bundleName := fmt.Sprintf("%s-%s.tar.gz", info.Manifest.Id, info.Manifest.Version)
	cmd := NewCmd("dist", "bundle", nil)
	if err := cmd.Run("tar", "-C", "dist", "-czf", filepath.Join("dist", bundleName), info.Manifest.Id); err != nil {
		return fmt.Errorf("failed to create bundle: %w", err)
	}

	Logger.Info("Plugin built",
		"namespace", "dist",
		"target", "bundle",
		"path", fmt.Sprintf("dist/%s", bundleName))

	return nil
}

// copyDir copies a directory from src to dst, creating dst if it doesn't exist
func copyDir(src, dst string) error {
	if _, err := os.Stat(src); os.IsNotExist(err) {
		return nil // Source doesn't exist, skip copying
	}

	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	writer := NewLogWriter("dist", "copy", slog.LevelDebug)
	ok, err := sh.Exec(nil, writer, writer, "cp", "-R", src+"/.", dst)
	if err != nil || !ok {
		return fmt.Errorf("failed to copy directory: %w", err)
	}

	return nil
}
