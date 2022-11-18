// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) checkIntegrationLimitsForConfigSave(oldConfig, newConfig *model.Config) *model.AppError {
	pluginIds := []string{}
	for pluginId, newState := range newConfig.PluginSettings.PluginStates {
		oldState, ok := oldConfig.PluginSettings.PluginStates[pluginId]
		if newState.Enable && !(ok && oldState.Enable) {
			pluginIds = append(pluginIds, pluginId)
		}
	}

	if len(pluginIds) > 0 {
		return a.checkIfIntegrationsMeetFreemiumLimits(pluginIds)
	}

	return nil
}

func (s *Server) getInstalledIntegrations() ([]*model.InstalledIntegration, *model.AppError) {
	out := []*model.InstalledIntegration{}

	pluginsEnvironment := s.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return out, nil
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return nil, model.NewAppError("getInstalledIntegrations", "app.plugin.sync.read_local_folder.app_error", nil, "", 0).Wrap(err)
	}

	pluginStates := s.Config().PluginSettings.PluginStates
	for _, p := range plugins {
		if _, ok := model.InstalledIntegrationsIgnoredPlugins[p.Manifest.Id]; !ok {
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

	// Sort result alphabetically, by display name.
	sort.SliceStable(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})

	return out, nil
}

func (a *App) checkIfIntegrationsMeetFreemiumLimits(originalPluginIds []string) *model.AppError {
	if !a.License().IsCloud() {
		return nil
	}

	pluginIds := map[string]bool{}
	for _, pluginId := range originalPluginIds {
		if _, ok := model.InstalledIntegrationsIgnoredPlugins[pluginId]; !ok {
			pluginIds[pluginId] = true
		}
	}

	limits, err := a.Cloud().GetCloudLimits("")
	if err != nil {
		a.Log().Error("Error fetching cloud limits for enabled integrations", mlog.Err(err))
		return nil
	}

	if limits == nil || limits.Integrations == nil || limits.Integrations.Enabled == nil {
		return nil
	}

	installed, appErr := a.ch.srv.getInstalledIntegrations()
	if appErr != nil {
		a.Log().Error("Failed to get installed integrations to check cloud limit", mlog.Err(appErr))
		return nil
	}

	enableCount := len(pluginIds)
	for _, integration := range installed {
		if _, ok := pluginIds[integration.ID]; !ok && integration.Enabled {
			enableCount++
		}
	}

	limit := *limits.Integrations.Enabled
	if enableCount > limit {
		return model.NewAppError("checkIfIntegrationMeetsFreemiumLimits", "app.install_integration.reached_max_limit.error", map[string]any{"NumIntegrations": limit}, "", http.StatusBadRequest)
	}

	return nil
}
