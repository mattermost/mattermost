// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAddMentionsHook_Process(t *testing.T) {
	hook := &addMentionsBroadcastHook{}

	userID := model.NewId()
	otherUserID := model.NewId()

	webConn := &platform.WebConn{
		UserId: userID,
	}

	t.Run("should add a mentions entry for the current user", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		require.Nil(t, msg.Event().GetData()["mentions"])

		hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{userID},
		})

		assert.Equal(t, `["`+userID+`"]`, msg.Event().GetData()["mentions"])
		assert.Nil(t, msg.Event().GetData()["followers"])
	})

	t.Run("should not add a mentions entry for another user", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		require.Nil(t, msg.Event().GetData()["mentions"])

		hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{otherUserID},
		})

		assert.Nil(t, msg.Event().GetData()["mentions"])
	})
}

func TestAddFollowersHook_Process(t *testing.T) {
	hook := &addFollowersBroadcastHook{}

	userID := model.NewId()
	otherUserID := model.NewId()

	webConn := &platform.WebConn{
		UserId: userID,
	}

	t.Run("should add a followers entry for the current user", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		require.Nil(t, msg.Event().GetData()["followers"])

		hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{userID},
		})

		assert.Equal(t, `["`+userID+`"]`, msg.Event().GetData()["followers"])
	})

	t.Run("should not add a followers entry for another user", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		require.Nil(t, msg.Event().GetData()["followers"])

		hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{otherUserID},
		})

		assert.Nil(t, msg.Event().GetData()["followers"])
	})
}

func TestPostedAckHook_Process(t *testing.T) {
	hook := &postedAckBroadcastHook{}
	userID := model.NewId()
	webConn := &platform.WebConn{
		UserId:    userID,
		Platform:  &platform.PlatformService{},
		PostedAck: true,
	}
	webConn.Active.Store(true)
	webConn.SetSession(&model.Session{})

	t.Run("should ack if user is in the list of users to notify", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		hook.Process(msg, webConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeOpen,
			"users":          []string{userID},
		})

		assert.True(t, msg.Event().GetData()["should_ack"].(bool))
	})

	t.Run("should not ack if user is not in the list of users to notify", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		hook.Process(msg, webConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeOpen,
			"users":          []string{},
		})

		assert.Nil(t, msg.Event().GetData()["should_ack"])
	})

	t.Run("should not ack if you are the user who posted", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		hook.Process(msg, webConn, map[string]any{
			"posted_user_id": userID,
			"channel_type":   model.ChannelTypeOpen,
			"users":          []string{userID},
		})

		assert.Nil(t, msg.Event().GetData()["should_ack"])
	})

	t.Run("should ack if the channel is a DM", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		hook.Process(msg, webConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeDirect,
			"users":          []string{},
		})

		assert.True(t, msg.Event().GetData()["should_ack"].(bool))
	})

	t.Run("should not ack if posted ack is false", func(t *testing.T) {
		noAckWebConn := &platform.WebConn{
			UserId:    userID,
			Platform:  &platform.PlatformService{},
			PostedAck: false,
		}
		noAckWebConn.Active.Store(true)
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		hook.Process(msg, noAckWebConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeDirect,
			"users":          []string{},
		})

		assert.Nil(t, msg.Event().GetData()["should_ack"])
	})

	t.Run("should not ack if connection is not active", func(t *testing.T) {
		inactiveWebConn := &platform.WebConn{
			UserId:    userID,
			Platform:  &platform.PlatformService{},
			PostedAck: false,
		}
		inactiveWebConn.Active.Store(true)
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		hook.Process(msg, inactiveWebConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeDirect,
			"users":          []string{},
		})

		assert.Nil(t, msg.Event().GetData()["should_ack"])
	})
}

func TestAddMentionsAndAddFollowersHooks(t *testing.T) {
	addMentionsHook := &addMentionsBroadcastHook{}
	addFollowersHook := &addFollowersBroadcastHook{}

	userID := model.NewId()

	webConn := &platform.WebConn{
		UserId: userID,
	}

	msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

	originalData := msg.Event().GetData()

	require.Nil(t, originalData["mentions"])
	require.Nil(t, originalData["followers"])

	addMentionsHook.Process(msg, webConn, map[string]any{
		"mentions": model.StringArray{userID},
	})
	addFollowersHook.Process(msg, webConn, map[string]any{
		"followers": model.StringArray{userID},
	})

	t.Run("should be able to add both mentions and followers to a single event", func(t *testing.T) {
		assert.Equal(t, `["`+userID+`"]`, msg.Event().GetData()["followers"])
		assert.Equal(t, `["`+userID+`"]`, msg.Event().GetData()["mentions"])
	})
}
