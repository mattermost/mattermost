# Plugin Magefile Package

This package provides a comprehensive set of [Mage](https://magefile.org/) targets for building, developing, and deploying Mattermost plugins. It replaces the traditional Makefile-based build system with a more flexible and maintainable Go-based solution.

## Features

- 🔨 **Build System**
  - Server binary compilation with multi-platform support
  - Webapp (React/TypeScript) building and watching
  - Plugin bundle creation
  - Dependency management

- 🚀 **Development Tools**
  - Hot-reload capability with `Watch` target
  - Debug mode support via `MM_DEBUG`
  - Custom logging with namespace support
  - Local and remote deployment options

- 🛠️ **Deployment**
  - Plugin upload via Mattermost API
  - Enable/disable plugin management
  - Support for both local socket and HTTP API connections

## Usage

### Basic Commands

```bash
# Show all available commands
mage
# Build everything (server, webapp, bundle)
mage build:all
# Watch webapp for changes (hot-reload)
mage webapp:watch
# Deploy to local Mattermost server
mage pluginctl:deploy
```

### Environment Variables

- `MM_DEBUG`: Enable debug mode for both Go and webapp builds
- `MM_SERVICESETTINGS_SITEURL`: Mattermost server URL for deployment
- `MM_ADMIN_TOKEN`: Admin access token for deployment
- `MM_ADMIN_USERNAME`/`MM_ADMIN_PASSWORD`: Alternative authentication for deployment
- `MM_LOCALSOCKETPATH`: Unix socket path for local mode deployment
- `GO_BUILD_FLAGS`: Additional Go build flags
- `ASSETS_DIR`: Custom assets directory path

### Development Workflow

1. Install dependencies:
   ```bash
   mage webapp:dependencies
   ```

2. Start development mode:
   ```bash
   mage webapp:watch
   ```

3. Deploy changes:
   ```bash
   mage pluginctl:deploy
   ```

## Customizing

### Build more golang binaries

You can register additional binaries to build by calling `RegisterBinary` in a new file in the `magefiles` directory:

```go
// magefiles/binaries.go
func init() {
    // Register additional binaries to build
    plugin_magefile.RegisterBinary(plugin_magefile.BinaryBuildConfig{
        BinaryName: "custom-tool",
        PackagePath: "./tools/custom",
        OutputPath: "./dist/tools",
        Platforms: []plugin_magefile.BuildPlatform{
            {GOOS: "linux", GOARCH: "amd64"},
        },
    })
}
```

## Architecture

### Package Structure

- `build.go`: Build configuration and binary building logic
- `webapp.go`: Webapp building and development tools
- `dist.go`: Bundle creation and packaging
- `pluginctl.go`: Deployment and plugin management
- `server.go`: Server binary compilation
- `cmd.go`: Command execution utilities
- `log.go`: Custom logging implementation
- `types.go`: Core types and configuration
- `init.go`: Package initialization and environment setup
- `assets/`: Embedded assets handling

### Logging

We include a custom logging output implementation that allows to easily spot the namespace and target of the log line by using the `namespace` and `target` as attributes:

```go
	Logger.Info("Info",
		"namespace", "my namespace",
		"target", "my target")
```

### Running commands

We include a custom command runner that allows to run commands with the correct namespace and target:

```go
cmd := NewCmd("my namespace", "my target", map[string]string{
    "ENV_VAR": "value",
})
if err := cmd.Run("npm", "run", "build"); err != nil {
    return fmt.Errorf("failed to build webapp: %w", err)
}
```

# More information

- [Error codes](ERROR_CODES.md)