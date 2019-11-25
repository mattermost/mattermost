// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

// notifyClusterPluginEvent publishes `event` to other clusters.
func (a *App) notifyClusterPluginEvent(event string, data model.PluginEventData) {
	if a.Cluster != nil {
		a.Cluster.SendClusterMessage(&model.ClusterMessage{
			Event:            event,
			SendType:         model.CLUSTER_SEND_RELIABLE,
			WaitForAllToSend: true,
			Data:             data.ToJson(),
		})
	}
}

func (a *App) servePluginEvent(event string, payload interface{}, destPlugin string, sourcePlugin string) *model.AppError {
	hooks, error := a.GetPluginsEnvironment().HooksForPlugin(destPlugin)

	if error != nil {
		return &model.AppError{Message: "Hooks not found for plugin"}
	}

	context := &plugin.Context{
		RequestId:      model.NewId(),
		SourcePluginId: sourcePlugin,
	}

	hooks.ReceivePluginEvent(context, event, payload)

	return nil
}
