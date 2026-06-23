// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestLocalCreatePost(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	t.Run("Create a post in local mode", func(t *testing.T) {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "local mode post " + model.NewId(),
			UserId:    th.BasicUser.Id,
		}

		rpost, resp, err := th.LocalClient.CreatePost(context.Background(), post)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, post.Message, rpost.Message)
		require.Equal(t, th.BasicUser.Id, rpost.UserId)
		require.Equal(t, th.BasicChannel.Id, rpost.ChannelId)
	})

	t.Run("Create a post in local mode without user_id", func(t *testing.T) {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "local mode post " + model.NewId(),
		}

		_, resp, err := th.LocalClient.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Create a post in local mode with invalid user_id", func(t *testing.T) {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "local mode post " + model.NewId(),
			UserId:    "invalid-user",
		}

		_, resp, err := th.LocalClient.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Create a post in local mode for nonexistent user", func(t *testing.T) {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "local mode post " + model.NewId(),
			UserId:    model.NewId(),
		}

		_, resp, err := th.LocalClient.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}
