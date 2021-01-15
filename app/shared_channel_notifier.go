// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

// NotifySharedChannelSync signals the syncService to start syncing shared channel updates
func (a *App) NotifySharedChannelSync(channel *model.Channel, event string) {
	if channel.IsShared() {
		syncService := a.srv.GetSharedChannelSyncService()

		// When the sync service is running on the node, trigger syncing without broadcasting
		if syncService != nil && syncService.Active() {
			mlog.Debug(
				"Notifying shared channel sync service",
				mlog.String("channel_id", channel.Id),
				mlog.String("event", event),
			)
			syncService.NotifyChannelChanged(channel.Id)
			return
		}

		// When the sync service is not running on the node and cluster is enabled, broadcast shared sync message
		if a.Cluster() != nil {
			mlog.Debug(
				"Shared channel sync service is not running on this node. Broadcasting sync cluster event.",
				mlog.String("channel_id", channel.Id),
				mlog.String("event", event),
			)

			a.Cluster().SendClusterMessage(&model.ClusterMessage{
				Event:    model.CLUSTER_EVENT_SYNC_SHARED_CHANNEL,
				SendType: model.CLUSTER_SEND_RELIABLE,
				Props: map[string]string{
					"channelId": channel.Id,
					"event":     event,
				},
			})

			return
		}

		// When clustering is not enabled, there is nothing we can do, just log an error for admins to react
		mlog.Warn(
			"Shared channel sync service is not running on this node and clustering is not enabled. Enable clustering to resolve.",
			mlog.String("channelId", channel.Id),
			mlog.String("event", event),
		)
	}
}

func (a *App) ServerSyncSharedChannelHandler(props map[string]string) {
	if syncService := a.srv.GetSharedChannelSyncService(); syncService != nil && syncService.Active() {
		mlog.Debug(
			"Notifying shared channel sync service",
			mlog.String("channel_id", props["channelId"]),
			mlog.String("event", props["event"]),
		)
		syncService.NotifyChannelChanged(props["channelId"])
		return
	}

	mlog.Debug(
		"Received cluster message for shared channel sync but sync service is not running on this node. Skipping...",
		mlog.String("channel_id", props["channelId"]),
		mlog.String("event", props["event"]),
	)
}
