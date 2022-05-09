package model

var InstalledIntegrationsIgnoredPlugins = []string{
	"playbooks",
	"focalboard",
	"com.mattermost.apps",
	"com.mattermost.nps",
	"com.mattermost.plugin-channel-export",
}

type InstalledIntegration struct {
	Type    string `json:"type"` // "plugin", "app", or "plugin-app" if it is an app installed as a plugin.
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
	Enabled bool   `json:"enabled"`
}
