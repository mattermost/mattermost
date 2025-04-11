// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func TestPostStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveMultiple", func(t *testing.T) { testPostStoreSaveMultiple(t, rctx, ss) })
	t.Run("Save", func(t *testing.T) { testPostStoreSave(t, rctx, ss) })
	t.Run("SaveAndUpdateChannelMsgCounts", func(t *testing.T) { testPostStoreSaveChannelMsgCounts(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testPostStoreGet(t, rctx, ss) })
	t.Run("GetSingle", func(t *testing.T) { testPostStoreGetSingle(t, rctx, ss) })
	t.Run("Update", func(t *testing.T) { testPostStoreUpdate(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testPostStoreDelete(t, rctx, ss) })
	t.Run("PermDelete1Level", func(t *testing.T) { testPostStorePermDelete1Level(t, rctx, ss) })
	t.Run("PermDelete1Level2", func(t *testing.T) { testPostStorePermDelete1Level2(t, rctx, ss) })
	t.Run("PermDeleteLimitExceeded", func(t *testing.T) { testPostStorePermDeleteLimitExceeded(t, rctx, ss) })
	t.Run("GetWithChildren", func(t *testing.T) { testPostStoreGetWithChildren(t, rctx, ss) })
	t.Run("GetPostsWithDetails", func(t *testing.T) { testPostStoreGetPostsWithDetails(t, rctx, ss) })
	t.Run("GetPostsBeforeAfter", func(t *testing.T) { testPostStoreGetPostsBeforeAfter(t, rctx, ss) })
	t.Run("GetPostsSince", func(t *testing.T) { testPostStoreGetPostsSince(t, rctx, ss) })
	t.Run("GetPosts", func(t *testing.T) { testPostStoreGetPosts(t, rctx, ss) })
	t.Run("GetPostBeforeAfter", func(t *testing.T) { testPostStoreGetPostBeforeAfter(t, rctx, ss) })
	t.Run("UserCountsWithPostsByDay", func(t *testing.T) { testUserCountsWithPostsByDay(t, rctx, ss) })
	t.Run("PostCountsByDuration", func(t *testing.T) { testPostCountsByDay(t, rctx, ss) })
	t.Run("PostCounts", func(t *testing.T) { testPostCounts(t, rctx, ss) })
	t.Run("GetFlaggedPostsForTeam", func(t *testing.T) { testPostStoreGetFlaggedPostsForTeam(t, rctx, ss, s) })
	t.Run("GetFlaggedPosts", func(t *testing.T) { testPostStoreGetFlaggedPosts(t, rctx, ss) })
	t.Run("GetFlaggedPostsForChannel", func(t *testing.T) { testPostStoreGetFlaggedPostsForChannel(t, rctx, ss) })
	t.Run("GetPostsCreatedAt", func(t *testing.T) { testPostStoreGetPostsCreatedAt(t, rctx, ss) })
	t.Run("Overwrite", func(t *testing.T) { testPostStoreOverwrite(t, rctx, ss) })
	t.Run("OverwriteMultiple", func(t *testing.T) { testPostStoreOverwriteMultiple(t, rctx, ss) })
	t.Run("GetPostsByIds", func(t *testing.T) { testPostStoreGetPostsByIds(t, rctx, ss) })
	t.Run("GetPostsBatchForIndexing", func(t *testing.T) { testPostStoreGetPostsBatchForIndexing(t, rctx, ss) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testPostStorePermanentDeleteBatch(t, rctx, ss) })
	t.Run("GetOldest", func(t *testing.T) { testPostStoreGetOldest(t, rctx, ss) })
	t.Run("TestGetMaxPostSize", func(t *testing.T) { testGetMaxPostSize(t, rctx, ss) })
	t.Run("GetParentsForExportAfter", func(t *testing.T) { testPostStoreGetParentsForExportAfter(t, rctx, ss) })
	t.Run("GetRepliesForExport", func(t *testing.T) { testPostStoreGetRepliesForExport(t, rctx, ss) })
	t.Run("GetDirectPostParentsForExportAfter", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfter(t, rctx, ss, s) })
	t.Run("GetDirectPostParentsForExportAfterDeleted", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfterDeleted(t, rctx, ss, s) })
	t.Run("GetDirectPostParentsForExportAfterBatched", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfterBatched(t, rctx, ss, s) })
	t.Run("GetForThread", func(t *testing.T) { testPostStoreGetForThread(t, rctx, ss) })
	t.Run("HasAutoResponsePostByUserSince", func(t *testing.T) { testHasAutoResponsePostByUserSince(t, rctx, ss) })
	t.Run("GetPostsSinceUpdateForSync", func(t *testing.T) { testGetPostsSinceUpdateForSync(t, rctx, ss, s) })
	t.Run("GetPostsSinceCreateForSync", func(t *testing.T) { testGetPostsSinceCreateForSync(t, rctx, ss, s) })
	t.Run("SetPostReminder", func(t *testing.T) { testSetPostReminder(t, rctx, ss, s) })
	t.Run("GetPostReminders", func(t *testing.T) { testGetPostReminders(t, rctx, ss, s) })
	t.Run("GetPostReminderMetadata", func(t *testing.T) { testGetPostReminderMetadata(t, rctx, ss, s) })
	t.Run("GetNthRecentPostTime", func(t *testing.T) { testGetNthRecentPostTime(t, rctx, ss) })
	t.Run("GetEditHistoryForPost", func(t *testing.T) { testGetEditHistoryForPost(t, rctx, ss) })
}

func testPostStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save post", func(t *testing.T) {
		o1 := model.Post{}
		o1.ChannelId = model.NewId()
		o1.UserId = model.NewId()
		o1.Message = NewTestID()

		p, err := ss.Post().Save(rctx, &o1)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(0), p.ReplyCount)
	})

	t.Run("Save replies", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o1 := model.Post{}
		o1.ChannelId = channel1.Id
		o1.UserId = model.NewId()
		o1.RootId = model.NewId()
		o1.Message = NewTestID()

		channel2, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName2",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o2 := model.Post{}
		o2.ChannelId = channel2.Id
		o2.UserId = model.NewId()
		o2.RootId = o1.RootId
		o2.Message = NewTestID()

		channel3, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName3",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o3 := model.Post{}
		o3.ChannelId = channel3.Id
		o3.UserId = model.NewId()
		o3.RootId = model.NewId()
		o3.Message = NewTestID()

		p1, err := ss.Post().Save(rctx, &o1)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(1), p1.ReplyCount)

		p2, err := ss.Post().Save(rctx, &o2)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(2), p2.ReplyCount)

		p3, err := ss.Post().Save(rctx, &o3)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(1), p3.ReplyCount)
	})

	t.Run("Try to save existing post", func(t *testing.T) {
		o1 := model.Post{}
		o1.ChannelId = model.NewId()
		o1.UserId = model.NewId()
		o1.Message = NewTestID()

		_, err := ss.Post().Save(rctx, &o1)
		require.NoError(t, err, "couldn't save item")

		_, err = ss.Post().Save(rctx, &o1)
		require.Error(t, err, "shouldn't be able to update from save")
	})

	t.Run("Update reply should update the UpdateAt of the root post", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		rootPost := model.Post{}
		rootPost.ChannelId = channel.Id
		rootPost.UserId = model.NewId()
		rootPost.Message = NewTestID()

		_, err = ss.Post().Save(rctx, &rootPost)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = NewTestID()
		replyPost.RootId = rootPost.Id

		// We need to sleep here to be sure the post is not created during the same millisecond
		time.Sleep(time.Millisecond)
		_, err = ss.Post().Save(rctx, &replyPost)
		require.NoError(t, err)

		rrootPost, err := ss.Post().GetSingle(rctx, rootPost.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rrootPost.UpdateAt, rootPost.UpdateAt)
	})

	t.Run("Create a post should update the channel LastPostAt and the total messages count by one", func(t *testing.T) {
		channel := model.Channel{}
		channel.Name = NewTestID()
		channel.DisplayName = NewTestID()
		channel.Type = model.ChannelTypeOpen

		_, err := ss.Channel().Save(rctx, &channel, 100)
		require.NoError(t, err)

		post := model.Post{}
		post.ChannelId = channel.Id
		post.UserId = model.NewId()
		post.Message = NewTestID()

		// We need to sleep here to be sure the post is not created during the same millisecond
		time.Sleep(time.Millisecond)
		_, err = ss.Post().Save(rctx, &post)
		require.NoError(t, err)

		rchannel, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rchannel.LastPostAt, channel.LastPostAt)
		assert.Equal(t, int64(1), rchannel.TotalMsgCount)

		post = model.Post{}
		post.ChannelId = channel.Id
		post.UserId = model.NewId()
		post.Message = NewTestID()
		post.CreateAt = 5

		// We need to sleep here to be sure the post is not created during the same millisecond
		time.Sleep(time.Millisecond)
		_, err = ss.Post().Save(rctx, &post)
		require.NoError(t, err)

		rchannel2, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err)
		assert.Equal(t, rchannel.LastPostAt, rchannel2.LastPostAt)
		assert.Equal(t, int64(2), rchannel2.TotalMsgCount)

		post = model.Post{}
		post.ChannelId = channel.Id
		post.UserId = model.NewId()
		post.Message = NewTestID()

		// We need to sleep here to be sure the post is not created during the same millisecond
		time.Sleep(time.Millisecond)
		_, err = ss.Post().Save(rctx, &post)
		require.NoError(t, err)

		rchannel3, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rchannel3.LastPostAt, rchannel2.LastPostAt)
		assert.Equal(t, int64(3), rchannel3.TotalMsgCount)
	})

	t.Run("Save post with priority metadata set", func(t *testing.T) {
		o1 := model.Post{}
		o1.ChannelId = model.NewId()
		o1.UserId = model.NewId()
		o1.Message = NewTestID()

		o1.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				RequestedAck:            model.NewPointer(true),
				PersistentNotifications: model.NewPointer(false),
			},
		}

		p, err := ss.Post().Save(rctx, &o1)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(0), p.ReplyCount)

		pp, err := ss.PostPriority().GetForPost(p.Id)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, "important", *pp.Priority)
		assert.Equal(t, true, *pp.RequestedAck)
		assert.Equal(t, false, *pp.PersistentNotifications)
	})
}

func testPostStoreSaveMultiple(t *testing.T, rctx request.CTX, ss store.Store) {
	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestID()

	p2 := model.Post{}
	p2.ChannelId = model.NewId()
	p2.UserId = model.NewId()
	p2.Message = NewTestID()

	p3 := model.Post{}
	p3.ChannelId = model.NewId()
	p3.UserId = model.NewId()
	p3.Message = NewTestID()

	p4 := model.Post{}
	p4.ChannelId = model.NewId()
	p4.UserId = model.NewId()
	p4.Message = NewTestID()

	t.Run("Save correctly a new set of posts", func(t *testing.T) {
		newPosts, errIdx, err := ss.Post().SaveMultiple(rctx, []*model.Post{&p1, &p2, &p3})
		require.NoError(t, err)
		require.Equal(t, -1, errIdx)
		for _, post := range newPosts {
			storedPost, err := ss.Post().GetSingle(rctx, post.Id, false)
			assert.NoError(t, err)
			assert.Equal(t, post.ChannelId, storedPost.ChannelId)
			assert.Equal(t, post.Message, storedPost.Message)
			assert.Equal(t, post.UserId, storedPost.UserId)
		}
	})

	t.Run("Save replies", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channel2, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName2",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channel3, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName3",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channel4, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName4",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)
		o1 := model.Post{}
		o1.ChannelId = channel1.Id
		o1.UserId = model.NewId()
		o1.RootId = model.NewId()
		o1.Message = NewTestID()

		o2 := model.Post{}
		o2.ChannelId = channel2.Id
		o2.UserId = model.NewId()
		o2.RootId = o1.RootId
		o2.Message = NewTestID()

		o3 := model.Post{}
		o3.ChannelId = channel3.Id
		o3.UserId = model.NewId()
		o3.RootId = model.NewId()
		o3.Message = NewTestID()

		o4 := model.Post{}
		o4.ChannelId = channel4.Id
		o4.UserId = model.NewId()
		o4.Message = NewTestID()

		newPosts, errIdx, err := ss.Post().SaveMultiple(rctx, []*model.Post{&o1, &o2, &o3, &o4})
		require.NoError(t, err, "couldn't save item")
		require.Equal(t, -1, errIdx)
		assert.Len(t, newPosts, 4)
		assert.Equal(t, int64(2), newPosts[0].ReplyCount)
		assert.Equal(t, int64(2), newPosts[1].ReplyCount)
		assert.Equal(t, int64(1), newPosts[2].ReplyCount)
		assert.Equal(t, int64(0), newPosts[3].ReplyCount)
	})

	t.Run("Try to save mixed, already saved and not saved posts", func(t *testing.T) {
		newPosts, errIdx, err := ss.Post().SaveMultiple(rctx, []*model.Post{&p4, &p3})
		require.Error(t, err)
		require.Equal(t, 1, errIdx)
		require.Nil(t, newPosts)
		storedPost, err := ss.Post().GetSingle(rctx, p3.Id, false)
		assert.NoError(t, err)
		assert.Equal(t, p3.ChannelId, storedPost.ChannelId)
		assert.Equal(t, p3.Message, storedPost.Message)
		assert.Equal(t, p3.UserId, storedPost.UserId)

		storedPost, err = ss.Post().GetSingle(rctx, p4.Id, false)
		assert.Error(t, err)
		assert.Nil(t, storedPost)
	})

	t.Run("Update reply should update the UpdateAt of the root post", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		rootPost := model.Post{}
		rootPost.ChannelId = channel.Id
		rootPost.UserId = model.NewId()
		rootPost.Message = NewTestID()

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = NewTestID()
		replyPost.RootId = rootPost.Id

		_, _, err = ss.Post().SaveMultiple(rctx, []*model.Post{&rootPost, &replyPost})
		require.NoError(t, err)

		rrootPost, err := ss.Post().GetSingle(rctx, rootPost.Id, false)
		require.NoError(t, err)
		assert.Equal(t, rrootPost.UpdateAt, rootPost.UpdateAt)

		replyPost2 := model.Post{}
		replyPost2.ChannelId = rootPost.ChannelId
		replyPost2.UserId = model.NewId()
		replyPost2.Message = NewTestID()
		replyPost2.RootId = rootPost.Id

		replyPost3 := model.Post{}
		replyPost3.ChannelId = rootPost.ChannelId
		replyPost3.UserId = model.NewId()
		replyPost3.Message = NewTestID()
		replyPost3.RootId = rootPost.Id

		// Ensure update does not occur in the same timestamp as creation
		time.Sleep(time.Millisecond)

		_, _, err = ss.Post().SaveMultiple(rctx, []*model.Post{&replyPost2, &replyPost3})
		require.NoError(t, err)

		rrootPost2, err := ss.Post().GetSingle(rctx, rootPost.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rrootPost2.UpdateAt, rrootPost.UpdateAt)
	})

	t.Run("Create a post should update the channel LastPostAt and the total messages count by one", func(t *testing.T) {
		channel := model.Channel{}
		channel.Name = NewTestID()
		channel.DisplayName = NewTestID()
		channel.Type = model.ChannelTypeOpen

		_, err := ss.Channel().Save(rctx, &channel, 100)
		require.NoError(t, err)

		post1 := model.Post{}
		post1.ChannelId = channel.Id
		post1.UserId = model.NewId()
		post1.Message = NewTestID()

		post2 := model.Post{}
		post2.ChannelId = channel.Id
		post2.UserId = model.NewId()
		post2.Message = NewTestID()
		post2.CreateAt = 5

		post3 := model.Post{}
		post3.ChannelId = channel.Id
		post3.UserId = model.NewId()
		post3.Message = NewTestID()

		_, _, err = ss.Post().SaveMultiple(rctx, []*model.Post{&post1, &post2, &post3})
		require.NoError(t, err)

		rchannel, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rchannel.LastPostAt, channel.LastPostAt)
		assert.Equal(t, int64(3), rchannel.TotalMsgCount)
	})

	t.Run("Thread participants", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o1 := model.Post{}
		o1.ChannelId = channel1.Id
		o1.UserId = model.NewId()
		o1.Message = "jessica hyde" + model.NewId() + "b"

		root, err := ss.Post().Save(rctx, &o1)
		require.NoError(t, err)

		channel2, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName2",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channel3, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName3",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channel4, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName4",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channel5, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName5",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)
		o2 := model.Post{}
		o2.ChannelId = channel2.Id
		o2.UserId = model.NewId()
		o2.RootId = root.Id
		o2.Message = "zz" + model.NewId() + "b"

		o3 := model.Post{}
		o3.ChannelId = channel3.Id
		o3.UserId = model.NewId()
		o3.RootId = root.Id
		o3.Message = "zz" + model.NewId() + "b"

		o4 := model.Post{}
		o4.ChannelId = channel4.Id
		o4.UserId = o2.UserId
		o4.RootId = root.Id
		o4.Message = "zz" + model.NewId() + "b"

		o5 := model.Post{}
		o5.ChannelId = channel5.Id
		o5.UserId = o1.UserId
		o5.RootId = root.Id
		o5.Message = "zz" + model.NewId() + "b"

		_, err = ss.Post().Save(rctx, &o2)
		require.NoError(t, err)
		thread, errT := ss.Thread().Get(root.Id)
		require.NoError(t, errT)

		assert.Equal(t, int64(1), thread.ReplyCount)
		assert.Equal(t, int(1), len(thread.Participants))
		assert.Equal(t, model.StringArray{o2.UserId}, thread.Participants)

		_, err = ss.Post().Save(rctx, &o3)
		require.NoError(t, err)
		thread, errT = ss.Thread().Get(root.Id)
		require.NoError(t, errT)

		assert.Equal(t, int64(2), thread.ReplyCount)
		assert.Equal(t, int(2), len(thread.Participants))
		assert.Equal(t, model.StringArray{o2.UserId, o3.UserId}, thread.Participants)

		_, err = ss.Post().Save(rctx, &o4)
		require.NoError(t, err)
		thread, errT = ss.Thread().Get(root.Id)
		require.NoError(t, errT)

		assert.Equal(t, int64(3), thread.ReplyCount)
		assert.Equal(t, int(2), len(thread.Participants))
		assert.Equal(t, model.StringArray{o3.UserId, o2.UserId}, thread.Participants)

		_, err = ss.Post().Save(rctx, &o5)
		require.NoError(t, err)
		thread, errT = ss.Thread().Get(root.Id)
		require.NoError(t, errT)

		assert.Equal(t, int64(4), thread.ReplyCount)
		assert.Equal(t, int(3), len(thread.Participants))
		assert.Equal(t, model.StringArray{o3.UserId, o2.UserId, o1.UserId}, thread.Participants)
	})
}

func testPostStoreSaveChannelMsgCounts(t *testing.T, rctx request.CTX, ss store.Store) {
	c1 := &model.Channel{Name: model.NewId(), DisplayName: "posttestchannel", Type: model.ChannelTypeOpen, TeamId: model.NewId()}
	_, err := ss.Channel().Save(rctx, c1, 1000000)
	require.NoError(t, err)

	o1 := model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()

	_, err = ss.Post().Save(rctx, &o1)
	require.NoError(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.NoError(t, err)
	assert.Equal(t, int64(1), c1.TotalMsgCount, "Message count should update by 1")

	o1.Id = ""
	o1.Type = model.PostTypeAddToTeam
	_, err = ss.Post().Save(rctx, &o1)
	require.NoError(t, err)

	o1.Id = ""
	o1.Type = model.PostTypeRemoveFromTeam
	_, err = ss.Post().Save(rctx, &o1)
	require.NoError(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.NoError(t, err)
	assert.Equal(t, int64(1), c1.TotalMsgCount, "Message count should not update for team add/removed message")

	oldLastPostAt := c1.LastPostAt

	o2 := model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.CreateAt = int64(7)
	_, err = ss.Post().Save(rctx, &o2)
	require.NoError(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.NoError(t, err)
	assert.Equal(t, oldLastPostAt, c1.LastPostAt, "LastPostAt should not update for old message save")
}

func testPostStoreGet(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	o1 := &model.Post{}
	o1.ChannelId = channel.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()

	etag1 := ss.Post().GetEtag(o1.ChannelId, false, false)
	require.Equal(t, 0, strings.Index(etag1, model.CurrentVersion+"."), "Invalid Etag")

	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	etag2 := ss.Post().GetEtag(o1.ChannelId, false, false)
	require.Equal(t, 0, strings.Index(etag2, fmt.Sprintf("%v.%v", model.CurrentVersion, o1.UpdateAt)), "Invalid Etag")

	r1, err := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	require.Equal(t, r1.Posts[o1.Id].CreateAt, o1.CreateAt, "invalid returned post")

	_, err = ss.Post().Get(context.Background(), "123", model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Missing id should have failed")

	_, err = ss.Post().Get(context.Background(), "", model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "should fail for blank post ids")
}

func testPostStoreGetForThread(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Post thread is followed", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o1 := &model.Post{ChannelId: channel.Id, UserId: model.NewId(), Message: NewTestID()}
		o1, err = ss.Post().Save(rctx, o1)
		require.NoError(t, err)
		_, err = ss.Post().Save(rctx, &model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id})
		require.NoError(t, err)

		_, err = ss.Thread().MaintainMembership(o1.UserId, o1.Id, store.ThreadMembershipOpts{
			Following:       true,
			UpdateFollowing: true,
		})
		require.NoError(t, err)
		opts := model.GetPostsOptions{
			CollapsedThreads: true,
		}
		r1, err := ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Equal(t, r1.Posts[o1.Id].CreateAt, o1.CreateAt, "invalid returned post")
		require.True(t, *r1.Posts[o1.Id].IsFollowing)
	})

	t.Run("Post thread is explicitly not followed", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o1 := &model.Post{ChannelId: channel.Id, UserId: model.NewId(), Message: NewTestID()}
		o1, err = ss.Post().Save(rctx, o1)
		require.NoError(t, err)
		_, err = ss.Post().Save(rctx, &model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id})
		require.NoError(t, err)

		_, err = ss.Thread().MaintainMembership(o1.UserId, o1.Id, store.ThreadMembershipOpts{
			Following:       false,
			UpdateFollowing: true,
		})
		require.NoError(t, err)
		opts := model.GetPostsOptions{
			CollapsedThreads: true,
		}
		r1, err := ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Equal(t, r1.Posts[o1.Id].CreateAt, o1.CreateAt, "invalid returned post")
		require.False(t, *r1.Posts[o1.Id].IsFollowing)
	})

	t.Run("Post threadmembership does not exist", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o1 := &model.Post{ChannelId: channel.Id, UserId: model.NewId(), Message: NewTestID()}
		o1, err = ss.Post().Save(rctx, o1)
		require.NoError(t, err)
		_, err = ss.Post().Save(rctx, &model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id})
		require.NoError(t, err)

		opts := model.GetPostsOptions{
			CollapsedThreads: true,
		}
		r1, err := ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Equal(t, r1.Posts[o1.Id].CreateAt, o1.CreateAt, "invalid returned post")
		require.Nil(t, r1.Posts[o1.Id].IsFollowing)
	})

	t.Run("Pagination", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		now := model.GetMillis()
		o1, err := ss.Post().Save(rctx, &model.Post{CreateAt: now, ChannelId: channel.Id, UserId: model.NewId(), Message: NewTestID()})
		require.NoError(t, err)
		_, err = ss.Post().Save(rctx, &model.Post{CreateAt: now + 1, ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id})
		require.NoError(t, err)
		m1, err := ss.Post().Save(rctx, &model.Post{CreateAt: now + 2, ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id})
		require.NoError(t, err)
		_, err = ss.Post().Save(rctx, &model.Post{CreateAt: now + 3, ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id})
		require.NoError(t, err)
		_, err = ss.Post().Save(rctx, &model.Post{CreateAt: now + 4, ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id})
		require.NoError(t, err)

		opts := model.GetPostsOptions{
			CollapsedThreads: true,
			PerPage:          2,
			Direction:        "down",
		}
		r1, err := ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 3) // including the root post
		require.Len(t, r1.Posts, 3)
		assert.True(t, *r1.HasNext)

		lastPostID := r1.Order[len(r1.Order)-1]
		lastPostCreateAt := r1.Posts[lastPostID].CreateAt

		opts = model.GetPostsOptions{
			CollapsedThreads: true,
			PerPage:          2,
			Direction:        "down",
			FromPost:         lastPostID,
			FromCreateAt:     lastPostCreateAt,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 3) // including the root post
		require.Len(t, r1.Posts, 3)
		assert.GreaterOrEqual(t, r1.Posts[r1.Order[len(r1.Order)-1]].CreateAt, lastPostCreateAt)
		assert.False(t, *r1.HasNext)

		// Going from bottom to top now.
		firstPostCreateAt := r1.Posts[r1.Order[1]].CreateAt
		opts = model.GetPostsOptions{
			CollapsedThreads: true,
			PerPage:          2,
			Direction:        "up",
			FromPost:         r1.Order[1],
			FromCreateAt:     firstPostCreateAt,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 3) // including the root post
		require.Len(t, r1.Posts, 3)
		assert.LessOrEqual(t, r1.Posts[r1.Order[1]].CreateAt, firstPostCreateAt)
		assert.False(t, *r1.HasNext)

		// Only with CreateAt
		opts = model.GetPostsOptions{
			CollapsedThreads: false,
			PerPage:          1,
			Direction:        "up",
			FromCreateAt:     m1.CreateAt,
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Equal(t, r1.Posts[r1.Order[0]].ReplyCount, int64(4))
		require.Equal(t, r1.Posts[r1.Order[1]].ReplyCount, int64(4))
		require.Len(t, r1.Order, 2) // including the root post
		require.Len(t, r1.Posts, 2)
		assert.LessOrEqual(t, r1.Posts[r1.Order[1]].CreateAt, m1.CreateAt)
		assert.True(t, *r1.HasNext)

		// Non-CRT mode
		opts = model.GetPostsOptions{
			CollapsedThreads: false,
			PerPage:          2,
			Direction:        "down",
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 2)
		require.Len(t, r1.Posts, 2)
		assert.True(t, *r1.HasNext)

		lastPostID = r1.Order[len(r1.Order)-1]
		lastPostCreateAt = r1.Posts[lastPostID].CreateAt

		opts = model.GetPostsOptions{
			CollapsedThreads: false,
			PerPage:          3,
			Direction:        "down",
			FromPost:         lastPostID,
			FromCreateAt:     lastPostCreateAt,
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Equal(t, r1.Posts[r1.Order[0]].ReplyCount, int64(4))
		require.Equal(t, r1.Posts[r1.Order[1]].ReplyCount, int64(4))
		require.Equal(t, r1.Posts[r1.Order[2]].ReplyCount, int64(4))
		require.Equal(t, r1.Posts[r1.Order[3]].ReplyCount, int64(4))
		require.Len(t, r1.Order, 4) // including the root post
		require.Len(t, r1.Posts, 4)
		assert.GreaterOrEqual(t, r1.Posts[r1.Order[len(r1.Order)-1]].CreateAt, lastPostCreateAt)
		assert.False(t, *r1.HasNext)

		// Going from bottom to top now.
		firstPostCreateAt = r1.Posts[r1.Order[1]].CreateAt
		opts = model.GetPostsOptions{
			CollapsedThreads: false,
			PerPage:          2,
			Direction:        "up",
			FromPost:         r1.Order[1],
			FromCreateAt:     firstPostCreateAt,
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 2)
		require.Len(t, r1.Posts, 2)
		assert.LessOrEqual(t, r1.Posts[r1.Order[1]].CreateAt, firstPostCreateAt)
		assert.False(t, *r1.HasNext)

		// Only with CreateAt
		opts = model.GetPostsOptions{
			CollapsedThreads: false,
			PerPage:          1,
			Direction:        "down",
			FromCreateAt:     m1.CreateAt,
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 2) // including the root post
		require.Len(t, r1.Posts, 2)
		assert.GreaterOrEqual(t, r1.Posts[r1.Order[1]].CreateAt, m1.CreateAt)
		assert.True(t, *r1.HasNext)
	})

	t.Run("Pagination with UpdateAt", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		now := model.GetMillis()
		o1 := &model.Post{CreateAt: now, ChannelId: channel.Id, UserId: model.NewId(), Message: NewTestID()}
		o1, err = ss.Post().Save(rctx, o1)
		require.NoError(t, err)

		// Create replies with explicit UpdateAt timestamps
		o2 := &model.Post{CreateAt: now + 1, UpdateAt: now + 1, ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id}
		_, err = ss.Post().Save(rctx, o2)
		require.NoError(t, err)

		m1 := &model.Post{CreateAt: now + 2, UpdateAt: now + 2, ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id}
		m1, err = ss.Post().Save(rctx, m1)
		require.NoError(t, err)

		o3 := &model.Post{CreateAt: now + 3, UpdateAt: now + 3, ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id}
		_, err = ss.Post().Save(rctx, o3)
		require.NoError(t, err)

		o4 := &model.Post{CreateAt: now + 4, UpdateAt: now + 4, ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestID(), RootId: o1.Id}
		o4, err = ss.Post().Save(rctx, o4)
		require.NoError(t, err)

		// Test pagination with UpdateAt in "down" direction
		opts := model.GetPostsOptions{
			UpdatesOnly:      true,
			CollapsedThreads: true,
			PerPage:          2,
			Direction:        "down",
		}
		r1, err := ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 3) // including the root post
		require.Len(t, r1.Posts, 3)
		assert.Equal(t, r1.Posts[r1.Order[0]].UpdateAt, o4.CreateAt) // The root post always get updated with the createAt of the latest post in the thread.
		assert.True(t, *r1.HasNext)

		lastPostID := r1.Order[len(r1.Order)-1]
		lastPostUpdateAt := r1.Posts[lastPostID].UpdateAt

		// Continue pagination using UpdateAt
		opts = model.GetPostsOptions{
			UpdatesOnly:      true,
			CollapsedThreads: true,
			PerPage:          2,
			Direction:        "down",
			FromPost:         lastPostID,
			FromUpdateAt:     lastPostUpdateAt,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 3) // including the root post
		require.Len(t, r1.Posts, 3)
		assert.GreaterOrEqual(t, r1.Posts[r1.Order[len(r1.Order)-1]].UpdateAt, lastPostUpdateAt)
		assert.Equal(t, r1.Posts[r1.Order[0]].UpdateAt, o4.CreateAt) // The root post always get updated with the createAt of the latest post in the thread.
		assert.False(t, *r1.HasNext)

		// Non-CRT mode with UpdateAt pagination
		opts = model.GetPostsOptions{
			UpdatesOnly:      true,
			CollapsedThreads: false,
			PerPage:          2,
			Direction:        "down",
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		// Ordering by updateAt will move the root post down, so we will get more posts in the thread.
		require.Len(t, r1.Order, 3)
		require.Len(t, r1.Posts, 3)
		require.True(t, *r1.HasNext)

		lastPostID = r1.Order[len(r1.Order)-1]
		lastPostUpdateAt = r1.Posts[lastPostID].UpdateAt

		opts = model.GetPostsOptions{
			UpdatesOnly:      true,
			CollapsedThreads: false,
			PerPage:          3,
			Direction:        "down",
			FromPost:         lastPostID,
			FromUpdateAt:     lastPostUpdateAt,
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 3)
		require.Len(t, r1.Posts, 3)
		require.Equal(t, r1.Posts[r1.Order[0]].ReplyCount, int64(4))
		require.Equal(t, r1.Posts[r1.Order[1]].ReplyCount, int64(4))
		require.Equal(t, r1.Posts[r1.Order[2]].ReplyCount, int64(4))
		require.GreaterOrEqual(t, r1.Posts[r1.Order[len(r1.Order)-1]].UpdateAt, lastPostUpdateAt)
		assert.False(t, *r1.HasNext)

		// Only with UpdateAt - direction down
		opts = model.GetPostsOptions{
			UpdatesOnly:      true,
			CollapsedThreads: false,
			PerPage:          1,
			Direction:        "down",
			FromUpdateAt:     m1.UpdateAt,
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		require.Len(t, r1.Order, 2)
		require.Len(t, r1.Posts, 2)
		require.GreaterOrEqual(t, r1.Posts[r1.Order[1]].UpdateAt, m1.UpdateAt)
		require.True(t, *r1.HasNext)
	})
}

func testPostStoreGetSingle(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = o1.UserId
	o2.Message = NewTestID()

	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = o1.UserId
	o3.Message = model.NewRandomString(10)
	o3.RootId = o1.Id

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = o1.UserId
	o4.Message = model.NewRandomString(10)
	o4.RootId = o1.Id

	_, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	o4, err = ss.Post().Save(rctx, o4)
	require.NoError(t, err)

	err = ss.Post().Delete(rctx, o2.Id, model.GetMillis(), o2.UserId)
	require.NoError(t, err)

	err = ss.Post().Delete(rctx, o4.Id, model.GetMillis(), o4.UserId)
	require.NoError(t, err)

	post, err := ss.Post().GetSingle(rctx, o1.Id, false)
	require.NoError(t, err)
	require.Equal(t, post.CreateAt, o1.CreateAt, "invalid returned post")
	require.Equal(t, int64(1), post.ReplyCount, "wrong replyCount computed")

	_, err = ss.Post().GetSingle(rctx, o2.Id, false)
	require.Error(t, err, "should not return deleted post")

	post, err = ss.Post().GetSingle(rctx, o2.Id, true)
	require.NoError(t, err)
	require.Equal(t, post.CreateAt, o2.CreateAt, "invalid returned post")
	require.NotZero(t, post.DeleteAt, "DeleteAt should be non-zero")
	require.Zero(t, post.ReplyCount, "Post without replies should return zero ReplyCount")

	_, err = ss.Post().GetSingle(rctx, "123", false)
	require.Error(t, err, "Missing id should have failed")
}

func testPostStoreUpdate(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	r1, err := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro1 := r1.Posts[o1.Id]

	r2, err := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro2 := r2.Posts[o2.Id]

	r3, err := ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro3 := r3.Posts[o3.Id]

	require.Equal(t, ro1.Message, o1.Message, "Failed to save/get")

	o1a := ro1.Clone()
	o1a.Message = ro1.Message + "BBBBBBBBBB"
	_, err = ss.Post().Update(rctx, o1a, ro1)
	require.NoError(t, err)

	r1, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	ro1a := r1.Posts[o1.Id]
	require.Equal(t, ro1a.Message, o1a.Message, "Failed to update/get")

	o2a := ro2.Clone()
	o2a.Message = ro2.Message + "DDDDDDD"
	_, err = ss.Post().Update(rctx, o2a, ro2)
	require.NoError(t, err)

	r2, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro2a := r2.Posts[o2.Id]

	require.Equal(t, ro2a.Message, o2a.Message, "Failed to update/get")

	o3a := ro3.Clone()
	o3a.Message = ro3.Message + "WWWWWWW"
	_, err = ss.Post().Update(rctx, o3a, ro3)
	require.NoError(t, err)

	r3, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro3a := r3.Posts[o3.Id]

	if ro3a.Message != o3a.Message {
		require.Equal(t, ro3a.Hashtags, o3a.Hashtags, "Failed to update/get")
	}

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	o4, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel2.Id,
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})
	require.NoError(t, err)

	r4, err := ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro4 := r4.Posts[o4.Id]

	o4a := ro4.Clone()
	o4a.Filenames = []string{}
	o4a.FileIds = []string{model.NewId()}
	_, err = ss.Post().Update(rctx, o4a, ro4)
	require.NoError(t, err)

	r4, err = ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	ro4a := r4.Posts[o4.Id]
	require.Empty(t, ro4a.Filenames, "Failed to clear Filenames")
	require.Len(t, ro4a.FileIds, 1, "Failed to set FileIds")
}

func testPostStoreDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("single post, no replies", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		// Create a post
		rootPost, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   model.NewRandomString(10),
		})
		require.NoError(t, err)

		// Verify etag generation for the channel containing the post.
		etag1 := ss.Post().GetEtag(rootPost.ChannelId, false, false)
		require.Equal(t, 0, strings.Index(etag1, model.CurrentVersion+"."), "Invalid Etag")

		// Verify the created post.
		r1, err := ss.Post().Get(context.Background(), rootPost.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)
		require.NotNil(t, r1.Posts[rootPost.Id])
		require.Equal(t, rootPost, r1.Posts[rootPost.Id])

		// Mark the post as deleted by the user identified with deleteByID.
		deleteByID := model.NewId()
		err = ss.Post().Delete(rctx, rootPost.Id, model.GetMillis(), deleteByID)
		require.NoError(t, err)

		// Ensure the appropriate posts prop reflects the user deleting the post.
		posts, err := ss.Post().GetPostsCreatedAt(rootPost.ChannelId, rootPost.CreateAt)
		require.NoError(t, err)
		require.NotEmpty(t, posts)
		assert.Equal(t, deleteByID, posts[0].GetProp(model.PostPropsDeleteBy), "unexpected Props[model.PostPropsDeleteBy]")

		// Verify that the post is no longer fetched by default.
		_, err = ss.Post().Get(context.Background(), rootPost.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.Error(t, err, "fetching deleted post should have failed")
		require.IsType(t, &store.ErrNotFound{}, err)

		// Verify etag generation for the channel containing the now deleted post.
		etag2 := ss.Post().GetEtag(rootPost.ChannelId, false, false)
		require.Equal(t, 0, strings.Index(etag2, model.CurrentVersion+"."), "Invalid Etag")
	})

	t.Run("thread with one reply", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		// Create a root post
		rootPost, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   NewTestID(),
		})
		require.NoError(t, err)

		// Reply to that root post
		replyPost, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost.Id,
		})
		require.NoError(t, err)

		// Delete the root post
		err = ss.Post().Delete(rctx, rootPost.Id, model.GetMillis(), "")
		require.NoError(t, err)

		// Verify the root post deleted
		_, err = ss.Post().Get(context.Background(), rootPost.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.Error(t, err, "Deleted id should have failed")
		require.IsType(t, &store.ErrNotFound{}, err)

		// Verify the reply post deleted
		_, err = ss.Post().Get(context.Background(), replyPost.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.Error(t, err, "Deleted id should have failed")
		require.IsType(t, &store.ErrNotFound{}, err)
	})

	t.Run("thread with multiple replies", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		// Create a root post
		rootPost1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   NewTestID(),
		})
		require.NoError(t, err)

		// Reply to that root post
		replyPost1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Reply to that root post a second time
		replyPost2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		channel2, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		// Create another root post in a separate channel
		rootPost2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel2.Id,
			UserId:    model.NewId(),
			Message:   NewTestID(),
		})
		require.NoError(t, err)

		// Delete the root post
		err = ss.Post().Delete(rctx, rootPost1.Id, model.GetMillis(), "")
		require.NoError(t, err)

		// Verify the root post and replies deleted
		_, err = ss.Post().Get(context.Background(), rootPost1.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.Error(t, err, "Deleted id should have failed")

		_, err = ss.Post().Get(context.Background(), replyPost1.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.Error(t, err, "Deleted id should have failed")

		_, err = ss.Post().Get(context.Background(), replyPost2.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.Error(t, err, "Deleted id should have failed")

		// Verify other root posts remain undeleted.
		_, err = ss.Post().Get(context.Background(), rootPost2.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)
	})

	t.Run("root post update at is updated upon reply delete", func(t *testing.T) {
		teamId := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamId,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		// Create a root post
		rootPost1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   NewTestID(),
		})
		require.NoError(t, err)

		// Reply to that root post
		_, err = ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Reply to that root post a second time
		replyPost2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Reply to that root post a third time
		_, err = ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		updatedRootPost, err := ss.Post().GetSingle(rctx, rootPost1.Id, false)
		require.NoError(t, err)

		beforeDeleteTime := updatedRootPost.UpdateAt

		// Delete the reply previous to last
		err = ss.Post().Delete(rctx, replyPost2.Id, model.GetMillis(), "")
		require.NoError(t, err)

		updatedRootPost, err = ss.Post().GetSingle(rctx, rootPost1.Id, false)
		require.NoError(t, err)

		require.Greater(t, updatedRootPost.UpdateAt, beforeDeleteTime)
	})

	t.Run("thread with multiple replies, update thread last reply at", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		// Create a root post
		rootPost1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   NewTestID(),
		})
		require.NoError(t, err)

		// Reply to that root post
		replyPost1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Reply to that root post a second time
		replyPost2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Reply to that root post a third time
		replyPost3, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		thread, err := ss.Thread().Get(rootPost1.Id)
		require.NoError(t, err)
		require.Equal(t, replyPost3.CreateAt, thread.LastReplyAt)

		// Delete the reply previous to last
		err = ss.Post().Delete(rctx, replyPost2.Id, model.GetMillis(), "")
		require.NoError(t, err)

		thread, err = ss.Thread().Get(rootPost1.Id)
		require.NoError(t, err)
		// last reply at should be unchanged
		require.Equal(t, replyPost3.CreateAt, thread.LastReplyAt)

		// Delete the last reply
		err = ss.Post().Delete(rctx, replyPost3.Id, model.GetMillis(), "")
		require.NoError(t, err)

		thread, err = ss.Thread().Get(rootPost1.Id)
		require.NoError(t, err)
		// last reply at should have changed
		require.Equal(t, replyPost1.CreateAt, thread.LastReplyAt)

		// Delete the last reply
		err = ss.Post().Delete(rctx, replyPost1.Id, model.GetMillis(), "")
		require.NoError(t, err)

		thread, err = ss.Thread().Get(rootPost1.Id)
		require.NoError(t, err)
		// last reply at should be 0
		require.Equal(t, int64(0), thread.LastReplyAt)
	})

	t.Run("thread with file attachments", func(t *testing.T) {
		teamID := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		// Create a root post
		rootPost1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   NewTestID(),
		})
		require.NoError(t, err)

		// Create another root post
		rootPost2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   NewTestID(),
		})
		require.NoError(t, err)

		// Reply to first root post with file attachments
		replyPost1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)
		file11, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			Id:        model.NewId(),
			PostId:    replyPost1.Id,
			CreatorId: replyPost1.UserId,
			Path:      "file1.txt",
		})
		require.NoError(t, err)
		file12, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			Id:        model.NewId(),
			PostId:    replyPost1.Id,
			CreatorId: replyPost1.UserId,
			Path:      "file2.png",
		})
		require.NoError(t, err)

		// Reply to second root post with file attachments
		replyPost2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: rootPost2.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestID(),
			RootId:    rootPost2.Id,
		})
		require.NoError(t, err)
		file21, err := ss.FileInfo().Save(rctx, &model.FileInfo{
			Id:        model.NewId(),
			PostId:    replyPost2.Id,
			CreatorId: replyPost2.UserId,
			Path:      "file1.txt",
		})
		require.NoError(t, err)

		// Delete the first root post
		err = ss.Post().Delete(rctx, rootPost1.Id, model.GetMillis(), "")
		require.NoError(t, err)

		// Verify the reply post's files are deleted
		_, err = ss.FileInfo().Get(file11.Id)
		require.Error(t, err, "Deleted id should have failed")
		require.IsType(t, &store.ErrNotFound{}, err)
		_, err = ss.FileInfo().Get(file12.Id)
		require.Error(t, err, "Deleted id should have failed")
		require.IsType(t, &store.ErrNotFound{}, err)

		// Verify the other reply post's files are NOT deleted
		_, err = ss.FileInfo().Get(file21.Id)
		require.NoError(t, err, "Not deleted id should have succeeded")
	})
}

func testPostStorePermDelete1Level(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	r1 := &model.Reaction{}
	r1.ChannelId = o1.ChannelId
	r1.UserId = o2.UserId
	r1.PostId = o1.Id
	r1.EmojiName = "smile"
	r1, err = ss.Reaction().Save(r1)
	require.NoError(t, err)

	r2 := &model.Reaction{}
	r2.ChannelId = o1.ChannelId
	r2.UserId = o1.UserId
	r2.PostId = o2.Id
	r2.EmojiName = "wave"
	_, err = ss.Reaction().Save(r2)
	require.NoError(t, err)

	r3 := &model.Reaction{}
	r3.ChannelId = o1.ChannelId
	r3.UserId = model.NewId()
	r3.PostId = o1.Id
	r3.EmojiName = "sad"
	r3, err = ss.Reaction().Save(r3)
	require.NoError(t, err)

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	o3 := &model.Post{}
	o3.ChannelId = channel2.Id
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	r4 := &model.Reaction{}
	r4.ChannelId = channel2.Id
	r4.UserId = model.NewId()
	r4.PostId = o3.Id
	r4.EmojiName = "angry"
	_, err = ss.Reaction().Save(r4)
	require.NoError(t, err)

	channel3, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName3",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o4 := &model.Post{}
	o4.ChannelId = channel3.Id
	o4.RootId = o1.Id
	o4.UserId = o2.UserId
	o4.Message = NewTestID()
	o4, err = ss.Post().Save(rctx, o4)
	require.NoError(t, err)

	o5 := &model.Post{}
	o5.ChannelId = o3.ChannelId
	o5.UserId = model.NewId()
	o5.Message = NewTestID()
	o5, err = ss.Post().Save(rctx, o5)
	require.NoError(t, err)

	o6 := &model.Post{}
	o6.ChannelId = o3.ChannelId
	o6.RootId = o5.Id
	o6.UserId = model.NewId()
	o6.Message = NewTestID()
	o6, err = ss.Post().Save(rctx, o6)
	require.NoError(t, err)

	var thread *model.Thread
	thread, err = ss.Thread().Get(o1.Id)
	require.NoError(t, err)

	require.EqualValues(t, 2, thread.ReplyCount)
	require.EqualValues(t, model.StringArray{o2.UserId}, thread.Participants)

	err2 := ss.Post().PermanentDeleteByUser(rctx, o2.UserId)
	require.NoError(t, err2)

	thread, err = ss.Thread().Get(o1.Id)
	require.NoError(t, err)

	require.EqualValues(t, 0, thread.ReplyCount)
	require.EqualValues(t, model.StringArray{}, thread.Participants)

	_, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err, "Deleted id shouldn't have failed")

	reactions, err := ss.Reaction().GetForPost(o1.Id, false)
	require.NoError(t, err, "Reactions should exist")
	require.Equal(t, 2, len(reactions))
	emojis := []string{r1.EmojiName, r3.EmojiName}
	for _, reaction := range reactions {
		require.Contains(t, emojis, reaction.EmojiName)
	}

	_, err = ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	reactions, err = ss.Reaction().GetForPost(o2.Id, false)
	require.NoError(t, err, "No error for not found")
	require.Equal(t, 0, len(reactions))

	thread, err = ss.Thread().Get(o5.Id)
	require.NoError(t, err)
	require.NotEmpty(t, thread)

	err = ss.Post().PermanentDeleteByChannel(rctx, o3.ChannelId)
	require.NoError(t, err)

	thread, err = ss.Thread().Get(o5.Id)
	require.NoError(t, err)
	require.Nil(t, thread)

	reactions, err = ss.Reaction().GetForPost(o3.Id, false)
	require.NoError(t, err, "No error for not found")
	require.Equal(t, 0, len(reactions))

	reactions, err = ss.Reaction().GetForPost(o1.Id, false)
	require.NoError(t, err, "Reactions should exist")
	require.Equal(t, 2, len(reactions))
	for _, reaction := range reactions {
		require.Contains(t, emojis, reaction.EmojiName)
	}

	_, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o5.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o6.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")
}

func testPostStorePermDelete1Level2(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = channel2.Id
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	err2 := ss.Post().PermanentDeleteByUser(rctx, o1.UserId)
	require.NoError(t, err2)

	_, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err, "Deleted id should have failed")
}

func testPostStorePermDeleteLimitExceeded(t *testing.T, rctx request.CTX, ss store.Store) {
	const maxPosts = 10000
	teamID := model.NewId()
	userID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "10KPosts",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	for i := 0; i < maxPosts+100; i++ {
		post := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Message:   NewTestID(),
		}
		_, err = ss.Post().Save(rctx, post)
		require.NoError(t, err)
	}

	err = ss.Post().PermanentDeleteByUser(rctx, userID)
	var errLimitExceeded *store.ErrLimitExceeded
	require.ErrorAs(t, err, &errLimitExceeded)
}

func testPostStoreGetWithChildren(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3.RootId = o1.Id
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	pl, err := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	require.Len(t, pl.Posts, 3, "invalid returned post")

	dErr := ss.Post().Delete(rctx, o3.Id, model.GetMillis(), "")
	require.NoError(t, dErr)

	pl, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	require.Len(t, pl.Posts, 2, "invalid returned post")

	dErr = ss.Post().Delete(rctx, o2.Id, model.GetMillis(), "")
	require.NoError(t, dErr)

	pl, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	require.Len(t, pl.Posts, 1, "invalid returned post")
}

func testPostStoreGetPostsWithDetails(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.RootId = o1.Id
	_, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = NewTestID()
	o2a.RootId = o1.Id
	o2a, err = ss.Post().Save(rctx, o2a)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3.RootId = o1.Id
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = NewTestID()
	o4, err = ss.Post().Save(rctx, o4)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = NewTestID()
	o5.RootId = o4.Id
	o5, err = ss.Post().Save(rctx, o5)
	require.NoError(t, err)

	r1, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: o1.ChannelId, Page: 0, PerPage: 4}, false, map[string]bool{})
	require.NoError(t, err)

	require.Equal(t, r1.Order[0], o5.Id, "invalid order")
	require.Equal(t, r1.Order[1], o4.Id, "invalid order")
	require.Equal(t, r1.Order[2], o3.Id, "invalid order")
	require.Equal(t, r1.Order[3], o2a.Id, "invalid order")

	//the last 4, + o1 (o2a and o3's parent) + o2 (in same thread as o2a and o3)
	require.Len(t, r1.Posts, 6, "wrong size")

	require.Equal(t, r1.Posts[o1.Id].Message, o1.Message, "Missing parent")

	r2, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: o1.ChannelId, Page: 0, PerPage: 4}, false, map[string]bool{})
	require.NoError(t, err)

	require.Equal(t, r2.Order[0], o5.Id, "invalid order")
	require.Equal(t, r2.Order[1], o4.Id, "invalid order")
	require.Equal(t, r2.Order[2], o3.Id, "invalid order")
	require.Equal(t, r2.Order[3], o2a.Id, "invalid order")

	//the last 4, + o1 (o2a and o3's parent) + o2 (in same thread as o2a and o3)
	require.Len(t, r2.Posts, 6, "wrong size")

	require.Equal(t, r2.Posts[o1.Id].Message, o1.Message, "Missing parent")

	// Run once to fill cache
	_, err = ss.Post().GetPosts(model.GetPostsOptions{ChannelId: o1.ChannelId, Page: 0, PerPage: 30}, false, map[string]bool{})
	require.NoError(t, err)

	o6 := &model.Post{}
	o6.ChannelId = o1.ChannelId
	o6.UserId = model.NewId()
	o6.Message = NewTestID()
	_, err = ss.Post().Save(rctx, o6)
	require.NoError(t, err)

	r3, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: o1.ChannelId, Page: 0, PerPage: 30}, false, map[string]bool{})
	require.NoError(t, err)
	assert.Equal(t, 7, len(r3.Order))
}

func testPostStoreGetPostsBeforeAfter(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("without threads", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channelID := channel1.Id
		userID := model.NewId()

		var posts []*model.Post
		for i := 0; i < 10; i++ {
			post, err := ss.Post().Save(rctx, &model.Post{
				ChannelId: channelID,
				UserId:    userID,
				Message:   "message",
			})
			require.NoError(t, err)

			posts = append(posts, post)

			time.Sleep(time.Millisecond)
		}

		t.Run("should return error if negative Page/PerPage options are passed", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelID, PostId: posts[0].Id, Page: 0, PerPage: -1}, map[string]bool{})
			assert.Nil(t, postList)
			assert.Error(t, err)
			assert.IsType(t, &store.ErrInvalidInput{}, err)

			postList, err = ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelID, PostId: posts[0].Id, Page: -1, PerPage: 10}, map[string]bool{})
			assert.Nil(t, postList)
			assert.Error(t, err)
			assert.IsType(t, &store.ErrInvalidInput{}, err)
		})

		t.Run("should not return anything before the first post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelID, PostId: posts[0].Id, Page: 0, PerPage: 10}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{}, postList.Order)
			assert.Equal(t, map[string]*model.Post{}, postList.Posts)
		})

		t.Run("should return posts before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelID, PostId: posts[5].Id, Page: 0, PerPage: 10}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{posts[4].Id, posts[3].Id, posts[2].Id, posts[1].Id, posts[0].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[0].Id: posts[0],
				posts[1].Id: posts[1],
				posts[2].Id: posts[2],
				posts[3].Id: posts[3],
				posts[4].Id: posts[4],
			}, postList.Posts)
		})

		t.Run("should limit posts before", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelID, PostId: posts[5].Id, PerPage: 2}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{posts[4].Id, posts[3].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[3].Id: posts[3],
				posts[4].Id: posts[4],
			}, postList.Posts)
		})

		t.Run("should not return anything after the last post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelID, PostId: posts[len(posts)-1].Id, PerPage: 10}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{}, postList.Order)
			assert.Equal(t, map[string]*model.Post{}, postList.Posts)
		})

		t.Run("should return posts after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelID, PostId: posts[5].Id, PerPage: 10}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{posts[9].Id, posts[8].Id, posts[7].Id, posts[6].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[6].Id: posts[6],
				posts[7].Id: posts[7],
				posts[8].Id: posts[8],
				posts[9].Id: posts[9],
			}, postList.Posts)
		})

		t.Run("should limit posts after", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelID, PostId: posts[5].Id, PerPage: 2}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{posts[7].Id, posts[6].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[6].Id: posts[6],
				posts[7].Id: posts[7],
			}, postList.Posts)
		})
	})
	t.Run("with threads", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channelID := channel1.Id
		userID := model.NewId()

		// This creates a series of posts that looks like:
		// post1
		// post2
		// post3 (in response to post1)
		// post4 (in response to post2)
		// post5
		// post6 (in response to post2)

		post1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		post1.ReplyCount = 1
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		post2.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post1.Id,
			Message:   "message",
		})
		require.NoError(t, err)
		post3.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post2.Id,
			Message:   "message",
		})
		require.NoError(t, err)
		post4.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post2.Id,
			Message:   "message",
		})
		post6.ReplyCount = 2
		require.NoError(t, err)

		// Adding a post to a thread changes the UpdateAt timestamp of the parent post
		post1.UpdateAt = post3.UpdateAt
		post2.UpdateAt = post6.UpdateAt

		t.Run("should return each post and thread before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelID, PostId: post4.Id, PerPage: 2}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post3.Id, post2.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post1.Id: post1,
				post2.Id: post2,
				post3.Id: post3,
				post4.Id: post4,
				post6.Id: post6,
			}, postList.Posts)
		})

		t.Run("should return each post and the root of each thread after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelID, PostId: post4.Id, PerPage: 2}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post6.Id, post5.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post2.Id: post2,
				post4.Id: post4,
				post5.Id: post5,
				post6.Id: post6,
			}, postList.Posts)
		})
	})
	t.Run("with threads (skipFetchThreads)", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channelID := channel1.Id
		userID := model.NewId()

		// This creates a series of posts that looks like:
		// post1
		// post2
		// post3 (in response to post1)
		// post4 (in response to post2)
		// post5
		// post6 (in response to post2)

		post1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "post1",
		})
		require.NoError(t, err)
		post1.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "post2",
		})
		require.NoError(t, err)
		post2.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post1.Id,
			Message:   "post3",
		})
		require.NoError(t, err)
		post3.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post2.Id,
			Message:   "post4",
		})
		require.NoError(t, err)
		post4.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "post5",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post2.Id,
			Message:   "post6",
		})
		post6.ReplyCount = 2
		require.NoError(t, err)

		// Adding a post to a thread changes the UpdateAt timestamp of the parent post
		post1.UpdateAt = post3.UpdateAt
		post2.UpdateAt = post6.UpdateAt

		t.Run("should return each post and thread before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelID, PostId: post4.Id, PerPage: 2, SkipFetchThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post3.Id, post2.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post1.Id: post1,
				post2.Id: post2,
				post3.Id: post3,
			}, postList.Posts)
		})

		t.Run("should return each post and thread before a post with limit", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelID, PostId: post4.Id, PerPage: 1, SkipFetchThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post3.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post1.Id: post1,
				post3.Id: post3,
			}, postList.Posts)
		})

		t.Run("should return each post and the root of each thread after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelID, PostId: post4.Id, PerPage: 2, SkipFetchThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post6.Id, post5.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post2.Id: post2,
				post5.Id: post5,
				post6.Id: post6,
			}, postList.Posts)
		})
	})
	t.Run("with threads (collapsedThreads)", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channelID := channel1.Id
		userID := model.NewId()

		// This creates a series of posts that looks like:
		// post1
		// post2
		// post3 (in response to post1)
		// post4 (in response to post2)
		// post5
		// post6 (in response to post2)

		post1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "post1",
		})
		require.NoError(t, err)
		post1.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "post2",
		})
		require.NoError(t, err)
		post2.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post1.Id,
			Message:   "post3",
		})
		require.NoError(t, err)
		post3.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post2.Id,
			Message:   "post4",
		})
		require.NoError(t, err)
		post4.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "post5",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			RootId:    post2.Id,
			Message:   "post6",
		})
		post6.ReplyCount = 2
		require.NoError(t, err)

		// Adding a post to a thread changes the UpdateAt timestamp of the parent post
		post1.UpdateAt = post3.UpdateAt
		post2.UpdateAt = post6.UpdateAt

		t.Run("should return each root post before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelID, PostId: post4.Id, PerPage: 2, CollapsedThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post2.Id, post1.Id}, postList.Order)
		})

		t.Run("should return each root post before a post with limit", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelID, PostId: post4.Id, PerPage: 1, CollapsedThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post2.Id}, postList.Order)
		})

		t.Run("should return each root after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelID, PostId: post4.Id, PerPage: 2, CollapsedThreads: true}, map[string]bool{})
			require.NoError(t, err)

			assert.Equal(t, []string{post5.Id}, postList.Order)
		})
	})
}

func testPostStoreGetPostsSince(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should return posts created after the given time", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channelID := channel1.Id
		userID := model.NewId()

		post1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		_, err = ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
			RootId:    post3.Id,
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
			RootId:    post1.Id,
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		postList, err := ss.Post().GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelID, Time: post3.CreateAt}, false, map[string]bool{})
		require.NoError(t, err)

		assert.Equal(t, []string{
			post6.Id,
			post5.Id,
			post4.Id,
			post3.Id,
			post1.Id,
		}, postList.Order)

		assert.Len(t, postList.Posts, 5)
		assert.NotNil(t, postList.Posts[post1.Id], "should return the parent post")
		assert.NotNil(t, postList.Posts[post3.Id])
		assert.NotNil(t, postList.Posts[post4.Id])
		assert.NotNil(t, postList.Posts[post5.Id])
		assert.NotNil(t, postList.Posts[post6.Id])
	})

	t.Run("should return empty list when nothing has changed", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channelID := channel1.Id
		userID := model.NewId()

		post1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		postList, err := ss.Post().GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelID, Time: post1.CreateAt}, false, map[string]bool{})
		assert.NoError(t, err)

		assert.Equal(t, []string{}, postList.Order)
		assert.Empty(t, postList.Posts)
	})

	t.Run("should not cache a timestamp of 0 when nothing has changed", func(t *testing.T) {
		ss.Post().ClearCaches()

		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channelID := channel1.Id
		userID := model.NewId()

		post1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		// Make a request that returns no results
		postList, err := ss.Post().GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelID, Time: post1.CreateAt}, true, map[string]bool{})
		require.NoError(t, err)
		require.Equal(t, model.NewPostList(), postList)

		// And then ensure that it doesn't cause future requests to also return no results
		postList, err = ss.Post().GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelID, Time: post1.CreateAt - 1}, true, map[string]bool{})
		require.NoError(t, err)

		assert.Equal(t, []string{post1.Id}, postList.Order)

		assert.Len(t, postList.Posts, 1)
		assert.NotNil(t, postList.Posts[post1.Id])
	})
}

func testPostStoreGetPosts(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	channelID := channel1.Id
	userID := model.NewId()

	post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channelID,
		UserId:    userID,
		Message:   "message",
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channelID,
		UserId:    userID,
		Message:   "message",
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post3, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channelID,
		UserId:    userID,
		Message:   "message",
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post4, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channelID,
		UserId:    userID,
		Message:   "message",
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post5, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channelID,
		UserId:    userID,
		Message:   "message",
		RootId:    post3.Id,
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post6, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channelID,
		UserId:    userID,
		Message:   "message",
		RootId:    post1.Id,
	})
	require.NoError(t, err)

	t.Run("should return the last posts created in a channel", func(t *testing.T) {
		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelID, Page: 0, PerPage: 30, SkipFetchThreads: false}, false, map[string]bool{})
		assert.NoError(t, err)

		assert.Equal(t, []string{
			post6.Id,
			post5.Id,
			post4.Id,
			post3.Id,
			post2.Id,
			post1.Id,
		}, postList.Order)

		assert.Len(t, postList.Posts, 6)
		assert.NotNil(t, postList.Posts[post1.Id])
		assert.NotNil(t, postList.Posts[post2.Id])
		assert.NotNil(t, postList.Posts[post3.Id])
		assert.NotNil(t, postList.Posts[post4.Id])
		assert.NotNil(t, postList.Posts[post5.Id])
		assert.NotNil(t, postList.Posts[post6.Id])
	})

	t.Run("should return the last posts created in a channel and the threads and the reply count must be 0", func(t *testing.T) {
		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelID, Page: 0, PerPage: 2, SkipFetchThreads: false}, false, map[string]bool{})
		assert.NoError(t, err)

		assert.Equal(t, []string{
			post6.Id,
			post5.Id,
		}, postList.Order)

		assert.Len(t, postList.Posts, 4)
		require.NotNil(t, postList.Posts[post1.Id])
		require.NotNil(t, postList.Posts[post3.Id])
		require.NotNil(t, postList.Posts[post5.Id])
		require.NotNil(t, postList.Posts[post6.Id])
		assert.Equal(t, int64(0), postList.Posts[post1.Id].ReplyCount)
		assert.Equal(t, int64(0), postList.Posts[post3.Id].ReplyCount)
		assert.Equal(t, int64(0), postList.Posts[post5.Id].ReplyCount)
		assert.Equal(t, int64(0), postList.Posts[post6.Id].ReplyCount)
	})

	t.Run("should return the last posts created in a channel without the threads and the reply count must be correct", func(t *testing.T) {
		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelID, Page: 0, PerPage: 2, SkipFetchThreads: true}, false, map[string]bool{})
		require.NoError(t, err)

		assert.Equal(t, []string{
			post6.Id,
			post5.Id,
		}, postList.Order)

		assert.Len(t, postList.Posts, 4)
		assert.NotNil(t, postList.Posts[post5.Id])
		assert.NotNil(t, postList.Posts[post6.Id])
		assert.Equal(t, int64(1), postList.Posts[post5.Id].ReplyCount)
		assert.Equal(t, int64(1), postList.Posts[post6.Id].ReplyCount)
	})

	t.Run("should return all posts in a channel included deleted posts", func(t *testing.T) {
		err := ss.Post().Delete(rctx, post1.Id, 1, userID)
		require.NoError(t, err)

		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelID, Page: 0, PerPage: 30, SkipFetchThreads: false, IncludeDeleted: true}, false, map[string]bool{})
		require.NoError(t, err)

		assert.Equal(t, []string{
			post6.Id,
			post5.Id,
			post4.Id,
			post3.Id,
			post2.Id,
			post1.Id,
		}, postList.Order)

		assert.Len(t, postList.Posts, 6)
		assert.NotNil(t, postList.Posts[post1.Id])
		assert.NotNil(t, postList.Posts[post2.Id])
		assert.NotNil(t, postList.Posts[post3.Id])
		assert.NotNil(t, postList.Posts[post4.Id])
		assert.NotNil(t, postList.Posts[post5.Id])
		assert.NotNil(t, postList.Posts[post6.Id])
	})

	t.Run("should return all posts in a channel included deleted posts without threads", func(t *testing.T) {
		err := ss.Post().Delete(rctx, post5.Id, 1, userID)
		require.NoError(t, err)

		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelID, Page: 0, PerPage: 30, SkipFetchThreads: true, IncludeDeleted: true}, false, map[string]bool{})
		require.NoError(t, err)

		assert.Equal(t, []string{
			post6.Id,
			post5.Id,
			post4.Id,
			post3.Id,
			post2.Id,
			post1.Id,
		}, postList.Order)

		assert.Len(t, postList.Posts, 6)
		assert.NotNil(t, postList.Posts[post5.Id])
		assert.NotNil(t, postList.Posts[post6.Id])
		assert.Equal(t, int64(1), postList.Posts[post5.Id].ReplyCount)
		assert.Equal(t, int64(1), postList.Posts[post6.Id].ReplyCount)
	})

	t.Run("should return the lasts posts created in channel without include deleted posts", func(t *testing.T) {
		err := ss.Post().Delete(rctx, post6.Id, 1, userID)
		require.NoError(t, err)

		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelID, Page: 0, PerPage: 30, SkipFetchThreads: true, IncludeDeleted: false}, false, map[string]bool{})
		require.NoError(t, err)

		assert.Equal(t, []string{
			post4.Id,
			post3.Id,
			post2.Id,
		}, postList.Order)

		assert.Len(t, postList.Posts, 3)
		assert.NotNil(t, postList.Posts[post2.Id])
		assert.NotNil(t, postList.Posts[post3.Id])
		assert.NotNil(t, postList.Posts[post4.Id])
	})
}

func testPostStoreGetPostBeforeAfter(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	channelID := channel1.Id

	o0 := &model.Post{}
	o0.ChannelId = channelID
	o0.UserId = model.NewId()
	o0.Message = NewTestID()
	_, err = ss.Post().Save(rctx, o0)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o1 := &model.Post{}
	o1.ChannelId = channelID
	o1.Type = model.PostTypeJoinChannel
	o1.UserId = model.NewId()
	o1.Message = "system_join_channel message"
	_, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o0a := &model.Post{}
	o0a.ChannelId = channelID
	o0a.UserId = model.NewId()
	o0a.Message = NewTestID()
	o0a.RootId = o1.Id
	_, err = ss.Post().Save(rctx, o0a)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o0b := &model.Post{}
	o0b.ChannelId = channelID
	o0b.UserId = model.NewId()
	o0b.Message = "deleted message"
	o0b.RootId = o1.Id
	o0b.DeleteAt = 1
	_, err = ss.Post().Save(rctx, o0b)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	otherChannelPost := &model.Post{}
	otherChannelPost.ChannelId = channel2.Id
	otherChannelPost.UserId = model.NewId()
	otherChannelPost.Message = NewTestID()
	_, err = ss.Post().Save(rctx, otherChannelPost)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = channelID
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	_, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = channelID
	o2a.UserId = model.NewId()
	o2a.Message = NewTestID()
	o2a.RootId = o2.Id
	_, err = ss.Post().Save(rctx, o2a)
	require.NoError(t, err)

	rPostID1, err := ss.Post().GetPostIdBeforeTime(channelID, o0a.CreateAt, false)
	require.Equal(t, rPostID1, o1.Id, "should return before post o1")
	require.NoError(t, err)

	rPostID1, err = ss.Post().GetPostIdAfterTime(channelID, o0b.CreateAt, false)
	require.Equal(t, rPostID1, o2.Id, "should return before post o2")
	require.NoError(t, err)

	rPost1, err := ss.Post().GetPostAfterTime(channelID, o0b.CreateAt, false)
	require.Equal(t, rPost1.Id, o2.Id, "should return before post o2")
	require.NoError(t, err)

	rPostID2, err := ss.Post().GetPostIdBeforeTime(channelID, o0.CreateAt, false)
	require.Empty(t, rPostID2, "should return no post")
	require.NoError(t, err)

	rPostID2, err = ss.Post().GetPostIdAfterTime(channelID, o0.CreateAt, false)
	require.Equal(t, rPostID2, o1.Id, "should return before post o1")
	require.NoError(t, err)

	rPost2, err := ss.Post().GetPostAfterTime(channelID, o0.CreateAt, false)
	require.Equal(t, rPost2.Id, o1.Id, "should return before post o1")
	require.NoError(t, err)

	rPostID3, err := ss.Post().GetPostIdBeforeTime(channelID, o2a.CreateAt, false)
	require.Equal(t, rPostID3, o2.Id, "should return before post o2")
	require.NoError(t, err)

	rPostID3, err = ss.Post().GetPostIdAfterTime(channelID, o2a.CreateAt, false)
	require.Empty(t, rPostID3, "should return no post")
	require.NoError(t, err)

	rPost3, err := ss.Post().GetPostAfterTime(channelID, o2a.CreateAt, false)
	require.Empty(t, rPost3.Id, "should return no post")
	require.NoError(t, err)
}

func testUserCountsWithPostsByDay(t *testing.T, rctx request.CTX, ss store.Store) {
	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = NewTestID()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	t1, err := ss.Team().Save(t1)
	require.NoError(t, err)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, nErr := ss.Channel().Save(rctx, c1, -1)
	require.NoError(t, nErr)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = NewTestID()
	o1, nErr = ss.Post().Save(rctx, o1)
	require.NoError(t, nErr)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = NewTestID()
	_, nErr = ss.Post().Save(rctx, o1a)
	require.NoError(t, nErr)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2.Message = NewTestID()
	o2, nErr = ss.Post().Save(rctx, o2)
	require.NoError(t, nErr)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2a.Message = NewTestID()
	_, nErr = ss.Post().Save(rctx, o2a)
	require.NoError(t, nErr)

	r1, err := ss.Post().AnalyticsUserCountsWithPostsByDay(t1.Id)
	require.NoError(t, err)

	row1 := r1[0]
	require.Equal(t, float64(2), row1.Value, "wrong value")

	row2 := r1[1]
	require.Equal(t, float64(1), row2.Value, "wrong value")
}

func testPostCountsByDay(t *testing.T, rctx request.CTX, ss store.Store) {
	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = NewTestID()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	t1, err := ss.Team().Save(t1)
	require.NoError(t, err)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, nErr := ss.Channel().Save(rctx, c1, -1)
	require.NoError(t, nErr)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = NewTestID()
	o1.Hashtags = "hashtag"
	o1, nErr = ss.Post().Save(rctx, o1)
	require.NoError(t, nErr)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = NewTestID()
	o1a.FileIds = []string{"fileId1"}
	_, nErr = ss.Post().Save(rctx, o1a)
	require.NoError(t, nErr)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2.Message = NewTestID()
	o2.Filenames = []string{"filename1"}
	o2, nErr = ss.Post().Save(rctx, o2)
	require.NoError(t, nErr)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2a.Message = NewTestID()
	o2a.Hashtags = "hashtag"
	o2a.FileIds = []string{"fileId2"}
	_, nErr = ss.Post().Save(rctx, o2a)
	require.NoError(t, nErr)

	bot1 := &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     model.NewId(),
		UserId:      model.NewId(),
	}
	_, nErr = ss.Bot().Save(bot1)
	require.NoError(t, nErr)

	b1 := &model.Post{}
	b1.Message = "bot message one"
	b1.ChannelId = c1.Id
	b1.UserId = bot1.UserId
	b1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	_, nErr = ss.Post().Save(rctx, b1)
	require.NoError(t, nErr)

	b1a := &model.Post{}
	b1a.Message = "bot message two"
	b1a.ChannelId = c1.Id
	b1a.UserId = bot1.UserId
	b1a.CreateAt = utils.MillisFromTime(utils.Yesterday()) - (1000 * 60 * 60 * 24 * 2)
	_, nErr = ss.Post().Save(rctx, b1a)
	require.NoError(t, nErr)

	require.NoError(t, ss.Post().RefreshPostStats())

	time.Sleep(1 * time.Second)

	// summary of posts
	// yesterday - 2 non-bot user posts, 1 bot user post
	// 3 days ago - 2 non-bot user posts, 1 bot user post

	// last 31 days, all users (including bots)
	postCountsOptions := &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: false, YesterdayOnly: false}
	r1, err := ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.NoError(t, err)
	assert.Equal(t, float64(3), r1[0].Value)
	assert.Equal(t, float64(3), r1[1].Value)
	assert.Equal(t, utils.Yesterday().Format("2006-01-02"), r1[0].Name)
	assert.Equal(t, utils.Yesterday().Add(-48*time.Hour).Format("2006-01-02"), r1[1].Name)

	// last 31 days, bots only
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: true, YesterdayOnly: false}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.NoError(t, err)
	assert.Equal(t, float64(1), r1[0].Value)
	assert.Equal(t, float64(1), r1[1].Value)
	assert.Equal(t, utils.Yesterday().Format("2006-01-02"), r1[0].Name)
	assert.Equal(t, utils.Yesterday().Add(-48*time.Hour).Format("2006-01-02"), r1[1].Name)

	// yesterday only, all users (including bots)
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: false, YesterdayOnly: true}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.NoError(t, err)
	assert.Equal(t, float64(3), r1[0].Value)
	assert.Equal(t, utils.Yesterday().Format("2006-01-02"), r1[0].Name)

	// yesterday only, bots only
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: true, YesterdayOnly: true}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.NoError(t, err)
	assert.Equal(t, float64(1), r1[0].Value)
	assert.Equal(t, utils.Yesterday().Format("2006-01-02"), r1[0].Name)
}

func testPostCounts(t *testing.T, rctx request.CTX, ss store.Store) {
	now := time.Now()
	twentyMinAgo := now.Add(-20 * time.Minute).UnixMilli()
	fifteenMinAgo := now.Add(-15 * time.Minute).UnixMilli()
	tenMinAgo := now.Add(-10 * time.Minute).UnixMilli()

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = NewTestID()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	t1, err := ss.Team().Save(t1)
	require.NoError(t, err)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, nErr := ss.Channel().Save(rctx, c1, -1)
	require.NoError(t, nErr)

	// system post
	p1 := &model.Post{}
	p1.Type = "system_add_to_channel"
	p1.ChannelId = c1.Id
	p1.UserId = model.NewId()
	p1.Message = NewTestID()
	p1.CreateAt = twentyMinAgo
	p1.UpdateAt = twentyMinAgo
	_, nErr = ss.Post().Save(rctx, p1)
	require.NoError(t, nErr)

	p2 := &model.Post{}
	p2.ChannelId = c1.Id
	p2.UserId = model.NewId()
	p2.Message = NewTestID()
	p2.Hashtags = "hashtag"
	p2.CreateAt = twentyMinAgo
	p2.UpdateAt = twentyMinAgo
	p2, nErr = ss.Post().Save(rctx, p2)
	require.NoError(t, nErr)

	p3 := &model.Post{}
	p3.ChannelId = c1.Id
	p3.UserId = model.NewId()
	p3.Message = NewTestID()
	p3.FileIds = []string{"fileId1"}
	p3.CreateAt = twentyMinAgo
	p3.UpdateAt = twentyMinAgo
	_, nErr = ss.Post().Save(rctx, p3)
	require.NoError(t, nErr)

	p4 := &model.Post{}
	p4.ChannelId = c1.Id
	p4.UserId = model.NewId()
	p4.Message = NewTestID()
	p4.Filenames = []string{"filename1"}
	p4.CreateAt = tenMinAgo
	p4.UpdateAt = tenMinAgo
	p4, nErr = ss.Post().Save(rctx, p4)
	require.NoError(t, nErr)

	p5 := &model.Post{}
	p5.ChannelId = c1.Id
	p5.UserId = p4.UserId
	p5.Message = NewTestID()
	p5.Hashtags = "hashtag"
	p5.FileIds = []string{"fileId2"}
	p5.CreateAt = tenMinAgo
	p5.UpdateAt = tenMinAgo
	_, nErr = ss.Post().Save(rctx, p5)
	require.NoError(t, nErr)

	bot1 := &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     model.NewId(),
		UserId:      model.NewId(),
	}
	_, nErr = ss.Bot().Save(bot1)
	require.NoError(t, nErr)

	p6 := &model.Post{}
	p6.Message = "bot message one"
	p6.ChannelId = c1.Id
	p6.UserId = bot1.UserId
	p6.CreateAt = twentyMinAgo
	p6.UpdateAt = twentyMinAgo
	_, nErr = ss.Post().Save(rctx, p6)
	require.NoError(t, nErr)

	p7 := &model.Post{}
	p7.Message = "bot message two"
	p7.ChannelId = c1.Id
	p7.UserId = bot1.UserId
	p7.CreateAt = tenMinAgo
	p7.UpdateAt = tenMinAgo
	_, nErr = ss.Post().Save(rctx, p7)
	require.NoError(t, nErr)

	require.NoError(t, ss.Post().RefreshPostStats())

	// total across all teams
	c, err := ss.Post().AnalyticsPostCount(&model.PostCountOptions{})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, c, int64(7))

	// total for single team
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id})
	require.NoError(t, err)
	assert.Equal(t, int64(7), c)

	c, err = ss.Post().AnalyticsPostCountByTeam(t1.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(7), c)

	// with files
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, MustHaveFile: true})
	require.NoError(t, err)
	assert.Equal(t, int64(3), c)

	// with hashtags
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, MustHaveHashtag: true})
	require.NoError(t, err)
	assert.Equal(t, int64(2), c)

	// with hashtags and files
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, MustHaveFile: true, MustHaveHashtag: true})
	require.NoError(t, err)
	assert.Equal(t, int64(1), c)

	// excluding system posts
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, ExcludeSystemPosts: true})
	require.NoError(t, err)
	assert.Equal(t, int64(6), c)

	// before update_at time
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, SinceUpdateAt: fifteenMinAgo})
	require.NoError(t, err)
	assert.Equal(t, int64(3), c)

	// equal to update_at time
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, SinceUpdateAt: tenMinAgo})
	require.NoError(t, err)
	assert.Equal(t, int64(3), c)

	// since update_at and since post id
	tenMinAgoIDs := []string{p4.Id, p5.Id, p7.Id}
	sort.Strings(tenMinAgoIDs)
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, SinceUpdateAt: tenMinAgo, SincePostID: tenMinAgoIDs[0]})
	require.NoError(t, err)
	assert.Equal(t, int64(2), c)

	// delete 1 post
	err = ss.Post().Delete(rctx, p2.Id, 1, p2.UserId)
	require.NoError(t, err)

	// total for single team with the deleted post excluded
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, ExcludeDeleted: true})
	require.NoError(t, err)
	assert.Equal(t, int64(6), c)

	// total users only posts for single team with the deleted post excluded
	c, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, ExcludeDeleted: true, UsersPostsOnly: true})
	require.NoError(t, err)
	assert.Equal(t, int64(3), c)
}

func testPostStoreGetFlaggedPostsForTeam(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, err := ss.Channel().Save(rctx, c1, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	m0 := &model.ChannelMember{}
	m0.ChannelId = c1.Id
	m0.UserId = o1.UserId
	m0.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(rctx, m0)
	require.NoError(t, err)

	teamID := model.NewId()
	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o4 := &model.Post{}
	o4.ChannelId = channel2.Id
	o4.UserId = model.NewId()
	o4.Message = NewTestID()
	o4, err = ss.Post().Save(rctx, o4)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	c2 := &model.Channel{}
	c2.DisplayName = "DMChannel1"
	c2.Name = model.GetDMNameFromIds(NewTestID(), NewTestID())
	c2.Type = model.ChannelTypeDirect

	m1 := &model.ChannelMember{}
	m1.ChannelId = c2.Id
	m1.UserId = o1.UserId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := &model.ChannelMember{}
	m2.ChannelId = c2.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	c2, err = ss.Channel().SaveDirectChannel(rctx, c2, m1, m2)
	require.NoError(t, err)

	o5 := &model.Post{}
	o5.ChannelId = c2.Id
	o5.UserId = m2.UserId
	o5.Message = NewTestID()
	o5, err = ss.Post().Save(rctx, o5)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Post on channel where user is not a member
	channel3, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName3",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o6 := &model.Post{}
	o6.ChannelId = channel3.Id
	o6.UserId = m2.UserId
	o6.Message = NewTestID()
	o6, err = ss.Post().Save(rctx, o6)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	r1, err := ss.Post().GetFlaggedPosts(o1.ChannelId, 0, 2)
	require.NoError(t, err)

	require.Empty(t, r1.Order, "should be empty")

	preferences := model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o1.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(preferences)
	require.NoError(t, err)

	r2, err := ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)
	require.NoError(t, err)
	require.Len(t, r2.Order, 1, "should have 1 post")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o2.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(preferences)
	require.NoError(t, err)

	r3, err := ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 1)
	require.NoError(t, err)
	require.Len(t, r3.Order, 1, "should have 1 post")

	r3, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 1, 1)
	require.NoError(t, err)
	require.Len(t, r3.Order, 1, "should have 1 post")

	r3, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 1000, 10)
	require.NoError(t, err)
	require.Empty(t, r3.Order, "should be empty")

	r4, err := ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)
	require.NoError(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o3.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(preferences)
	require.NoError(t, err)

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)
	require.NoError(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o4.Id,
			Value:    "true",
		},
	}
	err = ss.Preference().Save(preferences)
	require.NoError(t, err)

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)
	require.NoError(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, model.NewId(), 0, 2)
	require.NoError(t, err)
	require.Empty(t, r4.Order, "should have 0 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o5.Id,
			Value:    "true",
		},
	}
	err = ss.Preference().Save(preferences)
	require.NoError(t, err)

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 10)
	require.NoError(t, err)
	require.Len(t, r4.Order, 3, "should have 3 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o6.Id,
			Value:    "true",
		},
	}
	err = ss.Preference().Save(preferences)
	require.NoError(t, err)

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 10)
	require.NoError(t, err)
	require.Len(t, r4.Order, 3, "should have 3 posts")

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMaster().Exec("TRUNCATE Channels")
}

func testPostStoreGetFlaggedPosts(t *testing.T, rctx request.CTX, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, err := ss.Channel().Save(rctx, c1, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Post on channel where user is not a member
	teamID := model.NewId()
	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o4 := &model.Post{}
	o4.ChannelId = channel2.Id
	o4.UserId = model.NewId()
	o4.Message = NewTestID()
	o4, err = ss.Post().Save(rctx, o4)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	m0 := &model.ChannelMember{}
	m0.ChannelId = o1.ChannelId
	m0.UserId = o1.UserId
	m0.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(rctx, m0)
	require.NoError(t, err)

	r1, err := ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.NoError(t, err)
	require.Empty(t, r1.Order, "should be empty")

	preferences := model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o1.Id,
			Value:    "true",
		},
	}

	nErr := ss.Preference().Save(preferences)
	require.NoError(t, nErr)

	r2, err := ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.NoError(t, err)
	require.Len(t, r2.Order, 1, "should have 1 post")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o2.Id,
			Value:    "true",
		},
	}

	nErr = ss.Preference().Save(preferences)
	require.NoError(t, nErr)

	r3, err := ss.Post().GetFlaggedPosts(o1.UserId, 0, 1)
	require.NoError(t, err)
	require.Len(t, r3.Order, 1, "should have 1 post")

	r3, err = ss.Post().GetFlaggedPosts(o1.UserId, 1, 1)
	require.NoError(t, err)
	require.Len(t, r3.Order, 1, "should have 1 post")

	r3, err = ss.Post().GetFlaggedPosts(o1.UserId, 1000, 10)
	require.NoError(t, err)
	require.Empty(t, r3.Order, "should be empty")

	r4, err := ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.NoError(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o3.Id,
			Value:    "true",
		},
	}

	nErr = ss.Preference().Save(preferences)
	require.NoError(t, nErr)

	r4, err = ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.NoError(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     o4.Id,
			Value:    "true",
		},
	}

	nErr = ss.Preference().Save(preferences)
	require.NoError(t, nErr)

	r4, err = ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.NoError(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")
}

func testPostStoreGetFlaggedPostsForChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, err := ss.Channel().Save(rctx, c1, -1)
	require.NoError(t, err)

	c2 := &model.Channel{}
	c2.TeamId = model.NewId()
	c2.DisplayName = "Channel2"
	c2.Name = NewTestID()
	c2.Type = model.ChannelTypeOpen
	c2, err = ss.Channel().Save(rctx, c2, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// deleted post
	teamID := model.NewId()
	channel3, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName3",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = channel3.Id
	o3.UserId = o1.ChannelId
	o3.Message = NewTestID()
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = c2.Id
	o4.UserId = model.NewId()
	o4.Message = NewTestID()
	o4, err = ss.Post().Save(rctx, o4)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Post on channel where user is not a member
	channel4, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName4",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o5 := &model.Post{}
	o5.ChannelId = channel4.Id
	o5.UserId = model.NewId()
	o5.Message = NewTestID()
	o5, err = ss.Post().Save(rctx, o5)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	m1 := &model.ChannelMember{}
	m1.ChannelId = o1.ChannelId
	m1.UserId = o1.UserId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(rctx, m1)
	require.NoError(t, err)

	m2 := &model.ChannelMember{}
	m2.ChannelId = o4.ChannelId
	m2.UserId = o1.UserId
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(rctx, m2)
	require.NoError(t, err)

	r, err := ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)
	require.NoError(t, err)
	require.Empty(t, r.Order, "should be empty")

	preference := model.Preference{
		UserId:   o1.UserId,
		Category: model.PreferenceCategoryFlaggedPost,
		Name:     o1.Id,
		Value:    "true",
	}

	nErr := ss.Preference().Save(model.Preferences{preference})
	require.NoError(t, nErr)

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)
	require.NoError(t, err)
	require.Len(t, r.Order, 1, "should have 1 post")

	preference.Name = o2.Id
	nErr = ss.Preference().Save(model.Preferences{preference})
	require.NoError(t, nErr)

	preference.Name = o3.Id
	nErr = ss.Preference().Save(model.Preferences{preference})
	require.NoError(t, nErr)

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 1)
	require.NoError(t, err)
	require.Len(t, r.Order, 1, "should have 1 post")

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 1, 1)
	require.NoError(t, err)
	require.Len(t, r.Order, 1, "should have 1 post")

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 1000, 10)
	require.NoError(t, err)
	require.Empty(t, r.Order, "should be empty")

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)
	require.NoError(t, err)
	require.Len(t, r.Order, 2, "should have 2 posts")

	preference.Name = o4.Id
	nErr = ss.Preference().Save(model.Preferences{preference})
	require.NoError(t, nErr)

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o4.ChannelId, 0, 10)
	require.NoError(t, err)
	require.Len(t, r.Order, 1, "should have 1 posts")

	preference.Name = o5.Id
	nErr = ss.Preference().Save(model.Preferences{preference})
	require.NoError(t, nErr)

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o5.ChannelId, 0, 10)
	require.NoError(t, err)
	require.Len(t, r.Order, 0, "should have 0 posts")
}

func testPostStoreGetPostsCreatedAt(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	createTime := model.GetMillis() + 1

	o0 := &model.Post{}
	o0.ChannelId = channel1.Id
	o0.UserId = model.NewId()
	o0.Message = NewTestID()
	o0.CreateAt = createTime
	o0, err = ss.Post().Save(rctx, o0)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = o0.ChannelId
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1.CreateAt = createTime
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.RootId = o1.Id
	o2.CreateAt = createTime + 1
	_, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = channel2.Id
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3.CreateAt = createTime
	_, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	r1, _ := ss.Post().GetPostsCreatedAt(o1.ChannelId, createTime)
	assert.Equal(t, 2, len(r1))
}

func testPostStoreOverwriteMultiple(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o4, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel2.Id,
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})
	require.NoError(t, err)

	channel3, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName3",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	o5, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel3.Id,
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test2", "test3"},
	})
	require.NoError(t, err)

	r1, err := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro1 := r1.Posts[o1.Id]

	r2, err := ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro2 := r2.Posts[o2.Id]

	r3, err := ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro3 := r3.Posts[o3.Id]

	r4, err := ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro4 := r4.Posts[o4.Id]

	r5, err := ss.Post().Get(context.Background(), o5.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro5 := r5.Posts[o5.Id]

	require.Equal(t, ro1.Message, o1.Message, "Failed to save/get")
	require.Equal(t, ro2.Message, o2.Message, "Failed to save/get")
	require.Equal(t, ro3.Message, o3.Message, "Failed to save/get")
	require.Equal(t, ro4.Message, o4.Message, "Failed to save/get")
	require.Equal(t, ro4.Filenames, o4.Filenames, "Failed to save/get")
	require.Equal(t, ro5.Message, o5.Message, "Failed to save/get")
	require.Equal(t, ro5.Filenames, o5.Filenames, "Failed to save/get")

	t.Run("overwrite changing message", func(t *testing.T) {
		o1a := ro1.Clone()
		o1a.Message = ro1.Message + "BBBBBBBBBB"

		o2a := ro2.Clone()
		o2a.Message = ro2.Message + "DDDDDDD"

		o3a := ro3.Clone()
		o3a.Message = ro3.Message + "WWWWWWW"

		_, errIdx, err := ss.Post().OverwriteMultiple(rctx, []*model.Post{o1a, o2a, o3a})
		require.NoError(t, err)
		require.Equal(t, -1, errIdx)

		r1, nErr := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, nErr)
		ro1a := r1.Posts[o1.Id]

		r2, nErr = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, nErr)
		ro2a := r2.Posts[o2.Id]

		r3, nErr = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, nErr)
		ro3a := r3.Posts[o3.Id]

		assert.Equal(t, ro1a.Message, o1a.Message, "Failed to overwrite/get")
		assert.Equal(t, ro2a.Message, o2a.Message, "Failed to overwrite/get")
		assert.Equal(t, ro3a.Message, o3a.Message, "Failed to overwrite/get")
	})

	t.Run("overwrite clearing filenames", func(t *testing.T) {
		o4a := ro4.Clone()
		o4a.Filenames = []string{}
		o4a.FileIds = []string{model.NewId()}

		o5a := ro5.Clone()
		o5a.Filenames = []string{}
		o5a.FileIds = []string{}

		_, errIdx, err := ss.Post().OverwriteMultiple(rctx, []*model.Post{o4a, o5a})
		require.NoError(t, err)
		require.Equal(t, -1, errIdx)

		r4, nErr := ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, nErr)
		ro4a := r4.Posts[o4.Id]

		r5, nErr = ss.Post().Get(context.Background(), o5.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, nErr)
		ro5a := r5.Posts[o5.Id]

		require.Empty(t, ro4a.Filenames, "Failed to clear Filenames")
		require.Len(t, ro4a.FileIds, 1, "Failed to set FileIds")
		require.Empty(t, ro5a.Filenames, "Failed to clear Filenames")
		require.Empty(t, ro5a.FileIds, "Failed to set FileIds")
	})
}

func testPostStoreOverwrite(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	o4, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel2.Id,
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})
	require.NoError(t, err)

	r1, err := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro1 := r1.Posts[o1.Id]

	r2, err := ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro2 := r2.Posts[o2.Id]

	r3, err := ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro3 := r3.Posts[o3.Id]

	r4, err := ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro4 := r4.Posts[o4.Id]

	require.Equal(t, ro1.Message, o1.Message, "Failed to save/get")
	require.Equal(t, ro2.Message, o2.Message, "Failed to save/get")
	require.Equal(t, ro3.Message, o3.Message, "Failed to save/get")
	require.Equal(t, ro4.Message, o4.Message, "Failed to save/get")

	t.Run("overwrite changing message", func(t *testing.T) {
		o1a := ro1.Clone()
		o1a.Message = ro1.Message + "BBBBBBBBBB"
		_, err = ss.Post().Overwrite(rctx, o1a)
		require.NoError(t, err)

		o2a := ro2.Clone()
		o2a.Message = ro2.Message + "DDDDDDD"
		_, err = ss.Post().Overwrite(rctx, o2a)
		require.NoError(t, err)

		o3a := ro3.Clone()
		o3a.Message = ro3.Message + "WWWWWWW"
		_, err = ss.Post().Overwrite(rctx, o3a)
		require.NoError(t, err)

		r1, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)
		ro1a := r1.Posts[o1.Id]

		r2, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)
		ro2a := r2.Posts[o2.Id]

		r3, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)
		ro3a := r3.Posts[o3.Id]

		assert.Equal(t, ro1a.Message, o1a.Message, "Failed to overwrite/get")
		assert.Equal(t, ro2a.Message, o2a.Message, "Failed to overwrite/get")
		assert.Equal(t, ro3a.Message, o3a.Message, "Failed to overwrite/get")
	})

	t.Run("overwrite clearing filenames", func(t *testing.T) {
		o4a := ro4.Clone()
		o4a.Filenames = []string{}
		o4a.FileIds = []string{model.NewId()}
		_, err = ss.Post().Overwrite(rctx, o4a)
		require.NoError(t, err)

		r4, err = ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)

		ro4a := r4.Posts[o4.Id]
		require.Empty(t, ro4a.Filenames, "Failed to clear Filenames")
		require.Len(t, ro4a.FileIds, 1, "Failed to set FileIds")
	})
}

func testPostStoreGetPostsByIds(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	r1, err := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro1 := r1.Posts[o1.Id]

	r2, err := ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro2 := r2.Posts[o2.Id]

	r3, err := ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro3 := r3.Posts[o3.Id]

	postIds := []string{
		ro1.Id,
		ro2.Id,
		ro3.Id,
	}

	posts, err := ss.Post().GetPostsByIds(postIds)
	require.NoError(t, err)
	require.Len(t, posts, 3, "Expected 3 posts in results. Got %v", len(posts))

	err = ss.Post().Delete(rctx, ro1.Id, model.GetMillis(), "")
	require.NoError(t, err)

	posts, err = ss.Post().GetPostsByIds(postIds)
	require.NoError(t, err)
	require.Len(t, posts, 3, "Expected 3 posts in results. Got %v", len(posts))
}

func testPostStoreGetPostsBatchForIndexing(t *testing.T, rctx request.CTX, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, _ = ss.Channel().Save(rctx, c1, -1)

	c2 := &model.Channel{}
	c2.TeamId = model.NewId()
	c2.DisplayName = "Channel2"
	c2.Name = NewTestID()
	c2.Type = model.ChannelTypeOpen
	c2, _ = ss.Channel().Save(rctx, c2, -1)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1, err := ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = c2.Id
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	_, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = c1.Id
	o3.UserId = model.NewId()
	o3.RootId = o1.Id
	o3.Message = NewTestID()
	_, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	// Getting all
	r, err := ss.Post().GetPostsBatchForIndexing(o1.CreateAt-1, "", 100)
	require.NoError(t, err)
	require.Len(t, r, 3, "Expected 3 posts in results. Got %v", len(r))

	// Testing pagination
	r, err = ss.Post().GetPostsBatchForIndexing(o1.CreateAt-1, "", 1)
	require.NoError(t, err)
	require.Len(t, r, 1, "Expected 1 post in results. Got %v", len(r))

	r, err = ss.Post().GetPostsBatchForIndexing(r[0].CreateAt, r[0].Id, 1)
	require.NoError(t, err)
	require.Len(t, r, 1, "Expected 1 post in results. Got %v", len(r))

	r, err = ss.Post().GetPostsBatchForIndexing(r[0].CreateAt, r[0].Id, 1)
	require.NoError(t, err)
	require.Len(t, r, 1, "Expected 1 post in results. Got %v", len(r))

	r, err = ss.Post().GetPostsBatchForIndexing(r[0].CreateAt, r[0].Id, 1)
	require.NoError(t, err)
	require.Len(t, r, 0, "Expected 0 post in results. Got %v", len(r))
}

func testPostStorePermanentDeleteBatch(t *testing.T, rctx request.CTX, ss store.Store) {
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1.CreateAt = 1000
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = channel.Id
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.CreateAt = 1000
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = channel.Id
	o3.UserId = model.NewId()
	o3.Message = NewTestID()
	o3.CreateAt = 100000
	o3, err = ss.Post().Save(rctx, o3)
	require.NoError(t, err)

	deleted, _, err := ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2000, 1000, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	require.Equal(t, int64(2), deleted)

	_, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Should have not found post 1 after purge")

	_, err = ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Should have not found post 2 after purge")

	_, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err, "Should have found post 3 after purge")

	rows, err := ss.RetentionPolicy().GetIdsForDeletionByTableName("Posts", 1000)
	require.NoError(t, err)
	require.Equal(t, 1, len(rows))
	require.Equal(t, 2, len(rows[0].Ids))
	// Clean up retention ids table
	deleted, err = ss.Reaction().DeleteOrphanedRowsByIds(rows[0])
	require.NoError(t, err)
	require.Equal(t, int64(0), deleted)

	t.Run("with pagination", func(t *testing.T) {
		for i := 0; i < 3; i++ {
			_, err = ss.Post().Save(rctx, &model.Post{
				ChannelId: channel.Id,
				UserId:    model.NewId(),
				Message:   "message",
				CreateAt:  1,
			})
			require.NoError(t, err)
		}
		cursor := model.RetentionPolicyCursor{}

		deleted, cursor, err = ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2, 2, cursor)
		require.NoError(t, err)
		require.Equal(t, int64(2), deleted)

		rows, err = ss.RetentionPolicy().GetIdsForDeletionByTableName("Posts", 1000)
		require.NoError(t, err)
		require.Equal(t, 1, len(rows))
		require.Equal(t, 2, len(rows[0].Ids))

		// Clean up retention ids table
		deleted, err = ss.Reaction().DeleteOrphanedRowsByIds(rows[0])
		require.NoError(t, err)
		require.Equal(t, int64(0), deleted)

		deleted, _, err = ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2, 2, cursor)
		require.NoError(t, err)
		require.Equal(t, int64(1), deleted)

		rows, err = ss.RetentionPolicy().GetIdsForDeletionByTableName("Posts", 1000)
		require.NoError(t, err)
		require.Equal(t, 1, len(rows))
		require.Equal(t, 1, len(rows[0].Ids))

		// Clean up retention ids table
		deleted, err = ss.Reaction().DeleteOrphanedRowsByIds(rows[0])
		require.NoError(t, err)
		require.Equal(t, int64(0), deleted)
	})

	t.Run("with data retention policies", func(t *testing.T) {
		channelPolicy, err2 := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "DisplayName",
				PostDurationDays: model.NewPointer(int64(30)),
			},
			ChannelIDs: []string{channel.Id},
		})
		require.NoError(t, err2)
		post := &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   "message",
			CreateAt:  1,
		}
		post, err2 = ss.Post().Save(rctx, post)
		require.NoError(t, err2)

		_, _, err2 = ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2000, 1000, model.RetentionPolicyCursor{})
		require.NoError(t, err2)
		_, err2 = ss.Post().Get(context.Background(), post.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err2, "global policy should have been ignored due to granular policy")

		nowMillis := post.CreateAt + *channelPolicy.PostDurationDays*model.DayInMilliseconds + 1
		_, _, err2 = ss.Post().PermanentDeleteBatchForRetentionPolicies(nowMillis, 0, 1000, model.RetentionPolicyCursor{})
		require.NoError(t, err2)
		_, err2 = ss.Post().Get(context.Background(), post.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.Error(t, err2, "post should have been deleted by channel policy")

		// Create a team policy which is stricter than the channel policy
		teamPolicy, err2 := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "DisplayName",
				PostDurationDays: model.NewPointer(int64(20)),
			},
			TeamIDs: []string{team.Id},
		})
		require.NoError(t, err2)
		post.Id = ""
		post, err2 = ss.Post().Save(rctx, post)
		require.NoError(t, err2)

		nowMillis = post.CreateAt + *teamPolicy.PostDurationDays*model.DayInMilliseconds + 1
		_, _, err2 = ss.Post().PermanentDeleteBatchForRetentionPolicies(nowMillis, 0, 1000, model.RetentionPolicyCursor{})
		require.NoError(t, err2)
		_, err2 = ss.Post().Get(context.Background(), post.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err2, "channel policy should have overridden team policy")

		// Delete channel policy and re-run team policy
		err2 = ss.RetentionPolicy().RemoveChannels(channelPolicy.ID, []string{channel.Id})
		require.NoError(t, err2)

		err2 = ss.RetentionPolicy().Delete(channelPolicy.ID)
		require.NoError(t, err2)

		_, _, err2 = ss.Post().PermanentDeleteBatchForRetentionPolicies(nowMillis, 0, 1000, model.RetentionPolicyCursor{})
		require.NoError(t, err2)
		_, err2 = ss.Post().Get(context.Background(), post.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.Error(t, err2, "post should have been deleted by team policy")

		err2 = ss.RetentionPolicy().RemoveTeams(teamPolicy.ID, []string{team.Id})
		require.NoError(t, err2)

		err2 = ss.RetentionPolicy().Delete(teamPolicy.ID)
		require.NoError(t, err2)

		// Clean up retention ids table
		rows, err = ss.RetentionPolicy().GetIdsForDeletionByTableName("Posts", 1000)
		require.NoError(t, err)
		for _, row := range rows {
			deleted, err = ss.Reaction().DeleteOrphanedRowsByIds(row)
			require.NoError(t, err)
			require.Equal(t, int64(0), deleted)
		}
	})

	t.Run("with channel, team and global policies", func(t *testing.T) {
		c1 := &model.Channel{}
		c1.TeamId = model.NewId()
		c1.DisplayName = "Channel1"
		c1.Name = NewTestID()
		c1.Type = model.ChannelTypeOpen
		c1, _ = ss.Channel().Save(rctx, c1, -1)

		c2 := &model.Channel{}
		c2.TeamId = model.NewId()
		c2.DisplayName = "Channel2"
		c2.Name = NewTestID()
		c2.Type = model.ChannelTypeOpen
		c2, _ = ss.Channel().Save(rctx, c2, -1)

		channelPolicy, err2 := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "DisplayName",
				PostDurationDays: model.NewPointer(int64(30)),
			},
			ChannelIDs: []string{c1.Id},
		})
		require.NoError(t, err2)
		defer ss.RetentionPolicy().Delete(channelPolicy.ID)
		teamPolicy, err2 := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "DisplayName",
				PostDurationDays: model.NewPointer(int64(30)),
			},
			TeamIDs: []string{team.Id},
		})
		require.NoError(t, err2)
		defer ss.RetentionPolicy().Delete(teamPolicy.ID)

		// This one should be deleted by the channel policy
		_, err2 = ss.Post().Save(rctx, &model.Post{
			ChannelId: c1.Id,
			UserId:    model.NewId(),
			Message:   "message",
			CreateAt:  1,
		})
		require.NoError(t, err2)
		// This one, by the team policy
		_, err2 = ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   "message",
			CreateAt:  1,
		})
		require.NoError(t, err2)
		// This one, by the global policy
		_, err2 = ss.Post().Save(rctx, &model.Post{
			ChannelId: c2.Id,
			UserId:    model.NewId(),
			Message:   "message",
			CreateAt:  1,
		})
		require.NoError(t, err2)

		nowMillis := int64(1 + 30*model.DayInMilliseconds + 1)
		deleted, _, err2 := ss.Post().PermanentDeleteBatchForRetentionPolicies(nowMillis, 2, 1000, model.RetentionPolicyCursor{})
		require.NoError(t, err2)
		require.Equal(t, int64(3), deleted)

		rows, err = ss.RetentionPolicy().GetIdsForDeletionByTableName("Posts", 1000)
		require.NoError(t, err)
		// Each policy would generate it's own row
		require.Equal(t, 3, len(rows))

		// Clean up retention ids table
		for _, row := range rows {
			deleted, err = ss.Reaction().DeleteOrphanedRowsByIds(row)
			require.NoError(t, err)
			require.Equal(t, int64(0), deleted)
		}
	})
}

func testPostStoreGetOldest(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o0 := &model.Post{}
	o0.ChannelId = channel1.Id
	o0.UserId = model.NewId()
	o0.Message = NewTestID()
	o0.CreateAt = 3
	o0, err = ss.Post().Save(rctx, o0)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = o0.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestID()
	o1.CreateAt = 2
	o1, err = ss.Post().Save(rctx, o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestID()
	o2.CreateAt = 1
	o2, err = ss.Post().Save(rctx, o2)
	require.NoError(t, err)

	r1, err := ss.Post().GetOldest()

	require.NoError(t, err)
	assert.EqualValues(t, o2.Id, r1.Id)
}

func testGetMaxPostSize(t *testing.T, _ request.CTX, ss store.Store) {
	assert.Equal(t, model.PostMessageMaxRunesV2, ss.Post().GetMaxPostSize())
}

func testPostStoreGetParentsForExportAfter(t *testing.T, rctx request.CTX, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = NewTestID()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	_, err := ss.Team().Save(&t1)
	require.NoError(t, err)

	c1 := model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel1"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	_, nErr := ss.Channel().Save(rctx, &c1, -1)
	require.NoError(t, nErr)

	c2 := model.Channel{}
	c2.TeamId = t1.Id
	c2.DisplayName = "Channel2"
	c2.Name = NewTestID()
	c2.Type = model.ChannelTypeOpen
	_, nErr = ss.Channel().Save(rctx, &c2, -1)
	require.NoError(t, nErr)

	u1 := model.User{}
	u1.Username = model.NewUsername()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err = ss.User().Save(rctx, &u1)
	require.NoError(t, err)

	p1 := &model.Post{}
	p1.ChannelId = c1.Id
	p1.UserId = u1.Id
	p1.Message = NewTestID()
	p1.CreateAt = 1000
	p1, nErr = ss.Post().Save(rctx, p1)
	require.NoError(t, nErr)

	p2 := &model.Post{}
	p2.ChannelId = c2.Id
	p2.UserId = u1.Id
	p2.Message = NewTestID()
	p2.CreateAt = 1000
	p2, nErr = ss.Post().Save(rctx, p2)
	require.NoError(t, nErr)
	nErr = ss.Channel().Delete(c2.Id, model.GetMillis())
	require.NoError(t, nErr)

	t.Run("without archived channels", func(t *testing.T) {
		posts, err := ss.Post().GetParentsForExportAfter(10000, strings.Repeat("0", 26), false)
		assert.NoError(t, err)

		found := false
		foundArchived := false
		for _, p := range posts {
			if p.Id == p1.Id {
				found = true
				assert.Equal(t, p.Id, p1.Id)
				assert.Equal(t, p.Message, p1.Message)
				assert.Equal(t, p.Username, u1.Username)
				assert.Equal(t, p.TeamName, t1.Name)
				assert.Equal(t, p.ChannelName, c1.Name)
			}
			if p.Id == p2.Id {
				foundArchived = true
			}
		}
		assert.True(t, found)
		assert.False(t, foundArchived, "posts from archived channel should not be returned")
	})

	t.Run("with archived channels", func(t *testing.T) {
		posts, err := ss.Post().GetParentsForExportAfter(10000, strings.Repeat("0", 26), true)
		assert.NoError(t, err)

		found := false
		for _, p := range posts {
			if p.Id == p2.Id {
				found = true
				assert.Equal(t, p.Id, p2.Id)
				assert.Equal(t, p.Message, p2.Message)
				assert.Equal(t, p.Username, u1.Username)
				assert.Equal(t, p.TeamName, t1.Name)
				assert.Equal(t, p.ChannelName, c2.Name)
			}
		}
		assert.True(t, found)
	})

	t.Run("with flagged post", func(t *testing.T) {
		err := ss.Preference().Save(model.Preferences([]model.Preference{
			{
				UserId:   u1.Id,
				Category: model.PreferenceCategoryFlaggedPost,
				Name:     p1.Id,
				Value:    "true",
			},
		}))
		require.NoError(t, err)

		posts, err := ss.Post().GetParentsForExportAfter(10000, strings.Repeat("0", 26), false)
		assert.NoError(t, err)

		for _, p := range posts {
			if p.Id == p1.Id {
				require.NotNil(t, p.FlaggedBy)
				assert.Equal(t, model.StringArray([]string{u1.Username}), p.FlaggedBy)
			}
		}
	})
}

func testPostStoreGetRepliesForExport(t *testing.T, rctx request.CTX, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = NewTestID()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	_, err := ss.Team().Save(&t1)
	require.NoError(t, err)

	c1 := model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel1"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	_, nErr := ss.Channel().Save(rctx, &c1, -1)
	require.NoError(t, nErr)

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err = ss.User().Save(rctx, &u1)
	require.NoError(t, err)

	p1 := &model.Post{}
	p1.ChannelId = c1.Id
	p1.UserId = u1.Id
	p1.Message = NewTestID()
	p1.CreateAt = 1000
	p1, nErr = ss.Post().Save(rctx, p1)
	require.NoError(t, nErr)

	p2 := &model.Post{}
	p2.ChannelId = c1.Id
	p2.UserId = u1.Id
	p2.Message = NewTestID()
	p2.CreateAt = 1001
	p2.RootId = p1.Id
	p2, nErr = ss.Post().Save(rctx, p2)
	require.NoError(t, nErr)

	r1, err := ss.Post().GetRepliesForExport(p1.Id)
	assert.NoError(t, err)

	require.Len(t, r1, 1)

	reply1 := r1[0]
	assert.Equal(t, reply1.Id, p2.Id)
	assert.Equal(t, reply1.Message, p2.Message)
	assert.Equal(t, reply1.Username, u1.Username)

	// Checking whether replies by deleted user are exported
	u1.DeleteAt = 1002
	_, err = ss.User().Update(rctx, &u1, false)
	require.NoError(t, err)

	r1, err = ss.Post().GetRepliesForExport(p1.Id)
	assert.NoError(t, err)

	require.Len(t, r1, 1)

	reply1 = r1[0]
	assert.Equal(t, reply1.Id, p2.Id)
	assert.Equal(t, reply1.Message, p2.Message)
	assert.Equal(t, reply1.Username, u1.Username)
}

func testPostStoreGetDirectPostParentsForExportAfter(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamID
	o1.DisplayName = "Name"
	o1.Name = model.GetDMNameFromIds(NewTestID(), NewTestID())
	o1.Type = model.ChannelTypeDirect

	u1 := &model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(rctx, u1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	_, err = ss.User().Save(rctx, u2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	ss.Channel().SaveDirectChannel(rctx, &o1, &m1, &m2)

	p1 := &model.Post{}
	p1.ChannelId = o1.Id
	p1.UserId = u1.Id
	p1.Message = NewTestID()
	p1.CreateAt = 1000
	p1, nErr = ss.Post().Save(rctx, p1)
	require.NoError(t, nErr)

	r1, nErr := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26), false)
	assert.NoError(t, nErr)

	assert.Equal(t, p1.Message, r1[0].Message)

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMaster().Exec("TRUNCATE Channels")
}

func testPostStoreGetDirectPostParentsForExportAfterDeleted(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamID
	o1.DisplayName = "Name"
	o1.Name = model.GetDMNameFromIds(NewTestID(), NewTestID())
	o1.Type = model.ChannelTypeDirect

	u1 := &model.User{}
	u1.DeleteAt = 1
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(rctx, u1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2 := &model.User{}
	u2.DeleteAt = 1
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	_, err = ss.User().Save(rctx, u2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	ss.Channel().SaveDirectChannel(rctx, &o1, &m1, &m2)

	o1.DeleteAt = 1
	nErr = ss.Channel().SetDeleteAt(o1.Id, 1, 1)
	assert.NoError(t, nErr)

	p1 := &model.Post{}
	p1.ChannelId = o1.Id
	p1.UserId = u1.Id
	p1.Message = NewTestID()
	p1.CreateAt = 1000
	_, nErr = ss.Post().Save(rctx, p1)
	require.NoError(t, nErr)

	r1, nErr := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26), false)
	assert.NoError(t, nErr)
	assert.Equal(t, 0, len(r1))

	r1, nErr = ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26), true)
	assert.NoError(t, nErr)
	assert.Equal(t, 1, len(r1))

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMaster().Exec("TRUNCATE Channels")
}

func testPostStoreGetDirectPostParentsForExportAfterBatched(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamID
	o1.DisplayName = "Name"
	o1.Name = model.GetDMNameFromIds(NewTestID(), NewTestID())
	o1.Type = model.ChannelTypeDirect

	var postIds []string
	for i := 0; i < 150; i++ {
		u1 := &model.User{}
		u1.Email = MakeEmail()
		u1.Nickname = model.NewId()
		_, err := ss.User().Save(rctx, u1)
		require.NoError(t, err)
		_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
		require.NoError(t, nErr)

		u2 := &model.User{}
		u2.Email = MakeEmail()
		u2.Nickname = model.NewId()
		_, err = ss.User().Save(rctx, u2)
		require.NoError(t, err)
		_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
		require.NoError(t, nErr)

		m1 := model.ChannelMember{}
		m1.ChannelId = o1.Id
		m1.UserId = u1.Id
		m1.NotifyProps = model.GetDefaultChannelNotifyProps()

		m2 := model.ChannelMember{}
		m2.ChannelId = o1.Id
		m2.UserId = u2.Id
		m2.NotifyProps = model.GetDefaultChannelNotifyProps()

		ss.Channel().SaveDirectChannel(rctx, &o1, &m1, &m2)

		p1 := &model.Post{}
		p1.ChannelId = o1.Id
		p1.UserId = u1.Id
		p1.Message = NewTestID()
		p1.CreateAt = 1000
		p1, nErr = ss.Post().Save(rctx, p1)
		require.NoError(t, nErr)
		postIds = append(postIds, p1.Id)
	}
	sort.Slice(postIds, func(i, j int) bool { return postIds[i] < postIds[j] })

	// Get all posts
	r1, err := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26), false)
	assert.NoError(t, err)
	assert.Equal(t, len(postIds), len(r1))
	var exportedPostIds []string
	for i := range r1 {
		exportedPostIds = append(exportedPostIds, r1[i].Id)
	}
	sort.Slice(exportedPostIds, func(i, j int) bool { return exportedPostIds[i] < exportedPostIds[j] })
	assert.ElementsMatch(t, postIds, exportedPostIds)

	// Get 100
	r1, err = ss.Post().GetDirectPostParentsForExportAfter(100, strings.Repeat("0", 26), false)
	assert.NoError(t, err)
	assert.Equal(t, 100, len(r1))
	exportedPostIds = []string{}
	for i := range r1 {
		exportedPostIds = append(exportedPostIds, r1[i].Id)
	}
	sort.Slice(exportedPostIds, func(i, j int) bool { return exportedPostIds[i] < exportedPostIds[j] })
	assert.ElementsMatch(t, postIds[:100], exportedPostIds)

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMaster().Exec("TRUNCATE Channels")
}

func testHasAutoResponsePostByUserSince(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should return posts created after the given time", func(t *testing.T) {
		teamID := model.NewId()
		channel1, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channelID := channel1.Id
		userID := model.NewId()

		_, err = ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		// We need to sleep because SendAutoResponseIfNecessary
		// runs in a goroutine.
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channelID,
			UserId:    userID,
			Message:   "auto response message",
			Type:      model.PostTypeAutoResponder,
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		exists, err := ss.Post().HasAutoResponsePostByUserSince(model.GetPostsSinceOptions{ChannelId: channelID, Time: post2.CreateAt}, userID)
		require.NoError(t, err)
		assert.True(t, exists)

		err = ss.Post().Delete(rctx, post3.Id, time.Now().Unix(), userID)
		require.NoError(t, err)

		exists, err = ss.Post().HasAutoResponsePostByUserSince(model.GetPostsSinceOptions{ChannelId: channelID, Time: post2.CreateAt}, userID)
		require.NoError(t, err)
		assert.False(t, exists)
	})
}

func testGetPostsSinceUpdateForSync(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	// create some posts.
	channelID := model.NewId()
	remoteID := model.NewPointer(model.NewId())
	first := model.GetMillis()

	data := []*model.Post{
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 0"},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 1"},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 2"},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 3", RemoteId: remoteID},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 4", RemoteId: remoteID},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 5", RemoteId: remoteID},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 6", RemoteId: remoteID},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 7"},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 8", DeleteAt: model.GetMillis()},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 9", DeleteAt: model.GetMillis()},
	}

	for i, p := range data {
		p.UpdateAt = first + (int64(i) * 300000)
		if p.RemoteId == nil {
			p.RemoteId = model.NewPointer(model.NewId())
		}
		_, err := ss.Post().Save(rctx, p)
		require.NoError(t, err, "couldn't save post")
	}

	t.Run("Invalid channel id", func(t *testing.T) {
		opt := model.GetPostsSinceForSyncOptions{
			ChannelId: model.NewId(),
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts, cursorOut, err := ss.Post().GetPostsSinceForSync(opt, cursor, 100)
		require.NoError(t, err)
		require.Empty(t, posts, "should return zero posts")
		require.Equal(t, cursor, cursorOut)
	})

	t.Run("Get by channel, exclude remotes, exclude deleted", func(t *testing.T) {
		opt := model.GetPostsSinceForSyncOptions{
			ChannelId:       channelID,
			ExcludeRemoteId: *remoteID,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts, _, err := ss.Post().GetPostsSinceForSync(opt, cursor, 100)
		require.NoError(t, err)

		require.ElementsMatch(t, getPostIds(data[0:3], data[7]), getPostIds(posts))
	})

	t.Run("Include deleted", func(t *testing.T) {
		opt := model.GetPostsSinceForSyncOptions{
			ChannelId:      channelID,
			IncludeDeleted: true,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts, _, err := ss.Post().GetPostsSinceForSync(opt, cursor, 100)
		require.NoError(t, err)

		require.ElementsMatch(t, getPostIds(data), getPostIds(posts))
	})

	t.Run("Limit and cursor", func(t *testing.T) {
		opt := model.GetPostsSinceForSyncOptions{
			ChannelId: channelID,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts1, cursor, err := ss.Post().GetPostsSinceForSync(opt, cursor, 5)
		require.NoError(t, err)
		require.Len(t, posts1, 5, "should get 5 posts")

		posts2, _, err := ss.Post().GetPostsSinceForSync(opt, cursor, 5)
		require.NoError(t, err)
		require.Len(t, posts2, 3, "should get 3 posts")

		require.ElementsMatch(t, getPostIds(data[0:8]), getPostIds(posts1, posts2...))
	})

	t.Run("UpdateAt collisions", func(t *testing.T) {
		// this test requires all the UpdateAt timestamps to be the same.
		result, err := s.GetMaster().Exec("UPDATE Posts SET UpdateAt = ?", model.GetMillis())
		require.NoError(t, err)
		rows, err := result.RowsAffected()
		require.NoError(t, err)
		require.Greater(t, rows, int64(0))

		opt := model.GetPostsSinceForSyncOptions{
			ChannelId: channelID,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts1, cursor, err := ss.Post().GetPostsSinceForSync(opt, cursor, 5)
		require.NoError(t, err)
		require.Len(t, posts1, 5, "should get 5 posts")

		posts2, _, err := ss.Post().GetPostsSinceForSync(opt, cursor, 5)
		require.NoError(t, err)
		require.Len(t, posts2, 3, "should get 3 posts")

		require.ElementsMatch(t, getPostIds(data[0:8]), getPostIds(posts1, posts2...))
	})
}

func testGetPostsSinceCreateForSync(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	// create some posts.
	channelID := model.NewId()
	remoteID := model.NewPointer(model.NewId())
	first := model.GetMillis()

	data := []*model.Post{
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 0"},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 1"},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 2"},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 3", RemoteId: remoteID},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 4", RemoteId: remoteID},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 5", RemoteId: remoteID},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 6", RemoteId: remoteID},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 7"},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 8", DeleteAt: model.GetMillis()},
		{Id: model.NewId(), ChannelId: channelID, UserId: model.NewId(), Message: "test post 9", DeleteAt: model.GetMillis()},
	}

	for i, p := range data {
		p.CreateAt = first + (int64(i) * 300000)
		if p.RemoteId == nil {
			p.RemoteId = model.NewPointer(model.NewId())
		}
		_, err := ss.Post().Save(rctx, p)
		require.NoError(t, err, "couldn't save post")
	}

	t.Run("Invalid channel id", func(t *testing.T) {
		opt := model.GetPostsSinceForSyncOptions{
			ChannelId:     model.NewId(),
			SinceCreateAt: true,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts, cursorOut, err := ss.Post().GetPostsSinceForSync(opt, cursor, 100)
		require.NoError(t, err)
		require.Empty(t, posts, "should return zero posts")
		require.Equal(t, cursor, cursorOut)
	})

	t.Run("Get by channel, exclude remotes, exclude deleted", func(t *testing.T) {
		opt := model.GetPostsSinceForSyncOptions{
			ChannelId:       channelID,
			ExcludeRemoteId: *remoteID,
			SinceCreateAt:   true,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts, _, err := ss.Post().GetPostsSinceForSync(opt, cursor, 100)
		require.NoError(t, err)

		require.ElementsMatch(t, getPostIds(data[0:3], data[7]), getPostIds(posts))
	})

	t.Run("Include deleted", func(t *testing.T) {
		opt := model.GetPostsSinceForSyncOptions{
			ChannelId:      channelID,
			IncludeDeleted: true,
			SinceCreateAt:  true,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts, _, err := ss.Post().GetPostsSinceForSync(opt, cursor, 100)
		require.NoError(t, err)

		require.ElementsMatch(t, getPostIds(data), getPostIds(posts))
	})

	t.Run("Limit and cursor", func(t *testing.T) {
		opt := model.GetPostsSinceForSyncOptions{
			ChannelId:     channelID,
			SinceCreateAt: true,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts1, cursor, err := ss.Post().GetPostsSinceForSync(opt, cursor, 5)
		require.NoError(t, err)
		require.Len(t, posts1, 5, "should get 5 posts")

		posts2, _, err := ss.Post().GetPostsSinceForSync(opt, cursor, 5)
		require.NoError(t, err)
		require.Len(t, posts2, 3, "should get 3 posts")

		require.ElementsMatch(t, getPostIds(data[0:8]), getPostIds(posts1, posts2...))
	})

	t.Run("CreateAt collisions", func(t *testing.T) {
		// this test requires all the CreateAt timestamps to be the same.
		result, err := s.GetMaster().Exec("UPDATE Posts SET CreateAt = ?", model.GetMillis())
		require.NoError(t, err)
		rows, err := result.RowsAffected()
		require.NoError(t, err)
		require.Greater(t, rows, int64(0))

		opt := model.GetPostsSinceForSyncOptions{
			ChannelId: channelID,
		}
		cursor := model.GetPostsSinceForSyncCursor{}
		posts1, cursor, err := ss.Post().GetPostsSinceForSync(opt, cursor, 5)
		require.NoError(t, err)
		require.Len(t, posts1, 5, "should get 5 posts")

		posts2, _, err := ss.Post().GetPostsSinceForSync(opt, cursor, 5)
		require.NoError(t, err)
		require.Len(t, posts2, 3, "should get 3 posts")

		require.ElementsMatch(t, getPostIds(data[0:8]), getPostIds(posts1, posts2...))
	})
}

func testSetPostReminder(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	// Basic
	userID := NewTestID()

	p1 := &model.Post{
		UserId:    userID,
		ChannelId: NewTestID(),
		Message:   "hi there",
		Type:      model.PostTypeDefault,
	}
	p1, err := ss.Post().Save(rctx, p1)
	require.NoError(t, err)

	reminder := &model.PostReminder{
		TargetTime: 1234,
		PostId:     p1.Id,
		UserId:     userID,
	}

	require.NoError(t, ss.Post().SetPostReminder(reminder))

	out := model.PostReminder{}
	require.NoError(t, s.GetMaster().Get(&out, `SELECT PostId, UserId, TargetTime FROM PostReminders WHERE PostId=? AND UserId=?`, reminder.PostId, reminder.UserId))
	assert.Equal(t, reminder, &out)

	reminder.PostId = "notfound"
	err = ss.Post().SetPostReminder(reminder)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))

	// Upsert
	reminder = &model.PostReminder{
		TargetTime: 12345,
		PostId:     p1.Id,
		UserId:     userID,
	}

	require.NoError(t, ss.Post().SetPostReminder(reminder))
	require.NoError(t, s.GetMaster().Get(&out, `SELECT PostId, UserId, TargetTime FROM PostReminders WHERE PostId=? AND UserId=?`, reminder.PostId, reminder.UserId))
	assert.Equal(t, reminder, &out)
}

func testGetPostReminders(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	times := []int64{100, 101, 102}
	for _, tt := range times {
		userID := NewTestID()

		p1 := &model.Post{
			UserId:    userID,
			ChannelId: NewTestID(),
			Message:   "hi there",
			Type:      model.PostTypeDefault,
		}
		p1, err := ss.Post().Save(rctx, p1)
		require.NoError(t, err)

		reminder := &model.PostReminder{
			TargetTime: tt,
			PostId:     p1.Id,
			UserId:     userID,
		}

		require.NoError(t, ss.Post().SetPostReminder(reminder))
	}

	reminders, err := ss.Post().GetPostReminders(101)
	require.NoError(t, err)
	require.Len(t, reminders, 2)

	// assert one reminder is left
	reminders, err = ss.Post().GetPostReminders(102)
	require.NoError(t, err)
	require.Len(t, reminders, 1)

	// assert everything is deleted.
	reminders, err = ss.Post().GetPostReminders(103)
	require.NoError(t, err)
	require.Len(t, reminders, 0)
}

func testGetPostReminderMetadata(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	team := &model.Team{
		Name:        "teamname",
		DisplayName: "display",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	ch := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "channeldisplay",
		Name:        NewTestID(),
		Type:        model.ChannelTypeOpen,
	}
	ch, err = ss.Channel().Save(rctx, ch, -1)
	require.NoError(t, err)

	ch2 := &model.Channel{
		TeamId:      "",
		DisplayName: "GM_display",
		Name:        NewTestID(),
		Type:        model.ChannelTypeGroup,
	}
	ch2, err = ss.Channel().Save(rctx, ch2, -1)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
		Locale:   "es",
	}

	u1, err = ss.User().Save(rctx, u1)
	require.NoError(t, err)

	p1 := &model.Post{
		UserId:    u1.Id,
		ChannelId: ch.Id,
		Message:   "hi there",
		Type:      model.PostTypeDefault,
	}
	p1, err = ss.Post().Save(rctx, p1)
	require.NoError(t, err)

	p2 := &model.Post{
		UserId:    u1.Id,
		ChannelId: ch2.Id,
		Message:   "hi there 2",
		Type:      model.PostTypeDefault,
	}
	p2, err = ss.Post().Save(rctx, p2)
	require.NoError(t, err)

	meta, err := ss.Post().GetPostReminderMetadata(p1.Id)
	require.NoError(t, err)
	assert.Equal(t, meta.ChannelID, ch.Id)
	assert.Equal(t, meta.TeamName, team.Name)
	assert.Equal(t, meta.Username, u1.Username)
	assert.Equal(t, meta.UserLocale, u1.Locale)

	meta, err = ss.Post().GetPostReminderMetadata(p2.Id)
	require.NoError(t, err)
	assert.Equal(t, meta.ChannelID, ch2.Id)
	assert.Equal(t, meta.TeamName, "")
	assert.Equal(t, meta.Username, u1.Username)
	assert.Equal(t, meta.UserLocale, u1.Locale)
}

func getPostIds(posts []*model.Post, morePosts ...*model.Post) []string {
	ids := make([]string, 0, len(posts)+len(morePosts))
	for _, p := range posts {
		ids = append(ids, p.Id)
	}
	for _, p := range morePosts {
		ids = append(ids, p.Id)
	}
	return ids
}

func testGetNthRecentPostTime(t *testing.T, rctx request.CTX, ss store.Store) {
	_, err := ss.Post().GetNthRecentPostTime(0)
	assert.Error(t, err)
	_, err = ss.Post().GetNthRecentPostTime(-1)
	assert.Error(t, err)

	diff := int64(10000)
	now := utils.MillisFromTime(time.Now()) + diff

	p1 := &model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = "test"
	p1.CreateAt = now
	p1, err = ss.Post().Save(rctx, p1)
	require.NoError(t, err)

	p2 := &model.Post{}
	p2.ChannelId = p1.ChannelId
	p2.UserId = p1.UserId
	p2.Message = p1.Message
	now = now + diff
	p2.CreateAt = now
	p2, err = ss.Post().Save(rctx, p2)
	require.NoError(t, err)

	bot1 := &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     model.NewId(),
		UserId:      model.NewId(),
	}
	_, err = ss.Bot().Save(bot1)
	require.NoError(t, err)

	b1 := &model.Post{}
	b1.Message = "bot test"
	b1.ChannelId = p1.ChannelId
	b1.UserId = bot1.UserId
	now = now + diff
	b1.CreateAt = now
	_, err = ss.Post().Save(rctx, b1)
	require.NoError(t, err)

	p3 := &model.Post{}
	p3.ChannelId = p1.ChannelId
	p3.UserId = p1.UserId
	p3.Message = p1.Message
	now = now + diff
	p3.CreateAt = now
	p3, err = ss.Post().Save(rctx, p3)
	require.NoError(t, err)

	s1 := &model.Post{}
	s1.Type = model.PostTypeJoinChannel
	s1.ChannelId = p1.ChannelId
	s1.UserId = model.NewId()
	s1.Message = "system_join_channel message"
	now = now + diff
	s1.CreateAt = now
	_, err = ss.Post().Save(rctx, s1)
	require.NoError(t, err)

	p4 := &model.Post{}
	p4.ChannelId = p1.ChannelId
	p4.UserId = p1.UserId
	p4.Message = p1.Message
	now = now + diff
	p4.CreateAt = now
	p4, err = ss.Post().Save(rctx, p4)
	require.NoError(t, err)

	r, err := ss.Post().GetNthRecentPostTime(1)
	assert.NoError(t, err)
	assert.Equal(t, p4.CreateAt, r)

	// Skip system post
	r, err = ss.Post().GetNthRecentPostTime(2)
	assert.NoError(t, err)
	assert.Equal(t, p3.CreateAt, r)

	// Skip system & bot post
	r, err = ss.Post().GetNthRecentPostTime(3)
	assert.NoError(t, err)
	assert.Equal(t, p2.CreateAt, r)

	r, err = ss.Post().GetNthRecentPostTime(4)
	assert.NoError(t, err)
	assert.Equal(t, p1.CreateAt, r)

	_, err = ss.Post().GetNthRecentPostTime(10000)
	assert.Error(t, err)
	assert.IsType(t, &store.ErrNotFound{}, err)
}

func testGetEditHistoryForPost(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should return edit history for post", func(t *testing.T) {
		// create a post
		post := &model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   "test",
		}
		originalPost, err := ss.Post().Save(rctx, post)
		require.NoError(t, err)
		// create an edit
		updatedPost := originalPost.Clone()
		updatedPost.Message = "test edited"
		savedUpdatedPost, err := ss.Post().Update(rctx, updatedPost, originalPost)
		require.NoError(t, err)
		// get edit history
		edits, err := ss.Post().GetEditHistoryForPost(savedUpdatedPost.Id)
		require.NoError(t, err)
		require.Len(t, edits, 1)
		require.Equal(t, originalPost.Id, edits[0].Id)
		require.Equal(t, originalPost.UserId, edits[0].UserId)
		require.Equal(t, originalPost.Message, edits[0].Message)
	})

	t.Run("should return error for not edited posts", func(t *testing.T) {
		// create a post
		post := &model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   "test",
		}
		originalPost, err := ss.Post().Save(rctx, post)
		require.NoError(t, err)
		// get edit history
		_, err = ss.Post().GetEditHistoryForPost(originalPost.Id)
		require.Error(t, err)
	})

	t.Run("should return error for non-existent post", func(t *testing.T) {
		// get edit history
		_, err := ss.Post().GetEditHistoryForPost("non-existent")
		require.Error(t, err)
	})

	t.Run("should return error for deleted post", func(t *testing.T) {
		// create a post
		post := &model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   "test",
		}
		originalPost, err := ss.Post().Save(rctx, post)
		require.NoError(t, err)
		// delete post
		err = ss.Post().Delete(rctx, post.Id, 100, post.UserId)
		require.NoError(t, err)
		// get edit history
		_, err = ss.Post().GetEditHistoryForPost(originalPost.Id)
		require.Error(t, err)
	})

	t.Run("should return error for deleted edit", func(t *testing.T) {
		// create a post
		post := &model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   "test",
		}
		originalPost, err := ss.Post().Save(rctx, post)
		require.NoError(t, err)
		// create an edit
		updatedPost := originalPost.Clone()
		updatedPost.Message = "test edited"
		savedUpdatedPost, err := ss.Post().Update(rctx, updatedPost, originalPost)
		require.NoError(t, err)
		// delete edit
		err = ss.Post().Delete(rctx, savedUpdatedPost.Id, 100, savedUpdatedPost.UserId)
		require.NoError(t, err)
		// get edit history
		_, err = ss.Post().GetEditHistoryForPost(savedUpdatedPost.Id)
		require.NoError(t, err)
	})
}
