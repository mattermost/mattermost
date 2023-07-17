// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"context"
	"fmt"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
)

var sharedChannelEventsForSync model.StringArray = []string{
	model.WebsocketEventPosted,
	model.WebsocketEventPostEdited,
	model.WebsocketEventPostDeleted,
	model.WebsocketEventReactionAdded,
	model.WebsocketEventReactionRemoved,
}

var sharedChannelEventsForInvitation model.StringArray = []string{
	model.WebsocketEventDirectAdded,
}

// SharedChannelSyncHandler is called when a websocket event is received by a cluster node.
// Only on the leader node it will notify the sync service to perform necessary updates to the remote for the given
// shared channel.
func (ps *PlatformService) SharedChannelSyncHandler(event *model.WebSocketEvent) {
	syncService := ps.sharedChannelService
	if syncService == nil {
		return
	}
	if isEligibleForEvents(syncService, event, sharedChannelEventsForSync) {
		err := handleContentSync(ps, syncService, event)
		if err != nil {
			mlog.Warn(
				err.Error(),
				mlog.String("event", event.EventType()),
				mlog.String("action", "content_sync"),
			)
		}
	} else if isEligibleForEvents(syncService, event, sharedChannelEventsForInvitation) {
		err := handleInvitation(ps, syncService, event)
		if err != nil {
			mlog.Warn(
				err.Error(),
				mlog.String("event", event.EventType()),
				mlog.String("action", "invitation"),
			)
		}
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

func handleContentSync(ps *PlatformService, syncService SharedChannelServiceIFace, event *model.WebSocketEvent) error {
	channel, err := findChannel(ps, event.GetBroadcast().ChannelId)
	if err != nil {
		return err
	}

	if channel != nil && channel.IsShared() {
		syncService.NotifyChannelChanged(channel.Id)
	}

	return nil
}

func handleInvitation(ps *PlatformService, syncService SharedChannelServiceIFace, event *model.WebSocketEvent) error {
	channel, err := findChannel(ps, event.GetBroadcast().ChannelId)
	if err != nil {
		return err
	}

	if channel == nil || !channel.IsShared() {
		return nil
	}

	creator, err := getUserFromEvent(ps, event, "creator_id")
	if err != nil {
		return err
	}
	// This is a termination condition, since on the other end when we are processing
	// the invite we are re-triggering a model.WEBSOCKET_EVENT_DIRECT_ADDED, which will call this handler.
	// When the creator is remote, it means that this is a DM that was not originated from the current server
	// and therefore we do not need to do anything.
	if creator == nil || creator.IsRemote() {
		return nil
	}

	participant, err := getUserFromEvent(ps, event, "teammate_id")
	if err != nil {
		return err
	}

	if participant == nil || participant.RemoteId == nil {
		return nil
	}

	rc, err := ps.Store.RemoteCluster().Get(*participant.RemoteId)
	if err != nil {
		return errors.Wrap(err, fmt.Sprintf("couldn't find remote cluster %s, for creating shared channel invitation for a DM", *participant.RemoteId))
	}

	return syncService.SendChannelInvite(channel, creator.Id, rc, sharedchannel.WithDirectParticipantID(creator.Id), sharedchannel.WithDirectParticipantID(participant.Id))
}

func getUserFromEvent(ps *PlatformService, event *model.WebSocketEvent, key string) (*model.User, error) {
	userID, ok := event.GetData()[key].(string)
	if !ok || userID == "" {
		return nil, fmt.Errorf("received websocket message that is eligible for sending an invitation but message does not have `%s` present", key)
	}

	user, err := ps.Store.User().Get(context.Background(), userID)
	if err != nil {
		return nil, errors.Wrap(err, "couldn't find user for creating shared channel invitation for a DM")
	}

	return user, nil
}

func findChannel(server *PlatformService, channelId string) (*model.Channel, error) {
	channel, err := server.Store.Channel().Get(channelId, true)
	if err != nil {
		return nil, errors.Wrap(err, "received websocket message that is eligible for shared channel sync but channel does not exist")
	}

	return channel, nil
}
