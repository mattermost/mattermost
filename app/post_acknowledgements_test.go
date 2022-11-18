// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestPostAcknowledgementsApp(t *testing.T) {
	t.Run("SaveAcknowledgementForPost", func(t *testing.T) { testSaveAcknowledgementForPost(t) })
	t.Run("DeleteAcknowledgementForPost", func(t *testing.T) { testDeleteAcknowledgementForPost(t) })
	t.Run("GetAcknowledgementsForPostList", func(t *testing.T) { testGetAcknowledgementsForPostList(t) })
}

func testSaveAcknowledgementForPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("save acknowledgment for post should save acknowledgement", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
		}, "", true)

		require.Nil(t, err)

		acknowledgment, err := th.App.SaveAcknowledgementForPost(th.Context, th.BasicUser.Id, post.Id)
		require.Nil(t, err)

		require.Greater(t, acknowledgment.AcknowledgedAt, int64(0))
		require.Equal(t, post.Id, acknowledgment.PostId)
		require.Equal(t, th.BasicUser.Id, acknowledgment.UserId)
	})
}

func testDeleteAcknowledgementForPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		CreateAt:  model.GetMillis(),
		Message:   "message",
	}, "", true)
	require.Nil(t, err)

	t.Run("delete acknowledgment for post should delete acknowledgement", func(t *testing.T) {
		_, err = th.App.SaveAcknowledgementForPost(th.Context, th.BasicUser.Id, post.Id)
		require.Nil(t, err)

		acknowledgments, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, acknowledgments, 1)
		require.Greater(t, acknowledgments[0].AcknowledgedAt, int64(0))

		err = th.App.DeleteAcknowledgementForPost(th.Context, th.BasicUser.Id, post.Id)
		require.Nil(t, err)

		acknowledgments, err = th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Empty(t, acknowledgments)
	})

	t.Run("delete acknowledgment for post after 5 min after acknowledged should not delete", func(t *testing.T) {
		_, nErr := th.App.Srv().Store().PostAcknowledgement().Save(th.BasicUser.Id, post.Id, model.GetMillis()-int64(6*60*1000))
		require.NoError(t, nErr)

		acknowledgments, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, acknowledgments, 1)
		require.Greater(t, acknowledgments[0].AcknowledgedAt, int64(0))

		err = th.App.DeleteAcknowledgementForPost(th.Context, th.BasicUser.Id, post.Id)
		require.NotNil(t, err)
		require.Equal(t, 403, err.StatusCode)

		acknowledgments, err = th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, acknowledgments, 1)
		require.Greater(t, acknowledgments[0].AcknowledgedAt, int64(0))
	})
}

func testGetAcknowledgementsForPostList(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	p1, err := th.App.CreatePostAsUser(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		CreateAt:  model.GetMillis(),
		Message:   "message",
	}, "", true)
	require.Nil(t, err)

	p2, err := th.App.CreatePostAsUser(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		CreateAt:  model.GetMillis(),
		Message:   "message",
	}, "", true)
	require.Nil(t, err)

	p3, err := th.App.CreatePostAsUser(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		CreateAt:  model.GetMillis(),
		Message:   "message",
	}, "", true)
	require.Nil(t, err)

	t.Run("get acknowledgments for post list should return a map", func(t *testing.T) {
		_, err = th.App.SaveAcknowledgementForPost(th.Context, th.BasicUser.Id, p1.Id)
		require.Nil(t, err)
		_, err = th.App.SaveAcknowledgementForPost(th.Context, th.BasicUser.Id, p2.Id)
		require.Nil(t, err)
		_, err = th.App.SaveAcknowledgementForPost(th.Context, th.BasicUser2.Id, p1.Id)
		require.Nil(t, err)

		postList := model.NewPostList()
		postList.AddPost(p1)
		postList.AddOrder(p1.Id)
		postList.AddPost(p2)
		postList.AddOrder(p2.Id)
		postList.AddPost(p3)
		postList.AddOrder(p3.Id)

		acks1, err := th.App.GetAcknowledgementsForPost(p1.Id)
		require.Nil(t, err)
		acks2, err := th.App.GetAcknowledgementsForPost(p2.Id)
		require.Nil(t, err)

		acknowledgementsMap, err := th.App.GetAcknowledgementsForPostList(postList)
		require.Nil(t, err)

		expected := map[string][]*model.PostAcknowledgement{
			p1.Id: acks1,
			p2.Id: acks2,
		}
		require.Equal(t, expected, acknowledgementsMap)
		require.Len(t, acknowledgementsMap[p1.Id], 2)
		require.Len(t, acknowledgementsMap[p2.Id], 1)
		require.Nil(t, acknowledgementsMap[p3.Id])
	})
}
