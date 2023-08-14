package command

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pkg/errors"
)

// PluginAPI is the plugin API interface required to manage slash commands.
type PluginAPI interface {
	GetBundlePath() (string, error)
}

// GetIconData returns the base64 encoding of a icon for a given path.
// The data returned may be used for slash command autocomplete.
func GetIconData(api PluginAPI, iconPath string) (string, error) {
	bundlePath, err := api.GetBundlePath()
	if err != nil {
		return "", errors.Wrap(err, "couldn't get bundle path")
	}

	icon, err := os.ReadFile(filepath.Join(bundlePath, iconPath))
	if err != nil {
		return "", errors.Wrap(err, "failed to open icon")
	}

	return fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(icon)), nil
}
