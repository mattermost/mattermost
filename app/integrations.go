// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type ListedApp struct {
	Manifest struct {
		AppID       string `json:"app_id"`
		DisplayName string `json:"display_name"`
		Version     string `json:"version"`
	}

	Installed bool `json:"installed"`
	Enabled   bool `json:"enabled"`
}

func (ch *Channels) getInstalledIntegrations() ([]*model.InstalledIntegration, *model.AppError) {
	out := []*model.InstalledIntegration{}

	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return out, nil
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return nil, model.NewAppError("getInstalledIntegrations", "app.plugin.sync.read_local_folder.app_error", nil, err.Error(), 0)
	}

	pluginStates := ch.cfgSvc.Config().PluginSettings.PluginStates
	for _, p := range plugins {
		ignore := false
		for _, id := range model.InstalledIntegrationsIgnoredPlugins {
			if p.Manifest.Id == id {
				ignore = true
				break
			}
		}

		if !ignore {
			enabled := false
			if state, ok := pluginStates[p.Manifest.Id]; ok {
				enabled = state.Enable
			}

			integration := &model.InstalledIntegration{
				Type:    "plugin",
				ID:      p.Manifest.Id,
				Name:    p.Manifest.Name,
				Version: p.Manifest.Version,
				Enabled: enabled,
			}

			out = append(out, integration)
		}
	}

	if pluginsEnvironment.IsActive("com.mattermost.apps") {
		enabledApps, appErr := ch.getInstalledApps()
		if appErr != nil {
			ch.srv.Log.Warn("Failed to fetch installed Apps", mlog.Err(appErr))
			enabledApps = []ListedApp{}
		}

		for _, ap := range enabledApps {
			ignore := false
			for _, integration := range out {
				if integration.ID == ap.Manifest.AppID {
					integration.Type = "plugin-app"
					ignore = true
				}
			}

			if !ignore {
				integration := &model.InstalledIntegration{
					Type:    "app",
					ID:      ap.Manifest.AppID,
					Name:    ap.Manifest.DisplayName,
					Version: ap.Manifest.Version,
					Enabled: ap.Enabled,
				}

				out = append(out, integration)
			}
		}
	}

	// Sort result alphabetically, by display name.
	sort.SliceStable(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})

	return out, nil
}

func (ch *Channels) getInstalledApps() ([]ListedApp, *model.AppError) {
	rawURL := "/plugins/com.mattermost.apps/api/v1/marketplace"
	values := url.Values{
		"include_plugins": []string{"true"},
	}

	r, appErr := ch.doPluginRequest(request.EmptyContext(), "GET", rawURL, values, nil)
	if appErr != nil {
		return nil, appErr
	}

	defer r.Body.Close()

	listed := []ListedApp{}
	err := json.NewDecoder(r.Body).Decode(&listed)
	if err != nil {
		return nil, model.NewAppError("getInstalledApps", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result := []ListedApp{}
	for _, ap := range listed {
		if ap.Installed {
			result = append(result, ap)
		}
	}

	return result, nil
}

func (a *App) checkIfIntegrationMeetsFreemiumLimits(pluginID string) *model.AppError {
	if !a.Config().FeatureFlags.CloudFree {
		return nil
	}

	for _, id := range model.InstalledIntegrationsIgnoredPlugins {
		if pluginID == id {
			return nil
		}
	}

	limits, err := a.Cloud().GetCloudLimits("")
	if err != nil {
		return model.NewAppError("checkIfIntegrationMeetsFreemiumLimits", "api.cloud.request_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if limits == nil || limits.Integrations == nil || limits.Integrations.Enabled == nil {
		return nil
	}

	installed, appErr := a.ch.getInstalledIntegrations()
	if appErr != nil {
		return appErr
	}

	enableCount := 1
	for _, integration := range installed {
		if integration.Enabled && integration.ID != pluginID {
			enableCount++
		}
	}

	limit := *limits.Integrations.Enabled
	if enableCount > limit {
		return model.NewAppError("checkIfIntegrationMeetsFreemiumLimits", "app.install_integration.reached_max_limit.error", map[string]interface{}{"NumIntegrations": limit}, "", http.StatusBadRequest)
	}

	return nil
}
