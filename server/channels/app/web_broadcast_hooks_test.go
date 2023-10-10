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

func TestAddMentionsHook_ShouldProcess(t *testing.T) {
	hook := &addMentionsBroadcastHook{}

	userID := model.NewId()
	otherUserID := model.NewId()

	msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
	webConn := &platform.WebConn{
		UserId: userID,
	}

	t.Run("should make changes to a new post event with a mention for the current user", func(t *testing.T) {
		args := map[string]any{
			"mentions": model.StringArray{userID, otherUserID},
		}

		assert.Equal(t, true, hook.ShouldProcess(msg, webConn, args))
	})

	t.Run("should not make changes to a new post event only mentioning another user", func(t *testing.T) {
		args := map[string]any{
			"mentions": model.StringArray{otherUserID},
		}

		assert.Equal(t, false, hook.ShouldProcess(msg, webConn, args))
	})

	t.Run("should not make changes other types of events", func(t *testing.T) {
		args := map[string]any{
			"followers": model.StringArray{otherUserID, userID},
		}

		assert.Equal(t, false, hook.ShouldProcess(model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", "", "", nil, ""), webConn, args))
		assert.Equal(t, false, hook.ShouldProcess(model.NewWebSocketEvent(model.WebsocketEventChannelCreated, "", "", "", nil, ""), webConn, args))
		assert.Equal(t, false, hook.ShouldProcess(model.NewWebSocketEvent(model.WebsocketEventDeleteTeam, "", "", "", nil, ""), webConn, args))
	})
}

func TestAddMentionsHook_Process(t *testing.T) {
	hook := &addMentionsBroadcastHook{}

	userID := model.NewId()
	otherUserID := model.NewId()

	webConn := &platform.WebConn{
		UserId: userID,
	}

	t.Run("should add a mentions entry for the current user", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		require.Nil(t, msg.GetData()["mentions"])

		hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{userID},
		})

		assert.Equal(t, `["`+userID+`"]`, msg.GetData()["mentions"])
		assert.Nil(t, msg.GetData()["followers"])
	})

	t.Run("should not add a mentions entry for another user", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		require.Nil(t, msg.GetData()["mentions"])

		hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{otherUserID},
		})

		assert.Nil(t, msg.GetData()["mentions"])
	})

	t.Run("should not mutate the data of the provided event", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		originalData := msg.GetData()

		require.Nil(t, originalData["mentions"])

		hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{userID},
		})

		assert.Nil(t, originalData["mentions"])
		assert.Equal(t, `["`+userID+`"]`, msg.GetData()["mentions"])
	})
}

func TestAddFollowersHook_ShouldProcess(t *testing.T) {
	hook := &addFollowersBroadcastHook{}

	userID := model.NewId()
	otherUserID := model.NewId()

	msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
	webConn := &platform.WebConn{
		UserId: userID,
	}

	t.Run("should make changes to a new post event followed by the current user", func(t *testing.T) {
		args := map[string]any{
			"followers": model.StringArray{otherUserID, userID},
		}

		assert.Equal(t, true, hook.ShouldProcess(msg, webConn, args))
	})

	t.Run("should not make changes to a new post event only followed by another user", func(t *testing.T) {
		args := map[string]any{
			"followers": model.StringArray{otherUserID},
		}

		assert.Equal(t, false, hook.ShouldProcess(msg, webConn, args))
	})

	t.Run("should not make changes other types of events", func(t *testing.T) {
		args := map[string]any{
			"followers": model.StringArray{otherUserID, userID},
		}

		assert.Equal(t, false, hook.ShouldProcess(model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", "", "", nil, ""), webConn, args))
		assert.Equal(t, false, hook.ShouldProcess(model.NewWebSocketEvent(model.WebsocketEventChannelCreated, "", "", "", nil, ""), webConn, args))
		assert.Equal(t, false, hook.ShouldProcess(model.NewWebSocketEvent(model.WebsocketEventDeleteTeam, "", "", "", nil, ""), webConn, args))
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
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		require.Nil(t, msg.GetData()["followers"])

		hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{userID},
		})

		assert.Equal(t, `["`+userID+`"]`, msg.GetData()["followers"])
	})

	t.Run("should not add a followers entry for another user", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		require.Nil(t, msg.GetData()["followers"])

		hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{otherUserID},
		})

		assert.Nil(t, msg.GetData()["followers"])
	})

	t.Run("should not mutate the data of the provided event", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		originalData := msg.GetData()

		require.Nil(t, originalData["followers"])

		hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{userID},
		})

		assert.Nil(t, originalData["followers"])
		assert.Equal(t, `["`+userID+`"]`, msg.GetData()["followers"])
	})
}

func TestAddMentionsAndAddFollowersHooks(t *testing.T) {
	addMentionsHook := &addMentionsBroadcastHook{}
	addFollowersHook := &addFollowersBroadcastHook{}

	userID := model.NewId()

	webConn := &platform.WebConn{
		UserId: userID,
	}

	msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

	originalData := msg.GetData()

	require.Nil(t, originalData["mentions"])
	require.Nil(t, originalData["followers"])

	addMentionsHook.Process(msg, webConn, map[string]any{
		"mentions": model.StringArray{userID},
	})
	addFollowersHook.Process(msg, webConn, map[string]any{
		"followers": model.StringArray{userID},
	})

	t.Run("should be able to add both mentions and followers to a single event", func(t *testing.T) {
		assert.Equal(t, `["`+userID+`"]`, msg.GetData()["followers"])
		assert.Equal(t, `["`+userID+`"]`, msg.GetData()["mentions"])
	})

	t.Run("should not mutate the data of the provided event", func(t *testing.T) {
		assert.Nil(t, originalData["mentions"])
		assert.Nil(t, originalData["followers"])
	})
}
