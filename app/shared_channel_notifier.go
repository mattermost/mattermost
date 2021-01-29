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

var SharedChannelEventsForInvitation model.StringArray = []string{
	model.WEBSOCKET_EVENT_DIRECT_ADDED,
}

// ServerSyncSharedChannelHandler is called when a websocket event is received by a cluster node.
// Only on the leader node it will notify the sync service to perform necessary updates to the remote for the given
// shared channel.
func (s *Server) ServerSyncSharedChannelHandler(event *model.WebSocketEvent) {
	syncService := s.GetSharedChannelSyncService()
	if isEligibleForContentSync(syncService, event) {
		handleContentSync(s, syncService, event)
	} else if isEligibleForInvitation(syncService, event) {
		handleInvitation(s, syncService, event)
	}
}

func isEligibleForInvitation(syncService SharedChannelServiceIFace, event *model.WebSocketEvent) bool {
	return syncService != nil &&
		syncService.Active() &&
		event.GetBroadcast() != nil &&
		event.GetBroadcast().ChannelId != "" &&
		SharedChannelEventsForInvitation.Contains(event.EventType())
}

func isEligibleForContentSync(syncService SharedChannelServiceIFace, event *model.WebSocketEvent) bool {
	return syncService != nil &&
		syncService.Active() &&
		event.GetBroadcast() != nil &&
		event.GetBroadcast().ChannelId != "" &&
		SharedChannelEventsForSync.Contains(event.EventType())
}

func handleContentSync(s *Server, syncService SharedChannelServiceIFace, event *model.WebSocketEvent) {
	channel := findChannel(s, event.GetBroadcast().ChannelId, event)
	if channel == nil {
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

func handleInvitation(s *Server, syncService SharedChannelServiceIFace, event *model.WebSocketEvent) {
	channel := findChannel(s, event.GetBroadcast().ChannelId, event)
	if channel == nil {
		return
	}
	userID, ok := event.GetData()["teammate_id"].(string)
	if !ok || userID == "" {
		mlog.Warn(
			"Received websocket message that is eligible for sending an invitation but message does not have teammate_id present",
			mlog.String("event", event.EventType()),
		)
		return
	}
	user, err := s.Store.User().Get(userID)
	if err != nil {
		mlog.Warn(
			"Couldn't find user for creating shared channel invitation for a DM",
			mlog.String("event", event.EventType()),
		)
		return
	}

	rc, err := s.Store.RemoteCluster().Get(user.RemoteID)
	if err != nil {
		mlog.Warn(
			"Couldn't find remote cluster for creating shared channel invitation for a DM",
			mlog.String("event", event.EventType()),
			mlog.String("remote_id", user.RemoteID),
		)
		return
	}

	if err := syncService.SendChannelInvite(channel, userID, "", rc); err != nil {
		return
	}
}

func findChannel(server *Server, channelId string, event *model.WebSocketEvent) *model.Channel {
	channel, err := server.Store.Channel().Get(channelId, true)
	if err != nil {
		mlog.Warn(
			"Received websocket message that is eligible for shared channel sync but channel does not exist",
			mlog.String("event", event.EventType()),
		)
		return nil
	}

	return channel
}
