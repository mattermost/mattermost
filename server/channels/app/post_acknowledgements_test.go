// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPostAcknowledgementsApp(t *testing.T) {
	t.Run("SaveAcknowledgementForPost", func(t *testing.T) { testSaveAcknowledgementForPost(t) })
	t.Run("DeleteAcknowledgementForPost", func(t *testing.T) { testDeleteAcknowledgementForPost(t) })
	t.Run("GetAcknowledgementsForPostList", func(t *testing.T) { testGetAcknowledgementsForPostList(t) })
	t.Run("SaveAcknowledgementsForPost", func(t *testing.T) { testSaveAcknowledgementsForPost(t) })
	t.Run("DeleteAcknowledgementsForPost", func(t *testing.T) { testDeleteAcknowledgementsForPost(t) })
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
	th := Setup(t).InitBasic()
	defer th.TearDown()
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
		_, nErr := th.App.Srv().Store().PostAcknowledgement().Save(post.Id, th.BasicUser.Id, model.GetMillis()-int64(6*60*1000))
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

func testSaveAcknowledgementsForPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("save multiple acknowledgments for post should save all acknowledgements", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message for batch testing",
		}, "", true)
		require.Nil(t, err)

		// Create list of user IDs
		userIDs := []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}

		// Save acknowledgements in batch
		acks, err := th.App.SaveAcknowledgementsForPost(th.Context, post.Id, userIDs)
		require.Nil(t, err)
		require.Len(t, acks, 3)

		// Verify saved acknowledgements
		savedAcks, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, savedAcks, 3)

		// Verify all users are in the saved acknowledgements
		userIDMap := make(map[string]bool)
		for _, ack := range savedAcks {
			userIDMap[ack.UserId] = true
			require.Equal(t, post.Id, ack.PostId)
			require.Greater(t, ack.AcknowledgedAt, int64(0))
		}

		for _, userID := range userIDs {
			require.True(t, userIDMap[userID], "User ID should be in acknowledgements")
		}
	})

	t.Run("save empty list of acknowledgments should return empty list", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message for empty batch",
		}, "", true)
		require.Nil(t, err)

		// Save empty list of acknowledgements
		acks, err := th.App.SaveAcknowledgementsForPost(th.Context, post.Id, []string{})
		require.Nil(t, err)
		require.Empty(t, acks)

		// Verify no acknowledgements were saved
		savedAcks, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Empty(t, savedAcks)
	})

	t.Run("save multiple acknowledgments should update post's update_at", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message for update test",
		}, "", true)
		require.Nil(t, err)

		oldUpdateAt := post.UpdateAt

		// Create list of user IDs
		userIDs := []string{th.BasicUser.Id, th.BasicUser2.Id}

		// Save acknowledgements in batch
		_, err = th.App.SaveAcknowledgementsForPost(th.Context, post.Id, userIDs)
		require.Nil(t, err)

		// Get updated post
		updatedPost, err := th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, err)

		// Verify post's update_at was updated
		require.Greater(t, updatedPost.UpdateAt, oldUpdateAt)
	})

	t.Run("save multiple acknowledgments with a post directly", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message for direct post test",
		}, "", true)
		require.Nil(t, err)

		// Create list of user IDs
		userIDs := []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}

		// Save acknowledgements using the post directly
		acks, err := th.App.SaveAcknowledgementsForPostWithPost(th.Context, post, userIDs)
		require.Nil(t, err)
		require.Len(t, acks, 3)

		// Verify saved acknowledgements
		savedAcks, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, savedAcks, 3)

		// Verify all users are in the saved acknowledgements
		userIDMap := make(map[string]bool)
		for _, ack := range savedAcks {
			userIDMap[ack.UserId] = true
			require.Equal(t, post.Id, ack.PostId)
		}

		for _, userID := range userIDs {
			require.True(t, userIDMap[userID], "User ID should be in acknowledgements")
		}
	})
}

func testDeleteAcknowledgementsForPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("delete all acknowledgments for post", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message for batch delete",
		}, "", true)
		require.Nil(t, err)

		// Create multiple acknowledgements
		userIDs := []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}
		_, err = th.App.SaveAcknowledgementsForPost(th.Context, post.Id, userIDs)
		require.Nil(t, err)

		// Verify acknowledgements were created
		acks, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, acks, 3)

		// Delete all acknowledgements
		err = th.App.DeleteAcknowledgementsForPost(th.Context, post.Id)
		require.Nil(t, err)

		// Verify all acknowledgements were deleted
		acks, err = th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Empty(t, acks)
	})

	t.Run("delete all acknowledgments with post directly", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message for direct post delete",
		}, "", true)
		require.Nil(t, err)

		// Create multiple acknowledgements
		userIDs := []string{th.BasicUser.Id, th.BasicUser2.Id}
		_, err = th.App.SaveAcknowledgementsForPost(th.Context, post.Id, userIDs)
		require.Nil(t, err)

		// Verify acknowledgements were created
		acks, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Len(t, acks, 2)

		// Delete using post directly
		err = th.App.DeleteAcknowledgementsForPostWithPost(th.Context, post)
		require.Nil(t, err)

		// Verify all acknowledgements were deleted
		acks, err = th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Empty(t, acks)
	})

	t.Run("delete all acknowledgments should update post's update_at", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message for update test on delete",
		}, "", true)
		require.Nil(t, err)

		// Create multiple acknowledgements
		userIDs := []string{th.BasicUser.Id, th.BasicUser2.Id}
		_, err = th.App.SaveAcknowledgementsForPost(th.Context, post.Id, userIDs)
		require.Nil(t, err)

		// Get post with updated timestamp after saving acknowledgements
		post, err = th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, err)
		oldUpdateAt := post.UpdateAt

		// Delete all acknowledgements
		err = th.App.DeleteAcknowledgementsForPost(th.Context, post.Id)
		require.Nil(t, err)

		// Get updated post
		updatedPost, err := th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, err)

		// Verify post's update_at was updated
		require.Greater(t, updatedPost.UpdateAt, oldUpdateAt)
	})

	t.Run("delete all acknowledgments for post with no acknowledgements", func(t *testing.T) {
		post, err := th.App.CreatePostAsUser(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message for empty delete",
		}, "", true)
		require.Nil(t, err)

		// Verify no acknowledgements exist
		acks, err := th.App.GetAcknowledgementsForPost(post.Id)
		require.Nil(t, err)
		require.Empty(t, acks)

		// Delete should succeed with no error
		err = th.App.DeleteAcknowledgementsForPost(th.Context, post.Id)
		require.Nil(t, err)
	})
}
