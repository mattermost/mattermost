// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

var SharedChannelEventsForSync model.StringArray = []string{
	model.WEBSOCKET_EVENT_POSTED,
	model.WEBSOCKET_EVENT_POST_EDITED,
	model.WEBSOCKET_EVENT_POST_DELETED,
	model.WEBSOCKET_EVENT_REACTION_ADDED,
	model.WEBSOCKET_EVENT_REACTION_REMOVED,
}

// NotifySharedChannelSync signals the syncService to start syncing shared channel updates
func (a *App) NotifySharedChannelSync(channel *model.Channel, event string) {
	if !SharedChannelEventsForSync.Contains(event) || !channel.IsShared() {
		return
	}

	syncService := a.srv.GetSharedChannelSyncService()
	if syncService == nil || !syncService.Active() {
		return
	}

	// When the sync service is running on the node, trigger syncing without broadcasting
	mlog.Debug(
		"Notifying shared channel sync service",
		mlog.String("channel_id", channel.Id),
		mlog.String("event", event),
	)
	syncService.NotifyChannelChanged(channel.Id)
}

// ServerSyncSharedChannelHandler is called when a websocket event is received by a cluster node.
// Only on the leader node it will notify the sync service to start syncing content for the given
// shared channel.
func (a *App) ServerSyncSharedChannelHandler(event *model.WebSocketEvent) {
	syncService := a.srv.GetSharedChannelSyncService()
	if syncService == nil || !syncService.Active() {
		mlog.Debug(
			"Received eligible shared channel sync event but sync service is not running on this node, skipping...",
			mlog.String("event", event.EventType()),
		)
		return
	}

	if !SharedChannelEventsForSync.Contains(event.EventType()) {
		mlog.Debug(
			"Received websocket message that is not eligible to trigger shared channel sync, skipping...",
			mlog.String("event", event.EventType()),
		)
	}

	if event.GetBroadcast() == nil || event.GetBroadcast().ChannelId == "" {
		return
	}

	channel, err := a.GetChannel(event.GetBroadcast().ChannelId)
	if err != nil {
		mlog.Warn(
			"Received websocket message that is eligible for shared channel sync but channel does not exist",
			mlog.String("event", event.EventType()),
		)
		return
	}

	a.NotifySharedChannelSync(channel, event.EventType())
}
