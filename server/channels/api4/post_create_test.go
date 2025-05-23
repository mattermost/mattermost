// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"strconv"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func makePendingPostId(user *model.User) string {
	return fmt.Sprintf("%s:%s", user.Id, strconv.FormatInt(model.GetMillis(), 10))
}

func TestCreatePostWithPendingPostId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	t.Run("should successfully create a post with PendingPostId", func(t *testing.T) {
		pendingPostId := makePendingPostId(th.BasicUser)
		post := &model.Post{
			ChannelId:     th.BasicChannel.Id,
			Message:       "message with pending id " + model.NewId(),
			PendingPostId: pendingPostId,
		}

		rpost, resp, err := client.CreatePost(context.Background(), post)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, rpost)
		require.Equal(t, post.Message, rpost.Message)
		require.Equal(t, th.BasicUser.Id, rpost.UserId)
		require.Equal(t, post.ChannelId, rpost.ChannelId)
		require.Equal(t, pendingPostId, rpost.PendingPostId)
	})

	t.Run("should not collide with other recent posts not authorized for the user", func(t *testing.T) {
		// First user creates a post with a PendingPostId
		pendingPostId := makePendingPostId(th.BasicUser)

		privateChannel := th.CreatePrivateChannel()

		firstPost, resp, err := client.CreatePost(context.Background(), &model.Post{
			ChannelId:     privateChannel.Id,
			Message:       "message1",
			PendingPostId: pendingPostId,
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, firstPost)

		// Second user attempts to create a post with the same PendingPostId
		client2 := th.CreateClient()
		_, _, err = client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, err)

		secondPost, resp, err := client2.CreatePost(context.Background(), &model.Post{
			ChannelId:     th.BasicChannel.Id,
			Message:       "message2",
			PendingPostId: pendingPostId,
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, secondPost)

		require.NotEqual(t, secondPost.Id, firstPost.Id)
		require.Equal(t, "message2", secondPost.Message)
	})
}
