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
