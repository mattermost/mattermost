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

// ServerSyncSharedChannelHandler is called when a websocket event is received by a cluster node.
// Only on the leader node it will notify the sync service to start syncing content for the given
// shared channel.
func (s *Server) ServerSyncSharedChannelHandler(event *model.WebSocketEvent) {
	syncService := s.GetSharedChannelSyncService()
	if !isEligibleForContentSync(syncService, event) {
		return
	}

	channel, err := s.Store.Channel().Get(event.GetBroadcast().ChannelId, true)
	if err != nil {
		mlog.Warn(
			"Received websocket message that is eligible for shared channel sync but channel does not exist",
			mlog.String("event", event.EventType()),
		)
		return
	}

	if !channel.IsShared() {
		return
	}

	mlog.Debug(
		"Notifying shared channel sync service",
		mlog.String("channel_id", channel.Id),
	)
	syncService.NotifyChannelChanged(channel.Id)
}

func isEligibleForContentSync(syncService SharedChannelServiceIFace, event *model.WebSocketEvent) bool {
	return syncService != nil &&
		syncService.Active() &&
		event.GetBroadcast() != nil &&
		event.GetBroadcast().ChannelId != "" &&
		SharedChannelEventsForSync.Contains(event.EventType())
}
