// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
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

func (h *addMentionsBroadcastHook) Process(msg *platform.HookedWebSocketEvent, webConn *platform.WebConn, args map[string]any) error {
	mentions, err := getTypedArg[model.StringArray](args, "mentions")
	if err != nil {
		return errors.Wrap(err, "Invalid mentions value passed to addMentionsBroadcastHook")
	}

	if len(mentions) > 0 && slices.Contains(mentions, webConn.UserId) {
		// Note that the client expects this field to be stringified
		msg.Add("mentions", model.ArrayToJSON([]string{webConn.UserId}))
	}

	return nil
}

func useAddMentionsHook(message *model.WebSocketEvent, mentionedUsers model.StringArray) {
	message.GetBroadcast().AddHook(broadcastAddMentions, map[string]any{
		"mentions": mentionedUsers,
	})
}

type addFollowersBroadcastHook struct{}

func (h *addFollowersBroadcastHook) Process(msg *platform.HookedWebSocketEvent, webConn *platform.WebConn, args map[string]any) error {
	followers, err := getTypedArg[model.StringArray](args, "followers")
	if err != nil {
		return errors.Wrap(err, "Invalid followers value passed to addFollowersBroadcastHook")
	}

	if len(followers) > 0 && slices.Contains(followers, webConn.UserId) {
		// Note that the client expects this field to be stringified
		msg.Add("followers", model.ArrayToJSON([]string{webConn.UserId}))
	}

	return nil
}

func useAddFollowersHook(message *model.WebSocketEvent, followers model.StringArray) {
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
