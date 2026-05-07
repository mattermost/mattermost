// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveValueBroadcastParams(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("post object type returns channel ID from the post", func(t *testing.T) {
		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "test post for broadcast",
		}
		created, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		teamID, channelID, err := th.App.resolveValueBroadcastParams(th.Context, model.PropertyFieldObjectTypePost, created.Id)
		require.Nil(t, err)
		assert.Empty(t, teamID)
		assert.Equal(t, th.BasicChannel.Id, channelID)
	})

	t.Run("channel object type returns the target ID as channel ID", func(t *testing.T) {
		teamID, channelID, err := th.App.resolveValueBroadcastParams(th.Context, model.PropertyFieldObjectTypeChannel, "chan123")
		require.Nil(t, err)
		assert.Empty(t, teamID)
		assert.Equal(t, "chan123", channelID)
	})

	t.Run("user object type returns empty strings for system-wide broadcast", func(t *testing.T) {
		teamID, channelID, err := th.App.resolveValueBroadcastParams(th.Context, model.PropertyFieldObjectTypeUser, "user123")
		require.Nil(t, err)
		assert.Empty(t, teamID)
		assert.Empty(t, channelID)
	})

	t.Run("system object type returns empty strings for system-wide broadcast", func(t *testing.T) {
		teamID, channelID, err := th.App.resolveValueBroadcastParams(th.Context, model.PropertyFieldObjectTypeSystem, model.PropertyValueSystemTargetID)
		require.Nil(t, err)
		assert.Empty(t, teamID)
		assert.Empty(t, channelID)
	})

	t.Run("unknown object type returns an error", func(t *testing.T) {
		_, _, err := th.App.resolveValueBroadcastParams(th.Context, "unknown_type", "target123")
		require.NotNil(t, err)
		assert.Equal(t, "app.property_value.resolve_broadcast_params.unknown_object_type.app_error", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})
}
