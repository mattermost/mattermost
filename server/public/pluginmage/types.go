package pluginmage

import (
	"os"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	// defaultUtilitiesDir is the default path to mattermost-utilities directory
	// Override with MM_UTILITIES_DIR environment variable
	defaultUtilitiesDir = "../mattermost-utilities"

	// defaultAssetsDir is the default path to assets directory
	// Override with ASSETS_DIR environment variable
	defaultAssetsDir = "assets"

	// defaultGoTestFlags are the default flags used for go test
	// Override with GO_TEST_FLAGS environment variable
	defaultGoTestFlags = "-race"

	// defaultGoBuildFlags are the default flags used for go build
	// Override with GO_BUILD_FLAGS environment variable
	defaultGoBuildFlags = ""

	// defaultGoBuildGcflags are the default flags used for go build -gcflags
	// Override with GO_BUILD_GCFLAGS environment variable
	defaultGoBuildGcflags = ""
)

// pluginInfo holds all the information needed by magefile targets
type pluginInfo struct {
	Manifest            *model.Manifest
	HasPublic           bool
	HasUtilities        bool
	UtilitiesDir        string
	AssetsDir           string
	GoTestFlags         string
	GoBuildFlags        string
	GoBuildGcflags      string
	EnableDeveloperMode bool
}

// Init initializes values from environment variables and checks for existence of directories
func (i *pluginInfo) Init() {
	// Set utilities dir from environment if available
	if mmUtilitiesDir := os.Getenv("MM_UTILITIES_DIR"); mmUtilitiesDir != "" {
		i.UtilitiesDir = mmUtilitiesDir
	}

	// Set assets dir from environment if available
	if assetsDir := os.Getenv("ASSETS_DIR"); assetsDir != "" {
		i.AssetsDir = assetsDir
	}

	// Set go test flags from environment if available
	if goTestFlags := os.Getenv("GO_TEST_FLAGS"); goTestFlags != "" {
		i.GoTestFlags = goTestFlags
	}

	// Set go build flags from environment if available
	if goBuildFlags := os.Getenv("GO_BUILD_FLAGS"); goBuildFlags != "" {
		i.GoBuildFlags = goBuildFlags
	}

	// Check if public folder exists
	if _, err := os.Stat("public"); err == nil {
		i.HasPublic = true
	}

	// Check if mattermost-utilities exists
	if _, err := os.Stat(i.UtilitiesDir); err == nil {
		i.HasUtilities = true
	}

	if os.Getenv("MM_SERVICESETTINGS_ENABLEDEVELOPER") != "" {
		i.EnableDeveloperMode = true
	}

	if os.Getenv("MM_DEBUG") != "" {
		Logger.Info("MM_DEBUG is set, setting Go build gcflags to -gcflags all=-N -l. To disable, unset MM_DEBUG.")
		i.GoBuildGcflags = "-gcflags all=-N -l"
	}
}

// Defaults sets the default values for pluginInfo if they are not already set
func (i *pluginInfo) Defaults() {
	if i.UtilitiesDir == "" {
		i.UtilitiesDir = defaultUtilitiesDir
	}
	if i.AssetsDir == "" {
		i.AssetsDir = defaultAssetsDir
	}
	if i.GoTestFlags == "" {
		i.GoTestFlags = defaultGoTestFlags
	}
	if i.GoBuildFlags == "" {
		i.GoBuildFlags = defaultGoBuildFlags
	}
	if i.GoBuildGcflags == "" {
		i.GoBuildGcflags = defaultGoBuildGcflags
	}
}
