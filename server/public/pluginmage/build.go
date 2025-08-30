package pluginmage

import (
	"bytes"
	"fmt"
	"runtime"
	"text/template"

	"github.com/magefile/mage/mg"
	"github.com/mattermost/mattermost/server/public/model"
)

// Build namespace for all build-related targets
type Build mg.Namespace

// BinaryBuildConfig defines the configuration for building a binary.
// This is used to build additional binaries in addition to the main server binary.
type BinaryBuildConfig struct {
	Name             string            // Friendly name for the binary
	PackagePath      string            // Path to the source directory containing go.mod
	OutputPath       string            // Destination path for the binary
	BinaryNameFormat string            // Format of the output binary
	BuildFlags       []string          // Additional build flags
	CGOEnabled       bool              // Whether to enable CGO
	Environment      map[string]string // Additional environment variables
	Platforms        []BuildPlatform   // Target platforms
	GoBuildFlags     string            // Optional build flags
	GcFlags          string            // Optional gcflags
	WorkingDir       string            // Working directory for the build
}

// GetBinaryName returns the binary name for a given platform using `BinaryFormat`
func (c *BinaryBuildConfig) GetBinaryName(goos, goarch string) (string, error) {
	tmpl, err := template.New("binary").Parse(c.BinaryNameFormat)
	if err != nil {
		return "", fmt.Errorf("failed to parse binary format: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, struct {
		Manifest *model.Manifest
		GOOS     string
		GOARCH   string
	}{
		Manifest: info.Manifest,
		GOOS:     goos,
		GOARCH:   goarch,
	}); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

// IsValid checks if the binary build configuration is valid
func (c *BinaryBuildConfig) IsValid() error {
	if c.Name == "" {
		return fmt.Errorf("name is required")
	}

	if c.BinaryNameFormat == "" {
		return fmt.Errorf("binary format is required")
	}

	if c.OutputPath == "" {
		return fmt.Errorf("output path is required")
	}

	// Validate each platform has required fields
	for i, platform := range c.Platforms {
		if platform.GOOS == "" {
			return fmt.Errorf("GOOS is required for platform %d", i)
		}
		if platform.GOARCH == "" {
			return fmt.Errorf("GOARCH is required for platform %d", i)
		}
	}

	return nil
}

// Defaults sets up default values for required fields if they are empty
func (c *BinaryBuildConfig) Defaults() *BinaryBuildConfig {
	// Set default platforms if none specified
	if len(c.Platforms) == 0 {
		if info.EnableDeveloperMode {
			c.Platforms = []BuildPlatform{
				{GOOS: runtime.GOOS, GOARCH: runtime.GOARCH},
			}
		} else {
			c.Platforms = DefaultPlatforms
		}
	}

	// Initialize environment map if nil
	if c.Environment == nil {
		c.Environment = make(map[string]string)
	}

	if c.CGOEnabled {
		c.Environment["CGO_ENABLED"] = "1"
	} else {
		c.Environment["CGO_ENABLED"] = "0"
	}

	return c
}

type BuildPlatform struct {
	GOOS   string
	GOARCH string
}

var (
	// DefaultPlatforms defines the standard platforms to build for
	DefaultPlatforms = []BuildPlatform{
		{GOOS: "linux", GOARCH: "amd64"},
		{GOOS: "linux", GOARCH: "arm64"},
	}

	// AllBinaries holds all binaries that need to be built
	AllBinaries []BinaryBuildConfig

	// DefaultBuildFlags are the default build flags for all binaries
	DefaultBuildFlags = []string{"-trimpath"}
)

// RegisterBinary adds a new binary configuration to be built during the build process
func RegisterBinary(config BinaryBuildConfig) {
	AllBinaries = append(AllBinaries, *config.Defaults())
}

// setupPluginBinary configures the main plugin binary to be built during the build process
func setupPluginBinary() {
	// Configure the main plugin binary
	pluginBinary := BinaryBuildConfig{
		Name:             "plugin",
		BinaryNameFormat: "plugin-{{.GOOS}}-{{.GOARCH}}",
		PackagePath:      "./server",
		OutputPath:       "./server/dist",
		Environment: map[string]string{
			"CGO_ENABLED": "0",
		},
	}

	// Set build flags if configured
	if info.GoBuildFlags != "" {
		pluginBinary.GoBuildFlags = info.GoBuildFlags
	}
	if info.GoBuildGcflags != "" {
		pluginBinary.GcFlags = info.GoBuildGcflags
	}

	// Add plugin binary as first element with defaults
	AllBinaries = append([]BinaryBuildConfig{*pluginBinary.Defaults()}, AllBinaries...)
}

// All builds both server, additional binaries, and webapp
func (Build) All() error {
	mg.Deps(Build.Server, Build.AdditionalBinaries, Build.Webapp)
	return nil
}
