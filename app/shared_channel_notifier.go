// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/sharedchannel"
)

var sharedChannelEventsForSync model.StringArray = []string{
	model.WEBSOCKET_EVENT_POSTED,
	model.WEBSOCKET_EVENT_POST_EDITED,
	model.WEBSOCKET_EVENT_POST_DELETED,
	model.WEBSOCKET_EVENT_REACTION_ADDED,
	model.WEBSOCKET_EVENT_REACTION_REMOVED,
}

var sharedChannelEventsForInvitation model.StringArray = []string{
	model.WEBSOCKET_EVENT_DIRECT_ADDED,
}

// SharedChannelSyncHandler is called when a websocket event is received by a cluster node.
// Only on the leader node it will notify the sync service to perform necessary updates to the remote for the given
// shared channel.
func (s *Server) SharedChannelSyncHandler(event *model.WebSocketEvent) {
	syncService := s.GetSharedChannelSyncService()
	if isEligibleForEvents(syncService, event, sharedChannelEventsForSync) {
		handleContentSync(s, syncService, event)
	} else if isEligibleForEvents(syncService, event, sharedChannelEventsForInvitation) {
		handleInvitation(s, syncService, event)
	}
}

func isEligibleForEvents(syncService SharedChannelServiceIFace, event *model.WebSocketEvent, events model.StringArray) bool {
	return syncServiceEnabled(syncService) &&
		eventHasChannel(event) &&
		events.Contains(event.EventType())
}

func eventHasChannel(event *model.WebSocketEvent) bool {
	return event.GetBroadcast() != nil &&
		event.GetBroadcast().ChannelId != ""
}

func syncServiceEnabled(syncService SharedChannelServiceIFace) bool {
	return syncService != nil &&
		syncService.Active()
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
	if channel == nil || !channel.IsShared() {
		return
	}

	creator := getUserFromEvent(s, event, "creator_id")
	// This is a termination condition, since on the other end when we are processing
	// the invite we re-triggering a model.WEBSOCKET_EVENT_DIRECT_ADDED, which will call this handler.
	// When the creator is remote, it means that this is a DM that was not originated from the current server
	// and therefore we do not need to do anything.
	if creator == nil || creator.IsRemote() {
		return
	}

	participant := getUserFromEvent(s, event, "teammate_id")

	if participant == nil {
		return
	}

	rc, err := s.Store.RemoteCluster().Get(*participant.RemoteId)
	if err != nil {
		mlog.Warn(
			"Couldn't find remote cluster for creating shared channel invitation for a DM",
			mlog.String("event", event.EventType()),
			mlog.String("remote_id", *participant.RemoteId),
		)
		return
	}

	if err := syncService.SendChannelInvite(channel, creator.Id, "", rc, sharedchannel.WithDirectParticipant(participant.Id)); err != nil {
		return
	}
}

func getUserFromEvent(s *Server, event *model.WebSocketEvent, key string) *model.User {
	userID, ok := event.GetData()[key].(string)
	if !ok || userID == "" {
		mlog.Warn(
			"Received websocket message that is eligible for sending an invitation but message does not have teammate_id present",
			mlog.String("event", event.EventType()),
		)
		return nil
	}

	user, err := s.Store.User().Get(userID)
	if err != nil {
		mlog.Warn(
			"Couldn't find user for creating shared channel invitation for a DM",
			mlog.String("event", event.EventType()),
		)
		return nil
	}

	return user
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
