// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
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
