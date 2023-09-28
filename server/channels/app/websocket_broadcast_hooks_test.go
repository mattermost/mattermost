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

func TestAddMentionsAndFollowersHook_HasChanges(t *testing.T) {
	hook := makeAddMentionsAndFollowersHook()

	userId := model.NewId()
	otherUserId1 := model.NewId()
	otherUserId2 := model.NewId()

	msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
	webConn := &platform.WebConn{
		UserId: userId,
	}

	t.Run("should make changes to a new post event with mentions for the current user", func(t *testing.T) {
		args := map[string]any{
			"mentions": model.StringArray{userId, otherUserId1},
		}

		assert.Equal(t, true, hook.HasChanges(msg, webConn, args))
	})

	t.Run("should make changes to a new post event followed by the current user", func(t *testing.T) {
		args := map[string]any{
			"followers": model.StringArray{otherUserId2, userId},
		}

		assert.Equal(t, true, hook.HasChanges(msg, webConn, args))
	})

	t.Run("should not make changes to a new post event mentioning and followed by no users", func(t *testing.T) {
		args := map[string]any{}

		assert.Equal(t, false, hook.HasChanges(msg, webConn, args))
	})

	t.Run("should not make changes to a new post event only mentioning and followed by other users", func(t *testing.T) {
		args := map[string]any{
			"mentions":  model.StringArray{otherUserId1},
			"followers": model.StringArray{otherUserId1, otherUserId2},
		}

		assert.Equal(t, false, hook.HasChanges(msg, webConn, args))
	})

	t.Run("should not make changes other types of events", func(t *testing.T) {
		args := map[string]any{
			"followers": model.StringArray{otherUserId2, userId},
		}

		assert.Equal(t, false, hook.HasChanges(model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", "", "", nil, ""), webConn, args))
		assert.Equal(t, false, hook.HasChanges(model.NewWebSocketEvent(model.WebsocketEventChannelCreated, "", "", "", nil, ""), webConn, args))
		assert.Equal(t, false, hook.HasChanges(model.NewWebSocketEvent(model.WebsocketEventDeleteTeam, "", "", "", nil, ""), webConn, args))
	})
}

func TestAddMentionsAndFollowersHook_Process(t *testing.T) {
	hook := makeAddMentionsAndFollowersHook()

	userId := model.NewId()
	otherUserId := model.NewId()

	webConn := &platform.WebConn{
		UserId: userId,
	}

	t.Run("should add a mentions entry for the current user", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		require.Nil(t, msg.GetData()["mentions"])
		require.Nil(t, msg.GetData()["followers"])

		hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{userId},
		})

		assert.Equal(t, `["`+userId+`"]`, msg.GetData()["mentions"])
		assert.Nil(t, msg.GetData()["followers"])
	})

	t.Run("should add a followers entry for the current user", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		require.Nil(t, msg.GetData()["mentions"])
		require.Nil(t, msg.GetData()["followers"])

		hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{userId},
		})

		assert.Nil(t, msg.GetData()["mentions"])
		assert.Equal(t, `["`+userId+`"]`, msg.GetData()["followers"])
	})

	t.Run("should not add a mentions for another user", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		require.Nil(t, msg.GetData()["mentions"])
		require.Nil(t, msg.GetData()["followers"])

		hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{otherUserId},
		})

		assert.Nil(t, msg.GetData()["mentions"])
		assert.Nil(t, msg.GetData()["followers"])
	})

	t.Run("should not add a followers entry for another user", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		require.Nil(t, msg.GetData()["mentions"])
		require.Nil(t, msg.GetData()["followers"])

		hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{otherUserId},
		})

		assert.Nil(t, msg.GetData()["mentions"])
		assert.Nil(t, msg.GetData()["followers"])
	})

	t.Run("should not mutate the data of the provided event", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		originalData := msg.GetData()

		require.Nil(t, originalData["mentions"])
		require.Nil(t, originalData["followers"])

		hook.Process(msg, webConn, map[string]any{
			"mentions":  model.StringArray{userId},
			"followers": model.StringArray{userId},
		})

		assert.Nil(t, originalData["mentions"])
		assert.Nil(t, originalData["followers"])
		assert.Equal(t, `["`+userId+`"]`, msg.GetData()["mentions"])
		assert.Equal(t, `["`+userId+`"]`, msg.GetData()["followers"])
	})
}
