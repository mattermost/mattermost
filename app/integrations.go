// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (ch *Channels) getInstalledIntegrations() ([]*model.InstalledIntegration, *model.AppError) {
	out := []*model.InstalledIntegration{}

	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return out, nil
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return nil, model.NewAppError("getInstalledIntegrations", "app.plugin.sync.read_local_folder.app_error", nil, "", 0).Wrap(err)
	}

	pluginStates := ch.cfgSvc.Config().PluginSettings.PluginStates
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
