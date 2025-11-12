// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPostAcknowledgementsApp(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("SaveAcknowledgementForPost", func(t *testing.T) { testSaveAcknowledgementForPost(t) })
	t.Run("DeleteAcknowledgementForPost", func(t *testing.T) { testDeleteAcknowledgementForPost(t) })
	t.Run("GetAcknowledgementsForPostList", func(t *testing.T) { testGetAcknowledgementsForPostList(t) })
}

func testSaveAcknowledgementForPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("save acknowledgment for post should save acknowledgement", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
		}, "", true)

		require.Nil(t, err)

		acknowledgment, err := th.App.SaveAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, err)

		require.Greater(t, acknowledgment.AcknowledgedAt, int64(0))
		require.Equal(t, post.Id, acknowledgment.PostId)
		require.Equal(t, th.BasicUser.Id, acknowledgment.UserId)
	})

	t.Run("saving acknowledgment should update the post's update_at", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
		}, "", true)

		require.Nil(t, err)

		oldUpdateAt := post.UpdateAt

		_, err = th.App.SaveAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, err)

		post, err = th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, err)

		require.Greater(t, post.UpdateAt, oldUpdateAt)
	})
}

func testDeleteAcknowledgementForPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	post, err1 := th.App.CreatePostAsUser(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		CreateAt:  model.GetMillis(),
		Message:   "message",
	}, "", true)
	require.Nil(t, err1)

	t.Run("delete acknowledgment for post should delete acknowledgement", func(t *testing.T) {
		_, err := th.App.SaveAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, err)

		acknowledgments, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, acknowledgments, 1)
		require.Greater(t, acknowledgments[0].AcknowledgedAt, int64(0))

		err = th.App.DeleteAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, err)

		acknowledgments, err = th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Empty(t, acknowledgments)
	})

	t.Run("deleting acknowledgment should update the post's update_at", func(t *testing.T) {
		_, err := th.App.SaveAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, err)

		post, err = th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, err)

		oldUpdateAt := post.UpdateAt

		err = th.App.DeleteAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, err)

		post, err = th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, err)

		require.Greater(t, post.UpdateAt, oldUpdateAt)
	})

	t.Run("delete acknowledgment for post after 5 min after acknowledged should not delete", func(t *testing.T) {
		acknowledgement := &model.PostAcknowledgement{
			PostId:         post.Id,
			UserId:         th.BasicUser.Id,
			AcknowledgedAt: model.GetMillis() - int64(6*60*1000),
			ChannelId:      post.ChannelId,
		}
		_, nErr := th.App.Srv().Store().PostAcknowledgement().SaveWithModel(acknowledgement)
		require.NoError(t, nErr)

		acknowledgments, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, acknowledgments, 1)
		require.Greater(t, acknowledgments[0].AcknowledgedAt, int64(0))

		err = th.App.DeleteAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
		require.NotNil(t, err)
		require.Equal(t, 403, err.StatusCode)

		acknowledgments, err = th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, acknowledgments, 1)
		require.Greater(t, acknowledgments[0].AcknowledgedAt, int64(0))
	})
}

func testGetAcknowledgementsForPostList(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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
		_, err = th.App.SaveAcknowledgementForPost(th.Context, p1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		_, err = th.App.SaveAcknowledgementForPost(th.Context, p2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		_, err = th.App.SaveAcknowledgementForPost(th.Context, p1.Id, th.BasicUser2.Id)
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

		// Verify p1 acknowledgements (order-agnostic)
		require.Len(t, acknowledgementsMap[p1.Id], 2)
		require.ElementsMatch(t, acks1, acknowledgementsMap[p1.Id])

		// Verify p2 acknowledgements (order-agnostic)
		require.Len(t, acknowledgementsMap[p2.Id], 1)
		require.ElementsMatch(t, acks2, acknowledgementsMap[p2.Id])
		require.Nil(t, acknowledgementsMap[p3.Id])
	})
}
