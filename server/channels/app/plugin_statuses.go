// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/server/public/model"
)

// GetPluginStatus returns the status for a plugin installed on this server.
func (ch *Channels) GetPluginStatus(id string) (*model.PluginStatus, *model.AppError) {
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("GetPluginStatus", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	pluginStatuses, err := pluginsEnvironment.Statuses()
	if err != nil {
		return nil, model.NewAppError("GetPluginStatus", "app.plugin.get_statuses.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, status := range pluginStatuses {
		if status.PluginId == id {
			// Add our cluster ID
			if ch.srv.platform.Cluster() != nil {
				status.ClusterId = ch.srv.platform.Cluster().GetClusterId()
			}

			return status, nil
		}
	}

	return nil, model.NewAppError("GetPluginStatus", "app.plugin.not_installed.app_error", nil, "", http.StatusNotFound)
}

// GetPluginStatus returns the status for a plugin installed on this server.
func (a *App) GetPluginStatus(id string) (*model.PluginStatus, *model.AppError) {
	return a.ch.GetPluginStatus(id)
}

// GetPluginStatuses returns the status for plugins installed on this server.
func (ch *Channels) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("GetPluginStatuses", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	pluginStatuses, err := pluginsEnvironment.Statuses()
	if err != nil {
		return nil, model.NewAppError("GetPluginStatuses", "app.plugin.get_statuses.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Add our cluster ID
	for _, status := range pluginStatuses {
		if ch.srv.platform.Cluster() != nil {
			status.ClusterId = ch.srv.platform.Cluster().GetClusterId()
		} else {
			status.ClusterId = ""
		}
	}

	return pluginStatuses, nil
}

// GetPluginStatuses returns the status for plugins installed on this server.
func (a *App) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	return a.ch.GetPluginStatuses()
}

// GetClusterPluginStatuses returns the status for plugins installed anywhere in the cluster.
func (a *App) GetClusterPluginStatuses() (model.PluginStatuses, *model.AppError) {
	return a.ch.getClusterPluginStatuses()
}

func (ch *Channels) getClusterPluginStatuses() (model.PluginStatuses, *model.AppError) {
	pluginStatuses, err := ch.GetPluginStatuses()
	if err != nil {
		return nil, err
	}

	if ch.srv.platform.Cluster() != nil && *ch.cfgSvc.Config().ClusterSettings.Enable {
		clusterPluginStatuses, err := ch.srv.platform.Cluster().GetPluginStatuses()
		if err != nil {
			return nil, model.NewAppError("GetClusterPluginStatuses", "app.plugin.get_cluster_plugin_statuses.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		pluginStatuses = append(pluginStatuses, clusterPluginStatuses...)
	}

	return pluginStatuses, nil
}

func (ch *Channels) notifyPluginStatusesChanged() error {
	pluginStatuses, err := ch.getClusterPluginStatuses()
	if err != nil {
		return err
	}

	// Notify any system admins.
	message := model.NewWebSocketEvent(model.WebsocketEventPluginStatusesChanged, "", "", "", nil, "")
	message.Add("plugin_statuses", pluginStatuses)
	message.GetBroadcast().ContainsSensitiveData = true
	ch.srv.platform.Publish(message)

	return nil
}
