// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	pUtils "github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
)

const (
	broadcastAddMentions  = "add_mentions"
	broadcastAddFollowers = "addfollowers"
)

func (s *Server) makeBroadcastHooks() map[string]platform.BroadcastHook {
	return map[string]platform.BroadcastHook{
		broadcastAddMentions:  &addMentionsBroadcastHook{},
		broadcastAddFollowers: &addFollowersBroadcastHook{},
	}
}

type addMentionsBroadcastHook struct{}

func (h *addMentionsBroadcastHook) ShouldProcess(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) bool {
	if msg.EventType() != model.WebsocketEventPosted {
		return false
	}

	mentions, ok := args["mentions"].(model.StringArray)
	if !ok {
		mlog.Warn("Invalid mentions value passed to addMentionsBroadcastHook", mlog.Any("mentions", args["mentions"]))
		return false
	}

	// This hook will only modify the event if the current user is mentioned by the post
	return pUtils.Contains[string](mentions, webConn.UserId)
}

func (h *addMentionsBroadcastHook) Process(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) *model.WebSocketEvent {
	mentions, ok := args["mentions"].(model.StringArray)
	if !ok {
		mlog.Warn("Invalid mentions value passed to addMentionsBroadcastHook", mlog.Any("mentions", args["mentions"]))
		return msg
	}

	hasMention := false
	if len(mentions) > 0 {
		hasMention = pUtils.Contains(mentions, webConn.UserId)
	}

	if hasMention {
		// Note that the client expects this field to be stringified
		msg.Add("mentions", model.ArrayToJSON([]string{webConn.UserId}))
	}

	return msg
}

func UseAddMentionsHook(message *model.WebSocketEvent, mentionedUsers model.StringArray) {
	message.GetBroadcast().AddHook(broadcastAddMentions, map[string]any{
		"mentions": mentionedUsers,
	})
}

type addFollowersBroadcastHook struct{}

func (h *addFollowersBroadcastHook) ShouldProcess(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) bool {
	if msg.EventType() != model.WebsocketEventPosted {
		return false
	}

	followers, ok := args["followers"].(model.StringArray)
	if !ok {
		mlog.Warn("Invalid followers value passed to addFollowersBroadcastHook", mlog.Any("followers", args["followers"]))
		return false
	}

	// This hook will only modify the event if the current user is following the post
	return pUtils.Contains[string](followers, webConn.UserId)
}

func (h *addFollowersBroadcastHook) Process(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) *model.WebSocketEvent {
	followers, ok := args["followers"].(model.StringArray)
	if !ok {
		mlog.Warn("Invalid followers value passed to addFollowersBroadcastHook", mlog.Any("followers", args["followers"]))
		return msg
	}

	isFollower := false
	if len(followers) > 0 {
		isFollower = pUtils.Contains(followers, webConn.UserId)
	}

	if isFollower {
		// Note that the client expects this field to be stringified
		msg.Add("followers", model.ArrayToJSON([]string{webConn.UserId}))
	}

	return msg
}

func UseAddFollowersHook(message *model.WebSocketEvent, followers model.StringArray) {
	message.GetBroadcast().AddHook(broadcastAddFollowers, map[string]any{
		"followers": followers,
	})
}
