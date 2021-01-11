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
		if syncService := a.srv.GetSharedChannelSyncService(); syncService != nil {
			mlog.Debug(
				"Notifying shared channel sync service",
				mlog.String("channel_id", channel.Id),
				mlog.String("event", event),
			)
			syncService.NotifyChannelChanged(channel.Id)
		} else {
			mlog.Debug(
				"Notifying shared channel sync invoked but sync service is not running on this node. Skipping...",
				mlog.String("channel_id", channel.Id),
				mlog.String("event", event),
			)
		}
	}
}
