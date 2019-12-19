// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

// GetPluginStatus returns the status for a plugin installed on this server.
func (a *App) GetPluginStatus(id string) (*model.PluginStatus, *model.AppError) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("GetPluginStatus", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	pluginStatuses, err := pluginsEnvironment.Statuses()
	if err != nil {
		return nil, model.NewAppError("GetPluginStatus", "app.plugin.get_statuses.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Add our cluster ID
	for _, status := range pluginStatuses {
		if status.PluginId == id {
			status.ClusterId = a.GetClusterId()
			return status, nil
		}
	}
	return nil, model.NewAppError("GetPluginStatus", "app.plugin.not_installed.app_error", nil, "", http.StatusNotFound)
}

// GetPluginStatuses returns the status for plugins installed on this server.
func (a *App) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("GetPluginStatuses", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	pluginStatuses, err := pluginsEnvironment.Statuses()
	if err != nil {
		return nil, model.NewAppError("GetPluginStatuses", "app.plugin.get_statuses.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Add our cluster ID
	for _, status := range pluginStatuses {
		status.ClusterId = a.GetClusterId()
	}

	return pluginStatuses, nil
}

// GetClusterPluginStatuses returns the status for plugins installed anywhere in the cluster.
func (a *App) GetClusterPluginStatuses() (model.PluginStatuses, *model.AppError) {
	pluginStatuses, err := a.GetPluginStatuses()
	if err != nil {
		return nil, err
	}

	if a.Cluster != nil && *a.Config().ClusterSettings.Enable {
		clusterPluginStatuses, err := a.Cluster.GetPluginStatuses()
		if err != nil {
			return nil, model.NewAppError("GetClusterPluginStatuses", "app.plugin.get_cluster_plugin_statuses.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		pluginStatuses = append(pluginStatuses, clusterPluginStatuses...)
	}

	return pluginStatuses, nil
}

func (a *App) notifyPluginStatusesChanged() error {
	pluginStatuses, err := a.GetClusterPluginStatuses()
	if err != nil {
		return err
	}

	// Notify any system admins.
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_STATUSES_CHANGED, "", "", "", nil)
	message.Add("plugin_statuses", pluginStatuses)
	message.GetBroadcast().ContainsSensitiveData = true
	a.Publish(message)

	return nil
}
