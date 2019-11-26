package pluginapi

import (
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// PluginService exposes methods to manipulate the set of plugins as well as communicate with
// other plugin instances.
type PluginService struct {
	api plugin.API
}

// List will return a list of plugin manifests for currently active plugins.
//
// Minimum server version: 5.6
func (p *PluginService) List() ([]*model.Manifest, error) {
	manifests, appErr := p.api.GetPlugins()

	return manifests, normalizeAppErr(appErr)
}

// Install will upload another plugin with tar.gz file.
// Previous version will be replaced on replace true.
//
// Minimum server version: 5.18
func (p *PluginService) Install(file io.Reader, replace bool) (*model.Manifest, error) {
	manifest, appErr := p.api.InstallPlugin(file, replace)

	return manifest, normalizeAppErr(appErr)
}

// Enable will enable an plugin installed.
//
// Minimum server version: 5.6
func (p *PluginService) Enable(id string) error {
	appErr := p.api.EnablePlugin(id)

	return normalizeAppErr(appErr)
}

// Disable will disable an enabled plugin.
//
// Minimum server version: 5.6
func (p *PluginService) Disable(id string) error {
	appErr := p.api.DisablePlugin(id)

	return normalizeAppErr(appErr)
}

// Remove will disable and delete a plugin.
//
// Minimum server version: 5.6
func (p *PluginService) Remove(id string) error {
	appErr := p.api.RemovePlugin(id)

	return normalizeAppErr(appErr)
}

// GetPluginStatus will return the status of a plugin.
//
// Minimum server version: 5.6
func (p *PluginService) GetPluginStatus(id string) (*model.PluginStatus, error) {
	pluginStatus, appErr := p.api.GetPluginStatus(id)

	return pluginStatus, normalizeAppErr(appErr)
}

// HTTP allows inter-plugin requests to plugin APIs.
//
// Minimum server version: 5.18
func (p *PluginService) HTTP(request *http.Request) *http.Response {
	return p.api.PluginHTTP(request)
}
