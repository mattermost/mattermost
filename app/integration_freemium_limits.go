package app

import (
	"encoding/json"
	"net/url"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-plugin-apps/apps"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
)

type InstalledIntegration struct {
	Type    string `json:"type"` // "plugin", "app", or "plugin-app"
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

var ignoredPlugins = []string{
	"playbooks",
	"focalboard",
	"com.mattermost.apps",
	"com.mattermost.nps",
}

func (a *App) GetEnabledIntegrationsForFreemiumLimits(c *request.Context) ([]*InstalledIntegration, *model.AppError) {
	out := []*InstalledIntegration{}

	penv := a.GetPluginsEnvironment()
	if penv == nil {
		return out, nil
	}

	plugins := penv.Active()
	for _, p := range plugins {
		ignore := false
		for _, id := range ignoredPlugins {
			if p.Manifest.Id == id {
				ignore = true
				break
			}
		}

		if !ignore {
			integration := &InstalledIntegration{
				Type:    "plugin",
				ID:      p.Manifest.Id,
				Name:    p.Manifest.Name,
				Version: p.Manifest.Version,
			}
			out = append(out, integration)
		}
	}

	if !penv.IsActive("com.mattermost.apps") {
		return out, nil
	}

	enabledApps, appErr := a.getEnabledApps(c)
	if appErr != nil {
		// TODO
	}

	for _, ap := range enabledApps {
		ignore := false
		for _, integration := range out {
			if integration.ID == string(ap.Manifest.AppID) {
				integration.Type = "plugin-app"
				ignore = true
			}
		}

		if !ignore {
			integration := &InstalledIntegration{
				Type:    "app",
				ID:      string(ap.Manifest.AppID),
				Name:    ap.Manifest.DisplayName,
				Version: string(ap.Manifest.Version),
			}
			out = append(out, integration)
		}
	}

	// Sort result alphabetically, by display name.
	sort.SliceStable(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})

	return out, nil
}

func (a *App) getEnabledApps(c *request.Context) ([]apps.ListedApp, *model.AppError) {
	rawURL := "/plugins/com.mattermost.apps/api/v1/marketplace"
	values := url.Values{
		"include_plugins": []string{"true"},
	}

	body := []byte{}

	r, appErr := a.doPluginRequest(c, "GET", rawURL, values, body)
	if appErr != nil {
		return nil, appErr
	}

	defer r.Body.Close()

	listed := []apps.ListedApp{}
	err := json.NewDecoder(r.Body).Decode(&listed)
	if err != nil {
		return nil, &model.AppError{
			// TODO
		}
	}

	result := []apps.ListedApp{}
	for _, ap := range listed {
		if ap.Enabled {
			result = append(result, ap)
		}
	}

	return result, nil
}
