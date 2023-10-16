// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	pUtils "github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/pkg/errors"
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

	mentions, err := getTypedArg[model.StringArray](args, "mentions")
	if err != nil {
		return false, errors.Wrap(err, "Invalid mentions value passed to addMentionsBroadcastHook")
	}

	// This hook will only modify the event if the current user is mentioned by the post
	return pUtils.Contains[string](mentions, webConn.UserId), nil
}

func (h *addMentionsBroadcastHook) Process(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) (*model.WebSocketEvent, error) {
	mentions, err := getTypedArg[model.StringArray](args, "mentions")
	if err != nil {
		return msg, errors.Wrap(err, "Invalid mentions value passed to addMentionsBroadcastHook")
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

	followers, err := getTypedArg[model.StringArray](args, "followers")
	if err != nil {
		return false, errors.Wrap(err, "Invalid followers value passed to addFollowersBroadcastHook")
	}

	// This hook will only modify the event if the current user is following the post
	return pUtils.Contains[string](followers, webConn.UserId), nil
}

func (h *addFollowersBroadcastHook) Process(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) (*model.WebSocketEvent, error) {
	followers, err := getTypedArg[model.StringArray](args, "followers")
	if err != nil {
		return msg, errors.Wrap(err, "Invalid followers value passed to addFollowersBroadcastHook")
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

// getTypedArg returns a correctly typed hook argument with the given key, reinterpreting the type using JSON encoding
// if necessary. This is needed because broadcast hook args are JSON encoded in a multi-server environment, and any
// type information is lost because those types aren't known at decode time.
func getTypedArg[T any](args map[string]any, key string) (T, error) {
	var value T

	untyped, ok := args[key]
	if !ok {
		return value, fmt.Errorf("No argument found with key: %s", key)
	}

	// If the value is already correct, just return it
	if typed, ok := untyped.(T); ok {
		return typed, nil
	}

	// Marshal and unmarshal the data with the correct typing information
	buf, err := json.Marshal(untyped)
	if err != nil {
		return value, err
	}

	err = json.Unmarshal(buf, &value)
	return value, err
}
