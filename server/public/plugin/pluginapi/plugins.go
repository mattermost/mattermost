package pluginapi

import (
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/pkg/errors"
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

// InstallPluginFromURL installs the plugin from the provided url.
//
// Minimum server version: 5.18
func (p *PluginService) InstallPluginFromURL(downloadURL string, replace bool) (*model.Manifest, error) {
	err := ensureServerVersion(p.api, "5.18.0")
	if err != nil {
		return nil, err
	}

	parsedURL, err := url.Parse(downloadURL)
	if err != nil {
		return nil, errors.Wrap(err, "error while parsing url")
	}

	client := &http.Client{Timeout: time.Hour}
	response, err := client.Get(parsedURL.String())
	if err != nil {
		return nil, errors.Wrap(err, "unable to download the plugin")
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, errors.Errorf("received %d status code while downloading plugin from server", response.StatusCode)
	}

	manifest, err := p.Install(response.Body, replace)
	if err != nil {
		return nil, errors.Wrap(err, "unable to install plugin on server")
	}

	return manifest, nil
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
