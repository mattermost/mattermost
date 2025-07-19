package pluginmage

import (
	"github.com/magefile/mage/mg"
)

type Deploy mg.Namespace

// Upload builds and installs the plugin to a server
func (Deploy) Upload() error {
	mg.SerialDeps(Build.All, Build.Bundle, Pluginctl.Deploy)

	return nil
}
