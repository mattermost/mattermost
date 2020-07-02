// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type PluginIntegration struct {
	Integration *model.PluginIntegration
	PluginID    string
}

func (a *App) RegisterPluginIntegration(pluginID string, integration *model.PluginIntegration) error {
	a.Srv().pluginIntegrationsLock.Lock()
	defer a.Srv().pluginIntegrationsLock.Unlock()

	integration.PluginID = pluginID
	for _, pt := range a.Srv().pluginIntegrations {
		if pt.Integration.RequestURL == integration.RequestURL && pt.Integration.Location == integration.Location {
			if pt.PluginID == pluginID {
				pt.Integration = integration
				return nil
			}
		}
	}

	a.Srv().pluginIntegrations = append(a.Srv().pluginIntegrations, &PluginIntegration{
		Integration: integration,
		PluginID:    pluginID,
	})
	return nil
}

func (a *App) UnregisterPluginIntegration(pluginID, location, requestURL string) {
	a.Srv().pluginIntegrationsLock.Lock()
	defer a.Srv().pluginIntegrationsLock.Unlock()

	var remaining []*PluginIntegration
	for _, pt := range a.Srv().pluginIntegrations {
		if pt.PluginID != pluginID || pt.Integration.Location != location || pt.Integration.RequestURL != requestURL {
			remaining = append(remaining, pt)
		}
	}
	a.Srv().pluginIntegrations = remaining
}

func (a *App) UnregisterPluginIntegrations(pluginID string) {
	a.Srv().pluginIntegrationsLock.Lock()
	defer a.Srv().pluginIntegrationsLock.Unlock()

	var remaining []*PluginIntegration
	for _, pt := range a.Srv().pluginIntegrations {
		if pt.PluginID != pluginID {
			remaining = append(remaining, pt)
		}
	}
	a.Srv().pluginIntegrations = remaining
}

func (a *App) PluginIntegrations() []*model.PluginIntegration {
	a.Srv().pluginIntegrationsLock.Lock()
	defer a.Srv().pluginIntegrationsLock.Unlock()

	var triggers []*model.PluginIntegration
	for _, pt := range a.Srv().pluginIntegrations {
		triggers = append(triggers, pt.Integration)
	}
	return triggers
}
