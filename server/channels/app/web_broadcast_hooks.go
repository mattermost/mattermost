// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	pUtils "github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
)

const (
	broadcastAddMentions  = "add_mentions"
	broadcastAddFollowers = "add_followers"
)

func (s *Server) makeBroadcastHooks() map[string]platform.BroadcastHook {
	return map[string]platform.BroadcastHook{
		broadcastAddMentions:  &addMentionsBroadcastHook{},
		broadcastAddFollowers: &addFollowersBroadcastHook{},
	}
}

type addMentionsBroadcastHook struct{}

func (h *addMentionsBroadcastHook) ShouldProcess(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) (bool, error) {
	if msg.EventType() != model.WebsocketEventPosted {
		return false, nil
	}

	mentions, ok := args["mentions"].(model.StringArray)
	if !ok {
		return false, fmt.Errorf("Invalid mentions value passed to addMentionsBroadcastHook: %v", args["mentions"])
	}

	// This hook will only modify the event if the current user is mentioned by the post
	return pUtils.Contains[string](mentions, webConn.UserId), nil
}

func (h *addMentionsBroadcastHook) Process(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) (*model.WebSocketEvent, error) {
	mentions, ok := args["mentions"].(model.StringArray)
	if !ok {
		return msg, fmt.Errorf("Invalid mentions value passed to addMentionsBroadcastHook: %v", args["mentions"])
	}

	hasMention := false
	if len(mentions) > 0 {
		hasMention = pUtils.Contains(mentions, webConn.UserId)
	}

	if hasMention {
		// Note that the client expects this field to be stringified
		msg.Add("mentions", model.ArrayToJSON([]string{webConn.UserId}))
	}

	return msg, nil
}

func UseAddMentionsHook(message *model.WebSocketEvent, mentionedUsers model.StringArray) {
	message.GetBroadcast().AddHook(broadcastAddMentions, map[string]any{
		"mentions": mentionedUsers,
	})
}

type addFollowersBroadcastHook struct{}

func (h *addFollowersBroadcastHook) ShouldProcess(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) (bool, error) {
	if msg.EventType() != model.WebsocketEventPosted {
		return false, nil
	}

	followers, ok := args["followers"].(model.StringArray)
	if !ok {
		return false, fmt.Errorf("Invalid followers value passed to addFollowersBroadcastHook: %v", args["followers"])
	}

	// This hook will only modify the event if the current user is following the post
	return pUtils.Contains[string](followers, webConn.UserId), nil
}

func (h *addFollowersBroadcastHook) Process(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) (*model.WebSocketEvent, error) {
	followers, ok := args["followers"].(model.StringArray)
	if !ok {
		return msg, fmt.Errorf("Invalid followers value passed to addFollowersBroadcastHook: %v", args["followers"])
	}

	isFollower := false
	if len(followers) > 0 {
		isFollower = pUtils.Contains(followers, webConn.UserId)
	}

	if isFollower {
		// Note that the client expects this field to be stringified
		msg.Add("followers", model.ArrayToJSON([]string{webConn.UserId}))
	}

	return msg, nil
}

func UseAddFollowersHook(message *model.WebSocketEvent, followers model.StringArray) {
	message.GetBroadcast().AddHook(broadcastAddFollowers, map[string]any{
		"followers": followers,
	})
}
