// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

const (
	broadcastAddMentions        = "add_mentions"
	broadcastAddFollowers       = "add_followers"
	broadcastPostedAck          = "posted_ack"
	broadcastPermalink          = "permalink"
	broadcastBurnOnRead         = "burn_on_read"
	broadcastBurnOnReadReaction = "burn_on_read_reaction"
)

func (s *Server) makeBroadcastHooks() map[string]platform.BroadcastHook {
	return map[string]platform.BroadcastHook{
		broadcastAddMentions:        &addMentionsBroadcastHook{},
		broadcastAddFollowers:       &addFollowersBroadcastHook{},
		broadcastPostedAck:          &postedAckBroadcastHook{},
		broadcastPermalink:          &permalinkBroadcastHook{},
		broadcastBurnOnRead:         &burnOnReadBroadcastHook{},
		broadcastBurnOnReadReaction: &burnOnReadReactionBroadcastHook{},
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

type postedAckBroadcastHook struct{}

func usePostedAckHook(message *model.WebSocketEvent, postedUserId string, channelType model.ChannelType, usersToNotify []string) {
	message.GetBroadcast().AddHook(broadcastPostedAck, map[string]any{
		"posted_user_id": postedUserId,
		"channel_type":   channelType,
		"users":          usersToNotify,
	})
}

func (h *postedAckBroadcastHook) Process(msg *platform.HookedWebSocketEvent, webConn *platform.WebConn, args map[string]any) error {
	// Don't ACK unless we say to explicitly
	if !(webConn.PostedAck && webConn.Active.Load()) {
		return nil
	}

	postedUserId, err := getTypedArg[string](args, "posted_user_id")
	if err != nil {
		return errors.Wrap(err, "Invalid posted_user_id value passed to postedAckBroadcastHook")
	}

	// Don't ACK your own posts
	if postedUserId == webConn.UserId {
		return nil
	}

	// Add if we have mentions or followers
	// This works since we currently do have an order for broadcast hooks, but this probably should be reworked going forward
	if msg.Get("followers") != nil || msg.Get("mentions") != nil {
		msg.Add("should_ack", true)
		incrementWebsocketCounter(webConn)
		return nil
	}

	channelType, err := getTypedArg[model.ChannelType](args, "channel_type")
	if err != nil {
		return errors.Wrap(err, "Invalid channel_type value passed to postedAckBroadcastHook")
	}

	// Always ACK direct channels
	if channelType == model.ChannelTypeDirect {
		msg.Add("should_ack", true)
		incrementWebsocketCounter(webConn)
		return nil
	}

	users, err := getTypedArg[model.StringArray](args, "users")
	if err != nil {
		return errors.Wrap(err, "Invalid users value passed to postedAckBroadcastHook")
	}

	if len(users) > 0 && slices.Contains(users, webConn.UserId) {
		msg.Add("should_ack", true)
		incrementWebsocketCounter(webConn)
	}

	return nil
}

func usePermalinkHook(message *model.WebSocketEvent, authorID string, previewChannel *model.Channel, postJSON string) {
	message.GetBroadcast().AddHook(broadcastPermalink, map[string]any{
		"author_id":       authorID,
		"preview_channel": previewChannel,
		"post_json":       postJSON,
	})
}

func useBurnOnReadHook(message *model.WebSocketEvent, authorID string, revealedPostJSON, postJSON string) {
	message.GetBroadcast().AddHook(broadcastBurnOnRead, map[string]any{
		"author_id":          authorID,
		"post_json":          postJSON,
		"revealed_post_json": revealedPostJSON,
	})
}

type permalinkBroadcastHook struct{}

// Process adds the post medata from usePermalinkHook to the websocket event
// if the user has access to the containing channel.
func (h *permalinkBroadcastHook) Process(msg *platform.HookedWebSocketEvent, webConn *platform.WebConn, args map[string]any) error {
	previewChannel, err := getTypedArg[*model.Channel](args, "preview_channel")
	if err != nil {
		return errors.Wrap(err, "Invalid preview_channel value passed to permalinkBroadcastHook")
	}

	rctx := request.EmptyContext(webConn.Platform.Log())
	if !webConn.Suite.HasPermissionToReadChannel(rctx, webConn.UserId, previewChannel) {
		// Do nothing.
		// In this case, the sanitized post is already attached to the ws event.
		return nil
	}

	// Else, we set the post with permalink preview.
	postJSON, err := getTypedArg[string](args, "post_json")
	if err != nil {
		return errors.Wrap(err, "Invalid post_json value passed to permalinkBroadcastHook")
	}
	msg.Add("post", postJSON)

	return nil
}

type burnOnReadBroadcastHook struct{}

func (h *burnOnReadBroadcastHook) Process(msg *platform.HookedWebSocketEvent, webConn *platform.WebConn, args map[string]any) error {
	userID := webConn.UserId
	authorID, err := getTypedArg[string](args, "author_id")
	if err != nil {
		return errors.Wrap(err, "Invalid author_id value passed to burnOnReadBroadcastHook")
	}
	if userID == authorID {
		postJSON, tErr := getTypedArg[string](args, "revealed_post_json")
		if tErr != nil {
			return errors.Wrap(tErr, "Invalid revealed_post_json value passed to burnOnReadBroadcastHook")
		}
		msg.Add("post", postJSON)
		return nil
	}

	postJSON, err := getTypedArg[string](args, "post_json")
	if err != nil {
		return errors.Wrap(err, "Invalid post_json value passed to burnOnReadBroadcastHook")
	}

	var post model.Post
	err = json.Unmarshal([]byte(postJSON), &post)
	if err != nil {
		return errors.Wrap(err, "Invalid post value passed to burnOnReadBroadcastHook")
	}
	post.Metadata.Embeds = []*model.PostEmbed{}
	post.Metadata.Emojis = []*model.Emoji{}
	post.Metadata.Reactions = []*model.Reaction{}
	postJSON, err = post.ToJSON()
	if err != nil {
		return errors.Wrap(err, "Invalid post value passed to burnOnReadBroadcastHook")
	}

	msg.Add("post", postJSON)

	return nil
}

type burnOnReadReactionBroadcastHook struct{}

func (h *burnOnReadReactionBroadcastHook) Process(msg *platform.HookedWebSocketEvent, webConn *platform.WebConn, args map[string]any) error {
	userID := webConn.UserId
	authorID, err := getTypedArg[string](args, "author_id")
	if err != nil {
		return errors.Wrap(err, "Invalid author_id value passed to burnOnReadReactionBroadcastHook")
	}

	// If user is the author, they can always see reactions
	if userID == authorID {
		return nil
	}

	postID, err := getTypedArg[string](args, "post_id")
	if err != nil {
		return errors.Wrap(err, "Invalid post_id value passed to burnOnReadReactionBroadcastHook")
	}

	// Check if user has a valid read receipt
	rctx := request.EmptyContext(webConn.Platform.Log())
	receipt, err := webConn.Platform.Store.ReadReceipt().Get(rctx, postID, userID)
	if err != nil && !store.IsErrNotFound(err) {
		return errors.Wrap(err, "Failed to get read receipt in burnOnReadReactionBroadcastHook")
	}

	// If no receipt or receipt expired, remove reaction data
	if receipt == nil || receipt.ExpireAt < model.GetMillis() {
		msg.Event().Reject()
		return nil
	}

	// User has valid receipt, allow the reaction event
	return nil
}

func useBurnOnReadReactionHook(message *model.WebSocketEvent, authorID, postID string) {
	message.GetBroadcast().AddHook(broadcastBurnOnReadReaction, map[string]any{
		"author_id": authorID,
		"post_id":   postID,
	})
}

func incrementWebsocketCounter(wc *platform.WebConn) {
	if wc.Platform.Metrics() == nil {
		return
	}

	if !(wc.Platform.Config().FeatureFlags.NotificationMonitoring && *wc.Platform.Config().MetricsSettings.EnableNotificationMetrics) {
		return
	}

	wc.Platform.Metrics().IncrementNotificationCounter(model.NotificationTypeWebsocket, model.NotificationNoPlatform)
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
