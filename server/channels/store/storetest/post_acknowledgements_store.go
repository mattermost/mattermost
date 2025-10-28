// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPostAcknowledgementsStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testPostAcknowledgementsStoreSave(t, rctx, ss) })
	t.Run("GetForPost", func(t *testing.T) { testPostAcknowledgementsStoreGetForPost(t, rctx, ss) })
	t.Run("GetForPosts", func(t *testing.T) { testPostAcknowledgementsStoreGetForPosts(t, rctx, ss) })
	t.Run("BatchSave", func(t *testing.T) { testPostAcknowledgementsStoreBatchSave(t, rctx, ss) })
	t.Run("BatchDelete", func(t *testing.T) { testPostAcknowledgementsStoreBatchDelete(t, rctx, ss) })
}

func testPostAcknowledgementsStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	userID1 := model.NewId()

	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestID()
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer("important"),
			RequestedAck:            model.NewPointer(true),
			PersistentNotifications: model.NewPointer(false),
		},
	}
	post, err := ss.Post().Save(rctx, &p1)
	require.NoError(t, err)

	t.Run("consecutive saves should just update the acknowledged at", func(t *testing.T) {
		ack := &model.PostAcknowledgement{PostId: post.Id, UserId: userID1, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		_, err := ss.PostAcknowledgement().SaveWithModel(ack)
		require.NoError(t, err)

		ack = &model.PostAcknowledgement{PostId: post.Id, UserId: userID1, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		_, err = ss.PostAcknowledgement().SaveWithModel(ack)
		require.NoError(t, err)

		ack1 := &model.PostAcknowledgement{PostId: post.Id, UserId: userID1, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		ack1, err = ss.PostAcknowledgement().SaveWithModel(ack1)
		require.NoError(t, err)

		acknowledgements, err := ss.PostAcknowledgement().GetForPost(post.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack1})
	})

	t.Run("saving should update the update at of the post", func(t *testing.T) {
		oldUpdateAt := post.UpdateAt
		ack := &model.PostAcknowledgement{PostId: post.Id, UserId: userID1, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		_, err := ss.PostAcknowledgement().SaveWithModel(ack)
		require.NoError(t, err)

		post, err = ss.Post().GetSingle(rctx, post.Id, false)
		require.NoError(t, err)
		require.Greater(t, post.UpdateAt, oldUpdateAt)
	})
}

func testPostAcknowledgementsStoreGetForPost(t *testing.T, rctx request.CTX, ss store.Store) {
	userID1 := model.NewId()
	userID2 := model.NewId()
	userID3 := model.NewId()

	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestID()
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer("important"),
			RequestedAck:            model.NewPointer(true),
			PersistentNotifications: model.NewPointer(false),
		},
	}
	_, err := ss.Post().Save(rctx, &p1)
	require.NoError(t, err)

	t.Run("get acknowledgements for post", func(t *testing.T) {
		ack1 := &model.PostAcknowledgement{PostId: p1.Id, UserId: userID1, AcknowledgedAt: 0, ChannelId: p1.ChannelId}
		ack1, err := ss.PostAcknowledgement().SaveWithModel(ack1)
		require.NoError(t, err)
		ack2 := &model.PostAcknowledgement{PostId: p1.Id, UserId: userID2, AcknowledgedAt: 0, ChannelId: p1.ChannelId}
		ack2, err = ss.PostAcknowledgement().SaveWithModel(ack2)
		require.NoError(t, err)
		ack3 := &model.PostAcknowledgement{PostId: p1.Id, UserId: userID3, AcknowledgedAt: 0, ChannelId: p1.ChannelId}
		ack3, err = ss.PostAcknowledgement().SaveWithModel(ack3)
		require.NoError(t, err)

		acknowledgements, err := ss.PostAcknowledgement().GetForPost(p1.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack1, ack2, ack3})

		err = ss.PostAcknowledgement().Delete(ack1)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPost(p1.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack2, ack3})

		err = ss.PostAcknowledgement().Delete(ack2)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPost(p1.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack3})

		err = ss.PostAcknowledgement().Delete(ack3)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPost(p1.Id)
		require.NoError(t, err)
		require.Empty(t, acknowledgements)
	})
}

func testPostAcknowledgementsStoreGetForPosts(t *testing.T, rctx request.CTX, ss store.Store) {
	userID1 := model.NewId()
	userID2 := model.NewId()
	userID3 := model.NewId()

	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestID()
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer("important"),
			RequestedAck:            model.NewPointer(true),
			PersistentNotifications: model.NewPointer(false),
		},
	}
	p2 := model.Post{}
	p2.ChannelId = model.NewId()
	p2.UserId = model.NewId()
	p2.Message = NewTestID()
	p2.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer(""),
			RequestedAck:            model.NewPointer(true),
			PersistentNotifications: model.NewPointer(false),
		},
	}
	_, errIdx, err := ss.Post().SaveMultiple(rctx, []*model.Post{&p1, &p2})
	require.NoError(t, err)
	require.Equal(t, -1, errIdx)

	t.Run("get acknowledgements for post", func(t *testing.T) {
		ack1 := &model.PostAcknowledgement{PostId: p1.Id, UserId: userID1, AcknowledgedAt: 0, ChannelId: p1.ChannelId}
		ack1, err := ss.PostAcknowledgement().SaveWithModel(ack1)
		require.NoError(t, err)
		ack2 := &model.PostAcknowledgement{PostId: p1.Id, UserId: userID2, AcknowledgedAt: 0, ChannelId: p1.ChannelId}
		ack2, err = ss.PostAcknowledgement().SaveWithModel(ack2)
		require.NoError(t, err)
		ack3 := &model.PostAcknowledgement{PostId: p2.Id, UserId: userID2, AcknowledgedAt: 0, ChannelId: p2.ChannelId}
		ack3, err = ss.PostAcknowledgement().SaveWithModel(ack3)
		require.NoError(t, err)
		ack4 := &model.PostAcknowledgement{PostId: p2.Id, UserId: userID3, AcknowledgedAt: 0, ChannelId: p2.ChannelId}
		ack4, err = ss.PostAcknowledgement().SaveWithModel(ack4)
		require.NoError(t, err)

		acknowledgements, err := ss.PostAcknowledgement().GetForPosts([]string{p1.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack1, ack2})

		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack3, ack4})

		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack1, ack2, ack3, ack4})

		err = ss.PostAcknowledgement().Delete(ack1)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack2, ack3, ack4})

		err = ss.PostAcknowledgement().Delete(ack2)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack3, ack4})

		err = ss.PostAcknowledgement().Delete(ack3)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack4})

		err = ss.PostAcknowledgement().Delete(ack4)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.Empty(t, acknowledgements)
	})
}

func testPostAcknowledgementsStoreBatchSave(t *testing.T, rctx request.CTX, ss store.Store) {
	userID1 := model.NewId()
	userID2 := model.NewId()
	userID3 := model.NewId()

	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestID()
	post, err := ss.Post().Save(rctx, &p1)
	require.NoError(t, err)

	t.Run("batch save acknowledgements for a post", func(t *testing.T) {
		// Create a batch of acknowledgements
		acks := []*model.PostAcknowledgement{
			{
				PostId:         post.Id,
				UserId:         userID1,
				AcknowledgedAt: model.GetMillis(),
			},
			{
				PostId:         post.Id,
				UserId:         userID2,
				AcknowledgedAt: model.GetMillis(),
			},
			{
				PostId:         post.Id,
				UserId:         userID3,
				AcknowledgedAt: model.GetMillis(),
			},
		}

		// Save the batch
		savedAcks, err := ss.PostAcknowledgement().BatchSave(acks)
		require.NoError(t, err)
		require.Len(t, savedAcks, 3)

		// Verify all were saved correctly
		retrievedAcks, err := ss.PostAcknowledgement().GetForPost(post.Id)
		require.NoError(t, err)
		require.Len(t, retrievedAcks, 3)

		// Verify all users are in the saved acknowledgements
		userIDMap := make(map[string]bool)
		for _, ack := range retrievedAcks {
			userIDMap[ack.UserId] = true
			require.Equal(t, post.Id, ack.PostId)
			require.Greater(t, ack.AcknowledgedAt, int64(0))
		}

		require.True(t, userIDMap[userID1])
		require.True(t, userIDMap[userID2])
		require.True(t, userIDMap[userID3])
	})

	t.Run("batch save empty list of acknowledgements", func(t *testing.T) {
		// Create an empty batch of acknowledgements
		acks := []*model.PostAcknowledgement{}

		// Save the empty batch
		savedAcks, err := ss.PostAcknowledgement().BatchSave(acks)
		require.NoError(t, err)
		require.Empty(t, savedAcks)
	})

	t.Run("batch save should update existing acknowledgements", func(t *testing.T) {
		// First, delete all existing acknowledgements
		acks, err := ss.PostAcknowledgement().GetForPost(post.Id)
		require.NoError(t, err)

		for _, ack := range acks {
			err = ss.PostAcknowledgement().Delete(ack)
			require.NoError(t, err)
		}

		// Create initial acknowledgement
		ack := &model.PostAcknowledgement{PostId: post.Id, UserId: userID1, AcknowledgedAt: model.GetMillis(), ChannelId: post.ChannelId}
		ack, err = ss.PostAcknowledgement().SaveWithModel(ack)
		require.NoError(t, err)

		initialAckTime := ack.AcknowledgedAt

		// Create a batch with updated timestamp
		newTimestamp := model.GetMillis() + 1000
		updatedAcks := []*model.PostAcknowledgement{
			{
				PostId:         post.Id,
				UserId:         userID1,
				AcknowledgedAt: newTimestamp,
			},
		}

		// Batch save should update the existing acknowledgement
		savedAcks, err := ss.PostAcknowledgement().BatchSave(updatedAcks)
		require.NoError(t, err)
		require.Len(t, savedAcks, 1)
		require.Equal(t, newTimestamp, savedAcks[0].AcknowledgedAt)
		require.Greater(t, savedAcks[0].AcknowledgedAt, initialAckTime)

		// Verify the acknowledgement was updated
		retrievedAcks, err := ss.PostAcknowledgement().GetForPost(post.Id)
		require.NoError(t, err)
		require.Len(t, retrievedAcks, 1)
		require.Equal(t, newTimestamp, retrievedAcks[0].AcknowledgedAt)
	})

	t.Run("batch save should update post's update_at", func(t *testing.T) {
		// First, check the current post update timestamp
		currentPost, err := ss.Post().GetSingle(rctx, post.Id, false)
		require.NoError(t, err)
		oldUpdateAt := currentPost.UpdateAt

		// Create a batch of new acknowledgements
		acks := []*model.PostAcknowledgement{
			{
				PostId:         post.Id,
				UserId:         model.NewId(),
				AcknowledgedAt: model.GetMillis(),
			},
		}

		// Save the batch
		_, err = ss.PostAcknowledgement().BatchSave(acks)
		require.NoError(t, err)

		// Verify post's update_at was updated
		updatedPost, err := ss.Post().GetSingle(rctx, post.Id, false)
		require.NoError(t, err)
		require.Greater(t, updatedPost.UpdateAt, oldUpdateAt)
	})
}

func testPostAcknowledgementsStoreBatchDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	userID1 := model.NewId()
	userID2 := model.NewId()
	userID3 := model.NewId()

	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestID()
	post, err := ss.Post().Save(rctx, &p1)
	require.NoError(t, err)

	t.Run("batch delete all acknowledgements for a post", func(t *testing.T) {
		// Create multiple acknowledgements
		ack1 := &model.PostAcknowledgement{PostId: post.Id, UserId: userID1, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		ack1, err = ss.PostAcknowledgement().SaveWithModel(ack1)
		require.NoError(t, err)
		ack2 := &model.PostAcknowledgement{PostId: post.Id, UserId: userID2, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		ack2, err = ss.PostAcknowledgement().SaveWithModel(ack2)
		require.NoError(t, err)
		ack3 := &model.PostAcknowledgement{PostId: post.Id, UserId: userID3, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		ack3, err = ss.PostAcknowledgement().SaveWithModel(ack3)
		require.NoError(t, err)

		// Verify acknowledgements were created
		acks, pErr := ss.PostAcknowledgement().GetForPost(post.Id)
		require.NoError(t, pErr)
		require.Len(t, acks, 3)

		// Delete all acknowledgements in batch
		err = ss.PostAcknowledgement().BatchDelete([]*model.PostAcknowledgement{ack1, ack2, ack3})
		require.NoError(t, err)

		// Verify all acknowledgements were deleted
		acks, err = ss.PostAcknowledgement().GetForPost(post.Id)
		require.NoError(t, err)
		require.Empty(t, acks)
	})

	t.Run("batch delete should update post's update_at", func(t *testing.T) {
		// Create acknowledgements
		ack1 := &model.PostAcknowledgement{PostId: post.Id, UserId: userID1, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		ack1, err = ss.PostAcknowledgement().SaveWithModel(ack1)
		require.NoError(t, err)
		ack2 := &model.PostAcknowledgement{PostId: post.Id, UserId: userID2, AcknowledgedAt: 0, ChannelId: post.ChannelId}
		ack2, err = ss.PostAcknowledgement().SaveWithModel(ack2)
		require.NoError(t, err)

		// Get current post update timestamp
		currentPost, err := ss.Post().GetSingle(rctx, post.Id, false)
		require.NoError(t, err)
		oldUpdateAt := currentPost.UpdateAt

		// Delete acknowledgements in batch
		err = ss.PostAcknowledgement().BatchDelete([]*model.PostAcknowledgement{ack1, ack2})
		require.NoError(t, err)

		// Verify post's update_at was updated
		updatedPost, err := ss.Post().GetSingle(rctx, post.Id, false)
		require.NoError(t, err)
		require.Greater(t, updatedPost.UpdateAt, oldUpdateAt)
	})

	t.Run("batch delete with empty list should not error", func(t *testing.T) {
		// Delete with empty list should not error
		err := ss.PostAcknowledgement().BatchDelete([]*model.PostAcknowledgement{})
		require.NoError(t, err)
	})

	t.Run("batch delete with non-existent acknowledgements should not error", func(t *testing.T) {
		// Create non-existent acknowledgements
		nonExistentAck := &model.PostAcknowledgement{
			PostId:         model.NewId(),
			UserId:         model.NewId(),
			AcknowledgedAt: model.GetMillis(),
		}

		// Delete non-existent acknowledgement should not error
		err := ss.PostAcknowledgement().BatchDelete([]*model.PostAcknowledgement{nonExistentAck})
		require.NoError(t, err)
	})
}
