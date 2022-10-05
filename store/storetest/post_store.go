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

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func TestPostStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("SaveMultiple", func(t *testing.T) { testPostStoreSaveMultiple(t, ss) })
	t.Run("Save", func(t *testing.T) { testPostStoreSave(t, ss) })
	t.Run("SaveAndUpdateChannelMsgCounts", func(t *testing.T) { testPostStoreSaveChannelMsgCounts(t, ss) })
	t.Run("Get", func(t *testing.T) { testPostStoreGet(t, ss) })
	t.Run("GetSingle", func(t *testing.T) { testPostStoreGetSingle(t, ss) })
	t.Run("Update", func(t *testing.T) { testPostStoreUpdate(t, ss) })
	t.Run("Delete", func(t *testing.T) { testPostStoreDelete(t, ss) })
	t.Run("PermDelete1Level", func(t *testing.T) { testPostStorePermDelete1Level(t, ss) })
	t.Run("PermDelete1Level2", func(t *testing.T) { testPostStorePermDelete1Level2(t, ss) })
	t.Run("GetWithChildren", func(t *testing.T) { testPostStoreGetWithChildren(t, ss) })
	t.Run("GetPostsWithDetails", func(t *testing.T) { testPostStoreGetPostsWithDetails(t, ss) })
	t.Run("GetPostsBeforeAfter", func(t *testing.T) { testPostStoreGetPostsBeforeAfter(t, ss) })
	t.Run("GetPostsSince", func(t *testing.T) { testPostStoreGetPostsSince(t, ss) })
	t.Run("GetPosts", func(t *testing.T) { testPostStoreGetPosts(t, ss) })
	t.Run("GetPostBeforeAfter", func(t *testing.T) { testPostStoreGetPostBeforeAfter(t, ss) })
	t.Run("UserCountsWithPostsByDay", func(t *testing.T) { testUserCountsWithPostsByDay(t, ss) })
	t.Run("PostCountsByDuration", func(t *testing.T) { testPostCountsByDay(t, ss) })
	t.Run("GetFlaggedPostsForTeam", func(t *testing.T) { testPostStoreGetFlaggedPostsForTeam(t, ss, s) })
	t.Run("GetFlaggedPosts", func(t *testing.T) { testPostStoreGetFlaggedPosts(t, ss) })
	t.Run("GetFlaggedPostsForChannel", func(t *testing.T) { testPostStoreGetFlaggedPostsForChannel(t, ss) })
	t.Run("GetPostsCreatedAt", func(t *testing.T) { testPostStoreGetPostsCreatedAt(t, ss) })
	t.Run("GetLastPostRowCreateAt", func(t *testing.T) { testPostStoreGetLastPostRowCreateAt(t, ss) })
	t.Run("Overwrite", func(t *testing.T) { testPostStoreOverwrite(t, ss) })
	t.Run("OverwriteMultiple", func(t *testing.T) { testPostStoreOverwriteMultiple(t, ss) })
	t.Run("GetPostsByIds", func(t *testing.T) { testPostStoreGetPostsByIds(t, ss) })
	t.Run("GetPostsBatchForIndexing", func(t *testing.T) { testPostStoreGetPostsBatchForIndexing(t, ss) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testPostStorePermanentDeleteBatch(t, ss) })
	t.Run("GetOldest", func(t *testing.T) { testPostStoreGetOldest(t, ss) })
	t.Run("TestGetMaxPostSize", func(t *testing.T) { testGetMaxPostSize(t, ss) })
	t.Run("GetParentsForExportAfter", func(t *testing.T) { testPostStoreGetParentsForExportAfter(t, ss) })
	t.Run("GetRepliesForExport", func(t *testing.T) { testPostStoreGetRepliesForExport(t, ss) })
	t.Run("GetDirectPostParentsForExportAfter", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfter(t, ss, s) })
	t.Run("GetDirectPostParentsForExportAfterDeleted", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfterDeleted(t, ss, s) })
	t.Run("GetDirectPostParentsForExportAfterBatched", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfterBatched(t, ss, s) })
	t.Run("GetForThread", func(t *testing.T) { testPostStoreGetForThread(t, ss) })
	t.Run("HasAutoResponsePostByUserSince", func(t *testing.T) { testHasAutoResponsePostByUserSince(t, ss) })
	t.Run("GetPostsSinceForSync", func(t *testing.T) { testGetPostsSinceForSync(t, ss, s) })
	t.Run("SetPostReminder", func(t *testing.T) { testSetPostReminder(t, ss, s) })
	t.Run("GetPostReminders", func(t *testing.T) { testGetPostReminders(t, ss, s) })
	t.Run("GetPostReminderMetadata", func(t *testing.T) { testGetPostReminderMetadata(t, ss, s) })
	t.Run("GetNthRecentPostTime", func(t *testing.T) { testGetNthRecentPostTime(t, ss) })
	t.Run("GetTopDMsForUserSince", func(t *testing.T) { testGetTopDMsForUserSince(t, ss, s) })
}

func testPostStoreSave(t *testing.T, ss store.Store) {
	t.Run("Save post", func(t *testing.T) {
		o1 := model.Post{}
		o1.ChannelId = model.NewId()
		o1.UserId = model.NewId()
		o1.Message = NewTestId()

		p, err := ss.Post().Save(&o1)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(0), p.ReplyCount)
	})

	t.Run("Save replies", func(t *testing.T) {
		o1 := model.Post{}
		o1.ChannelId = model.NewId()
		o1.UserId = model.NewId()
		o1.RootId = model.NewId()
		o1.Message = NewTestId()

		o2 := model.Post{}
		o2.ChannelId = model.NewId()
		o2.UserId = model.NewId()
		o2.RootId = o1.RootId
		o2.Message = NewTestId()

		o3 := model.Post{}
		o3.ChannelId = model.NewId()
		o3.UserId = model.NewId()
		o3.RootId = model.NewId()
		o3.Message = NewTestId()

		p1, err := ss.Post().Save(&o1)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(1), p1.ReplyCount)

		p2, err := ss.Post().Save(&o2)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(2), p2.ReplyCount)

		p3, err := ss.Post().Save(&o3)
		require.NoError(t, err, "couldn't save item")
		assert.Equal(t, int64(1), p3.ReplyCount)
	})

	t.Run("Try to save existing post", func(t *testing.T) {
		o1 := model.Post{}
		o1.ChannelId = model.NewId()
		o1.UserId = model.NewId()
		o1.Message = NewTestId()

		_, err := ss.Post().Save(&o1)
		require.NoError(t, err, "couldn't save item")

		_, err = ss.Post().Save(&o1)
		require.Error(t, err, "shouldn't be able to update from save")
	})

	t.Run("Update reply should update the UpdateAt of the root post", func(t *testing.T) {
		rootPost := model.Post{}
		rootPost.ChannelId = model.NewId()
		rootPost.UserId = model.NewId()
		rootPost.Message = NewTestId()

		_, err := ss.Post().Save(&rootPost)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = NewTestId()
		replyPost.RootId = rootPost.Id

		// We need to sleep here to be sure the post is not created during the same millisecond
		time.Sleep(time.Millisecond)
		_, err = ss.Post().Save(&replyPost)
		require.NoError(t, err)

		rrootPost, err := ss.Post().GetSingle(rootPost.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rrootPost.UpdateAt, rootPost.UpdateAt)
	})

	t.Run("Create a post should update the channel LastPostAt and the total messages count by one", func(t *testing.T) {
		channel := model.Channel{}
		channel.Name = NewTestId()
		channel.DisplayName = NewTestId()
		channel.Type = model.ChannelTypeOpen

		_, err := ss.Channel().Save(&channel, 100)
		require.NoError(t, err)

		post := model.Post{}
		post.ChannelId = channel.Id
		post.UserId = model.NewId()
		post.Message = NewTestId()

		// We need to sleep here to be sure the post is not created during the same millisecond
		time.Sleep(time.Millisecond)
		_, err = ss.Post().Save(&post)
		require.NoError(t, err)

		rchannel, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rchannel.LastPostAt, channel.LastPostAt)
		assert.Equal(t, int64(1), rchannel.TotalMsgCount)

		post = model.Post{}
		post.ChannelId = channel.Id
		post.UserId = model.NewId()
		post.Message = NewTestId()
		post.CreateAt = 5

		// We need to sleep here to be sure the post is not created during the same millisecond
		time.Sleep(time.Millisecond)
		_, err = ss.Post().Save(&post)
		require.NoError(t, err)

		rchannel2, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err)
		assert.Equal(t, rchannel.LastPostAt, rchannel2.LastPostAt)
		assert.Equal(t, int64(2), rchannel2.TotalMsgCount)

		post = model.Post{}
		post.ChannelId = channel.Id
		post.UserId = model.NewId()
		post.Message = NewTestId()

		// We need to sleep here to be sure the post is not created during the same millisecond
		time.Sleep(time.Millisecond)
		_, err = ss.Post().Save(&post)
		require.NoError(t, err)

		rchannel3, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rchannel3.LastPostAt, rchannel2.LastPostAt)
		assert.Equal(t, int64(3), rchannel3.TotalMsgCount)
	})
}

func testPostStoreSaveMultiple(t *testing.T, ss store.Store) {
	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestId()

	p2 := model.Post{}
	p2.ChannelId = model.NewId()
	p2.UserId = model.NewId()
	p2.Message = NewTestId()

	p3 := model.Post{}
	p3.ChannelId = model.NewId()
	p3.UserId = model.NewId()
	p3.Message = NewTestId()

	p4 := model.Post{}
	p4.ChannelId = model.NewId()
	p4.UserId = model.NewId()
	p4.Message = NewTestId()

	t.Run("Save correctly a new set of posts", func(t *testing.T) {
		newPosts, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1, &p2, &p3})
		require.NoError(t, err)
		require.Equal(t, -1, errIdx)
		for _, post := range newPosts {
			storedPost, err := ss.Post().GetSingle(post.Id, false)
			assert.NoError(t, err)
			assert.Equal(t, post.ChannelId, storedPost.ChannelId)
			assert.Equal(t, post.Message, storedPost.Message)
			assert.Equal(t, post.UserId, storedPost.UserId)
		}
	})

	t.Run("Save replies", func(t *testing.T) {
		o1 := model.Post{}
		o1.ChannelId = model.NewId()
		o1.UserId = model.NewId()
		o1.RootId = model.NewId()
		o1.Message = NewTestId()

		o2 := model.Post{}
		o2.ChannelId = model.NewId()
		o2.UserId = model.NewId()
		o2.RootId = o1.RootId
		o2.Message = NewTestId()

		o3 := model.Post{}
		o3.ChannelId = model.NewId()
		o3.UserId = model.NewId()
		o3.RootId = model.NewId()
		o3.Message = NewTestId()

		o4 := model.Post{}
		o4.ChannelId = model.NewId()
		o4.UserId = model.NewId()
		o4.Message = NewTestId()

		newPosts, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&o1, &o2, &o3, &o4})
		require.NoError(t, err, "couldn't save item")
		require.Equal(t, -1, errIdx)
		assert.Len(t, newPosts, 4)
		assert.Equal(t, int64(2), newPosts[0].ReplyCount)
		assert.Equal(t, int64(2), newPosts[1].ReplyCount)
		assert.Equal(t, int64(1), newPosts[2].ReplyCount)
		assert.Equal(t, int64(0), newPosts[3].ReplyCount)
	})

	t.Run("Try to save mixed, already saved and not saved posts", func(t *testing.T) {
		newPosts, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p4, &p3})
		require.Error(t, err)
		require.Equal(t, 1, errIdx)
		require.Nil(t, newPosts)
		storedPost, err := ss.Post().GetSingle(p3.Id, false)
		assert.NoError(t, err)
		assert.Equal(t, p3.ChannelId, storedPost.ChannelId)
		assert.Equal(t, p3.Message, storedPost.Message)
		assert.Equal(t, p3.UserId, storedPost.UserId)

		storedPost, err = ss.Post().GetSingle(p4.Id, false)
		assert.Error(t, err)
		assert.Nil(t, storedPost)
	})

	t.Run("Update reply should update the UpdateAt of the root post", func(t *testing.T) {
		rootPost := model.Post{}
		rootPost.ChannelId = model.NewId()
		rootPost.UserId = model.NewId()
		rootPost.Message = NewTestId()

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = NewTestId()
		replyPost.RootId = rootPost.Id

		_, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost, &replyPost})
		require.NoError(t, err)

		rrootPost, err := ss.Post().GetSingle(rootPost.Id, false)
		require.NoError(t, err)
		assert.Equal(t, rrootPost.UpdateAt, rootPost.UpdateAt)

		replyPost2 := model.Post{}
		replyPost2.ChannelId = rootPost.ChannelId
		replyPost2.UserId = model.NewId()
		replyPost2.Message = NewTestId()
		replyPost2.RootId = rootPost.Id

		replyPost3 := model.Post{}
		replyPost3.ChannelId = rootPost.ChannelId
		replyPost3.UserId = model.NewId()
		replyPost3.Message = NewTestId()
		replyPost3.RootId = rootPost.Id

		// Ensure update does not occur in the same timestamp as creation
		time.Sleep(time.Millisecond)

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&replyPost2, &replyPost3})
		require.NoError(t, err)

		rrootPost2, err := ss.Post().GetSingle(rootPost.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rrootPost2.UpdateAt, rrootPost.UpdateAt)
	})

	t.Run("Create a post should update the channel LastPostAt and the total messages count by one", func(t *testing.T) {
		channel := model.Channel{}
		channel.Name = NewTestId()
		channel.DisplayName = NewTestId()
		channel.Type = model.ChannelTypeOpen

		_, err := ss.Channel().Save(&channel, 100)
		require.NoError(t, err)

		post1 := model.Post{}
		post1.ChannelId = channel.Id
		post1.UserId = model.NewId()
		post1.Message = NewTestId()

		post2 := model.Post{}
		post2.ChannelId = channel.Id
		post2.UserId = model.NewId()
		post2.Message = NewTestId()
		post2.CreateAt = 5

		post3 := model.Post{}
		post3.ChannelId = channel.Id
		post3.UserId = model.NewId()
		post3.Message = NewTestId()

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&post1, &post2, &post3})
		require.NoError(t, err)

		rchannel, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err)
		assert.Greater(t, rchannel.LastPostAt, channel.LastPostAt)
		assert.Equal(t, int64(3), rchannel.TotalMsgCount)
	})

	t.Run("Thread participants", func(t *testing.T) {
		o1 := model.Post{}
		o1.ChannelId = model.NewId()
		o1.UserId = model.NewId()
		o1.Message = "jessica hyde" + model.NewId() + "b"

		root, err := ss.Post().Save(&o1)
		require.NoError(t, err)

		o2 := model.Post{}
		o2.ChannelId = model.NewId()
		o2.UserId = model.NewId()
		o2.RootId = root.Id
		o2.Message = "zz" + model.NewId() + "b"

		o3 := model.Post{}
		o3.ChannelId = model.NewId()
		o3.UserId = model.NewId()
		o3.RootId = root.Id
		o3.Message = "zz" + model.NewId() + "b"

		o4 := model.Post{}
		o4.ChannelId = model.NewId()
		o4.UserId = o2.UserId
		o4.RootId = root.Id
		o4.Message = "zz" + model.NewId() + "b"

		o5 := model.Post{}
		o5.ChannelId = model.NewId()
		o5.UserId = o1.UserId
		o5.RootId = root.Id
		o5.Message = "zz" + model.NewId() + "b"

		_, err = ss.Post().Save(&o2)
		require.NoError(t, err)
		thread, errT := ss.Thread().Get(root.Id)
		require.NoError(t, errT)

		assert.Equal(t, int64(1), thread.ReplyCount)
		assert.Equal(t, int(1), len(thread.Participants))
		assert.Equal(t, model.StringArray{o2.UserId}, thread.Participants)

		_, err = ss.Post().Save(&o3)
		require.NoError(t, err)
		thread, errT = ss.Thread().Get(root.Id)
		require.NoError(t, errT)

		assert.Equal(t, int64(2), thread.ReplyCount)
		assert.Equal(t, int(2), len(thread.Participants))
		assert.Equal(t, model.StringArray{o2.UserId, o3.UserId}, thread.Participants)

		_, err = ss.Post().Save(&o4)
		require.NoError(t, err)
		thread, errT = ss.Thread().Get(root.Id)
		require.NoError(t, errT)

		assert.Equal(t, int64(3), thread.ReplyCount)
		assert.Equal(t, int(2), len(thread.Participants))
		assert.Equal(t, model.StringArray{o3.UserId, o2.UserId}, thread.Participants)

		_, err = ss.Post().Save(&o5)
		require.NoError(t, err)
		thread, errT = ss.Thread().Get(root.Id)
		require.NoError(t, errT)

		assert.Equal(t, int64(4), thread.ReplyCount)
		assert.Equal(t, int(3), len(thread.Participants))
		assert.Equal(t, model.StringArray{o3.UserId, o2.UserId, o1.UserId}, thread.Participants)
	})
}

func testPostStoreSaveChannelMsgCounts(t *testing.T, ss store.Store) {
	c1 := &model.Channel{Name: model.NewId(), DisplayName: "posttestchannel", Type: model.ChannelTypeOpen}
	_, err := ss.Channel().Save(c1, 1000000)
	require.NoError(t, err)

	o1 := model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestId()

	_, err = ss.Post().Save(&o1)
	require.NoError(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.NoError(t, err)
	assert.Equal(t, int64(1), c1.TotalMsgCount, "Message count should update by 1")

	o1.Id = ""
	o1.Type = model.PostTypeAddToTeam
	_, err = ss.Post().Save(&o1)
	require.NoError(t, err)

	o1.Id = ""
	o1.Type = model.PostTypeRemoveFromTeam
	_, err = ss.Post().Save(&o1)
	require.NoError(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.NoError(t, err)
	assert.Equal(t, int64(1), c1.TotalMsgCount, "Message count should not update for team add/removed message")

	oldLastPostAt := c1.LastPostAt

	o2 := model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.CreateAt = int64(7)
	_, err = ss.Post().Save(&o2)
	require.NoError(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.NoError(t, err)
	assert.Equal(t, oldLastPostAt, c1.LastPostAt, "LastPostAt should not update for old message save")
}

func testPostStoreGet(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()

	etag1 := ss.Post().GetEtag(o1.ChannelId, false, false)
	require.Equal(t, 0, strings.Index(etag1, model.CurrentVersion+"."), "Invalid Etag")

	o1, err := ss.Post().Save(o1)
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

func testPostStoreGetForThread(t *testing.T, ss store.Store) {
	t.Run("Post thread is followed", func(t *testing.T) {
		o1 := &model.Post{ChannelId: model.NewId(), UserId: model.NewId(), Message: NewTestId()}
		o1, err := ss.Post().Save(o1)
		require.NoError(t, err)
		_, err = ss.Post().Save(&model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestId(), RootId: o1.Id})
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
		o1 := &model.Post{ChannelId: model.NewId(), UserId: model.NewId(), Message: NewTestId()}
		o1, err := ss.Post().Save(o1)
		require.NoError(t, err)
		_, err = ss.Post().Save(&model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestId(), RootId: o1.Id})
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
		o1 := &model.Post{ChannelId: model.NewId(), UserId: model.NewId(), Message: NewTestId()}
		o1, err := ss.Post().Save(o1)
		require.NoError(t, err)
		_, err = ss.Post().Save(&model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestId(), RootId: o1.Id})
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
		t.Skip("MM-46134")
		o1, err := ss.Post().Save(&model.Post{ChannelId: model.NewId(), UserId: model.NewId(), Message: NewTestId()})
		require.NoError(t, err)
		_, err = ss.Post().Save(&model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestId(), RootId: o1.Id})
		require.NoError(t, err)
		m1, err := ss.Post().Save(&model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestId(), RootId: o1.Id})
		require.NoError(t, err)
		_, err = ss.Post().Save(&model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestId(), RootId: o1.Id})
		require.NoError(t, err)
		_, err = ss.Post().Save(&model.Post{ChannelId: o1.ChannelId, UserId: model.NewId(), Message: NewTestId(), RootId: o1.Id})
		require.NoError(t, err)

		opts := model.GetPostsOptions{
			CollapsedThreads: true,
			PerPage:          2,
			Direction:        "down",
		}
		r1, err := ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		assert.Len(t, r1.Order, 3) // including the root post
		assert.True(t, r1.HasNext)

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
		assert.Len(t, r1.Order, 3) // including the root post
		assert.GreaterOrEqual(t, r1.Posts[r1.Order[len(r1.Order)-1]].CreateAt, lastPostCreateAt)
		assert.False(t, r1.HasNext)

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
		assert.Len(t, r1.Order, 3) // including the root post
		assert.LessOrEqual(t, r1.Posts[r1.Order[1]].CreateAt, firstPostCreateAt)
		assert.False(t, r1.HasNext)

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
		assert.Len(t, r1.Order, 2) // including the root post
		assert.LessOrEqual(t, r1.Posts[r1.Order[1]].CreateAt, m1.CreateAt)
		assert.True(t, r1.HasNext)

		// Non-CRT mode
		opts = model.GetPostsOptions{
			CollapsedThreads: false,
			PerPage:          2,
			Direction:        "down",
			SkipFetchThreads: false,
		}
		r1, err = ss.Post().Get(context.Background(), o1.Id, opts, o1.UserId, map[string]bool{})
		require.NoError(t, err)
		assert.Len(t, r1.Order, 2) // including the root post
		assert.True(t, r1.HasNext)

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
		assert.Len(t, r1.Order, 4) // including the root post
		assert.GreaterOrEqual(t, r1.Posts[r1.Order[len(r1.Order)-1]].CreateAt, lastPostCreateAt)
		assert.False(t, r1.HasNext)

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
		assert.Len(t, r1.Order, 2) // including the root post
		assert.LessOrEqual(t, r1.Posts[r1.Order[1]].CreateAt, firstPostCreateAt)
		assert.False(t, r1.HasNext)

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
		assert.Len(t, r1.Order, 2) // including the root post
		assert.GreaterOrEqual(t, r1.Posts[r1.Order[1]].CreateAt, m1.CreateAt)
		assert.True(t, r1.HasNext)
	})
}

func testPostStoreGetSingle(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = o1.UserId
	o2.Message = NewTestId()

	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2, err = ss.Post().Save(o2)
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

	_, err = ss.Post().Save(o3)
	require.NoError(t, err)

	o4, err = ss.Post().Save(o4)
	require.NoError(t, err)

	err = ss.Post().Delete(o2.Id, model.GetMillis(), o2.UserId)
	require.NoError(t, err)

	err = ss.Post().Delete(o4.Id, model.GetMillis(), o4.UserId)
	require.NoError(t, err)

	post, err := ss.Post().GetSingle(o1.Id, false)
	require.NoError(t, err)
	require.Equal(t, post.CreateAt, o1.CreateAt, "invalid returned post")
	require.Equal(t, int64(1), post.ReplyCount, "wrong replyCount computed")

	_, err = ss.Post().GetSingle(o2.Id, false)
	require.Error(t, err, "should not return deleted post")

	post, err = ss.Post().GetSingle(o2.Id, true)
	require.NoError(t, err)
	require.Equal(t, post.CreateAt, o2.CreateAt, "invalid returned post")
	require.NotZero(t, post.DeleteAt, "DeleteAt should be non-zero")
	require.Zero(t, post.ReplyCount, "Post without replies should return zero ReplyCount")

	_, err = ss.Post().GetSingle("123", false)
	require.Error(t, err, "Missing id should have failed")
}

func testPostStoreUpdate(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3, err = ss.Post().Save(o3)
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
	_, err = ss.Post().Update(o1a, ro1)
	require.NoError(t, err)

	r1, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	ro1a := r1.Posts[o1.Id]
	require.Equal(t, ro1a.Message, o1a.Message, "Failed to update/get")

	o2a := ro2.Clone()
	o2a.Message = ro2.Message + "DDDDDDD"
	_, err = ss.Post().Update(o2a, ro2)
	require.NoError(t, err)

	r2, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro2a := r2.Posts[o2.Id]

	require.Equal(t, ro2a.Message, o2a.Message, "Failed to update/get")

	o3a := ro3.Clone()
	o3a.Message = ro3.Message + "WWWWWWW"
	_, err = ss.Post().Update(o3a, ro3)
	require.NoError(t, err)

	r3, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	ro3a := r3.Posts[o3.Id]

	if ro3a.Message != o3a.Message {
		require.Equal(t, ro3a.Hashtags, o3a.Hashtags, "Failed to update/get")
	}

	o4, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
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
	_, err = ss.Post().Update(o4a, ro4)
	require.NoError(t, err)

	r4, err = ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	ro4a := r4.Posts[o4.Id]
	require.Empty(t, ro4a.Filenames, "Failed to clear Filenames")
	require.Len(t, ro4a.FileIds, 1, "Failed to set FileIds")
}

func testPostStoreDelete(t *testing.T, ss store.Store) {
	t.Run("single post, no replies", func(t *testing.T) {
		// Create a post
		rootPost, err := ss.Post().Save(&model.Post{
			ChannelId: model.NewId(),
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
		err = ss.Post().Delete(rootPost.Id, model.GetMillis(), deleteByID)
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
		// Create a root post
		rootPost, err := ss.Post().Save(&model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   NewTestId(),
		})
		require.NoError(t, err)

		// Reply to that root post
		replyPost, err := ss.Post().Save(&model.Post{
			ChannelId: rootPost.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestId(),
			RootId:    rootPost.Id,
		})
		require.NoError(t, err)

		// Delete the root post
		err = ss.Post().Delete(rootPost.Id, model.GetMillis(), "")
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
		// Create a root post
		rootPost1, err := ss.Post().Save(&model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   NewTestId(),
		})
		require.NoError(t, err)

		// Reply to that root post
		replyPost1, err := ss.Post().Save(&model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestId(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Reply to that root post a second time
		replyPost2, err := ss.Post().Save(&model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestId(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Create another root post in a separate channel
		rootPost2, err := ss.Post().Save(&model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   NewTestId(),
		})
		require.NoError(t, err)

		// Delete the root post
		err = ss.Post().Delete(rootPost1.Id, model.GetMillis(), "")
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

	t.Run("thread with multiple replies, update thread last reply at", func(t *testing.T) {
		// Create a root post
		rootPost1, err := ss.Post().Save(&model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   NewTestId(),
		})
		require.NoError(t, err)

		// Reply to that root post
		replyPost1, err := ss.Post().Save(&model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestId(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Reply to that root post a second time
		replyPost2, err := ss.Post().Save(&model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestId(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		// Reply to that root post a third time
		replyPost3, err := ss.Post().Save(&model.Post{
			ChannelId: rootPost1.ChannelId,
			UserId:    model.NewId(),
			Message:   NewTestId(),
			RootId:    rootPost1.Id,
		})
		require.NoError(t, err)

		thread, err := ss.Thread().Get(rootPost1.Id)
		require.NoError(t, err)
		require.Equal(t, replyPost3.CreateAt, thread.LastReplyAt)

		// Delete the reply previous to last
		err = ss.Post().Delete(replyPost2.Id, model.GetMillis(), "")
		require.NoError(t, err)

		thread, err = ss.Thread().Get(rootPost1.Id)
		require.NoError(t, err)
		// last reply at should be unchanged
		require.Equal(t, replyPost3.CreateAt, thread.LastReplyAt)

		// Delete the last reply
		err = ss.Post().Delete(replyPost3.Id, model.GetMillis(), "")
		require.NoError(t, err)

		thread, err = ss.Thread().Get(rootPost1.Id)
		require.NoError(t, err)
		// last reply at should have changed
		require.Equal(t, replyPost1.CreateAt, thread.LastReplyAt)

		// Delete the last reply
		err = ss.Post().Delete(replyPost1.Id, model.GetMillis(), "")
		require.NoError(t, err)

		thread, err = ss.Thread().Get(rootPost1.Id)
		require.NoError(t, err)
		// last reply at should be 0
		require.Equal(t, int64(0), thread.LastReplyAt)
	})
}

func testPostStorePermDelete1Level(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.RootId = o1.Id
	o4.UserId = o2.UserId
	o4.Message = NewTestId()
	o4, err = ss.Post().Save(o4)
	require.NoError(t, err)

	o5 := &model.Post{}
	o5.ChannelId = o3.ChannelId
	o5.UserId = model.NewId()
	o5.Message = NewTestId()
	o5, err = ss.Post().Save(o5)
	require.NoError(t, err)

	o6 := &model.Post{}
	o6.ChannelId = o3.ChannelId
	o6.RootId = o5.Id
	o6.UserId = model.NewId()
	o6.Message = NewTestId()
	o6, err = ss.Post().Save(o6)
	require.NoError(t, err)

	var thread *model.Thread
	thread, err = ss.Thread().Get(o1.Id)
	require.NoError(t, err)

	require.EqualValues(t, 2, thread.ReplyCount)
	require.EqualValues(t, model.StringArray{o2.UserId}, thread.Participants)

	err2 := ss.Post().PermanentDeleteByUser(o2.UserId)
	require.NoError(t, err2)

	thread, err = ss.Thread().Get(o1.Id)
	require.NoError(t, err)

	require.EqualValues(t, 0, thread.ReplyCount)
	require.EqualValues(t, model.StringArray{}, thread.Participants)

	_, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err, "Deleted id shouldn't have failed")

	_, err = ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	thread, err = ss.Thread().Get(o5.Id)
	require.NoError(t, err)
	require.NotEmpty(t, thread)

	err = ss.Post().PermanentDeleteByChannel(o3.ChannelId)
	require.NoError(t, err)

	thread, err = ss.Thread().Get(o5.Id)
	require.NoError(t, err)
	require.Nil(t, thread)

	_, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o5.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o6.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")
}

func testPostStorePermDelete1Level2(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)

	err2 := ss.Post().PermanentDeleteByUser(o1.UserId)
	require.NoError(t, err2)

	_, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err, "Deleted id should have failed")
}

func testPostStoreGetWithChildren(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3.RootId = o1.Id
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)

	pl, err := ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	require.Len(t, pl.Posts, 3, "invalid returned post")

	dErr := ss.Post().Delete(o3.Id, model.GetMillis(), "")
	require.NoError(t, dErr)

	pl, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	require.Len(t, pl.Posts, 2, "invalid returned post")

	dErr = ss.Post().Delete(o2.Id, model.GetMillis(), "")
	require.NoError(t, dErr)

	pl, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	require.Len(t, pl.Posts, 1, "invalid returned post")
}

func testPostStoreGetPostsWithDetails(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.RootId = o1.Id
	_, err = ss.Post().Save(o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = NewTestId()
	o2a.RootId = o1.Id
	o2a, err = ss.Post().Save(o2a)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3.RootId = o1.Id
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = NewTestId()
	o4, err = ss.Post().Save(o4)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = NewTestId()
	o5.RootId = o4.Id
	o5, err = ss.Post().Save(o5)
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
	o6.Message = NewTestId()
	_, err = ss.Post().Save(o6)
	require.NoError(t, err)

	r3, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: o1.ChannelId, Page: 0, PerPage: 30}, false, map[string]bool{})
	require.NoError(t, err)
	assert.Equal(t, 7, len(r3.Order))
}

func testPostStoreGetPostsBeforeAfter(t *testing.T, ss store.Store) {
	t.Run("without threads", func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		var posts []*model.Post
		for i := 0; i < 10; i++ {
			post, err := ss.Post().Save(&model.Post{
				ChannelId: channelId,
				UserId:    userId,
				Message:   "message",
			})
			require.NoError(t, err)

			posts = append(posts, post)

			time.Sleep(time.Millisecond)
		}

		t.Run("should return error if negative Page/PerPage options are passed", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelId, PostId: posts[0].Id, Page: 0, PerPage: -1}, map[string]bool{})
			assert.Nil(t, postList)
			assert.Error(t, err)
			assert.IsType(t, &store.ErrInvalidInput{}, err)

			postList, err = ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelId, PostId: posts[0].Id, Page: -1, PerPage: 10}, map[string]bool{})
			assert.Nil(t, postList)
			assert.Error(t, err)
			assert.IsType(t, &store.ErrInvalidInput{}, err)
		})

		t.Run("should not return anything before the first post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelId, PostId: posts[0].Id, Page: 0, PerPage: 10}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{}, postList.Order)
			assert.Equal(t, map[string]*model.Post{}, postList.Posts)
		})

		t.Run("should return posts before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelId, PostId: posts[5].Id, Page: 0, PerPage: 10}, map[string]bool{})
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
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelId, PostId: posts[5].Id, PerPage: 2}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{posts[4].Id, posts[3].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[3].Id: posts[3],
				posts[4].Id: posts[4],
			}, postList.Posts)
		})

		t.Run("should not return anything after the last post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelId, PostId: posts[len(posts)-1].Id, PerPage: 10}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{}, postList.Order)
			assert.Equal(t, map[string]*model.Post{}, postList.Posts)
		})

		t.Run("should return posts after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelId, PostId: posts[5].Id, PerPage: 10}, map[string]bool{})
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
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelId, PostId: posts[5].Id, PerPage: 2}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{posts[7].Id, posts[6].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[6].Id: posts[6],
				posts[7].Id: posts[7],
			}, postList.Posts)
		})
	})
	t.Run("with threads", func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		// This creates a series of posts that looks like:
		// post1
		// post2
		// post3 (in response to post1)
		// post4 (in response to post2)
		// post5
		// post6 (in response to post2)

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		post1.ReplyCount = 1
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		post2.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post1.Id,
			Message:   "message",
		})
		require.NoError(t, err)
		post3.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post2.Id,
			Message:   "message",
		})
		require.NoError(t, err)
		post4.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post2.Id,
			Message:   "message",
		})
		post6.ReplyCount = 2
		require.NoError(t, err)

		// Adding a post to a thread changes the UpdateAt timestamp of the parent post
		post1.UpdateAt = post3.UpdateAt
		post2.UpdateAt = post6.UpdateAt

		t.Run("should return each post and thread before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelId, PostId: post4.Id, PerPage: 2}, map[string]bool{})
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
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelId, PostId: post4.Id, PerPage: 2}, map[string]bool{})
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
		channelId := model.NewId()
		userId := model.NewId()

		// This creates a series of posts that looks like:
		// post1
		// post2
		// post3 (in response to post1)
		// post4 (in response to post2)
		// post5
		// post6 (in response to post2)

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "post1",
		})
		require.NoError(t, err)
		post1.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "post2",
		})
		require.NoError(t, err)
		post2.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post1.Id,
			Message:   "post3",
		})
		require.NoError(t, err)
		post3.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post2.Id,
			Message:   "post4",
		})
		require.NoError(t, err)
		post4.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "post5",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post2.Id,
			Message:   "post6",
		})
		post6.ReplyCount = 2
		require.NoError(t, err)

		// Adding a post to a thread changes the UpdateAt timestamp of the parent post
		post1.UpdateAt = post3.UpdateAt
		post2.UpdateAt = post6.UpdateAt

		t.Run("should return each post and thread before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelId, PostId: post4.Id, PerPage: 2, SkipFetchThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post3.Id, post2.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post1.Id: post1,
				post2.Id: post2,
				post3.Id: post3,
			}, postList.Posts)
		})

		t.Run("should return each post and thread before a post with limit", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelId, PostId: post4.Id, PerPage: 1, SkipFetchThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post3.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post1.Id: post1,
				post3.Id: post3,
			}, postList.Posts)
		})

		t.Run("should return each post and the root of each thread after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelId, PostId: post4.Id, PerPage: 2, SkipFetchThreads: true}, map[string]bool{})
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
		channelId := model.NewId()
		userId := model.NewId()

		// This creates a series of posts that looks like:
		// post1
		// post2
		// post3 (in response to post1)
		// post4 (in response to post2)
		// post5
		// post6 (in response to post2)

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "post1",
		})
		require.NoError(t, err)
		post1.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "post2",
		})
		require.NoError(t, err)
		post2.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post1.Id,
			Message:   "post3",
		})
		require.NoError(t, err)
		post3.ReplyCount = 1
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post2.Id,
			Message:   "post4",
		})
		require.NoError(t, err)
		post4.ReplyCount = 2
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "post5",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post2.Id,
			Message:   "post6",
		})
		post6.ReplyCount = 2
		require.NoError(t, err)

		// Adding a post to a thread changes the UpdateAt timestamp of the parent post
		post1.UpdateAt = post3.UpdateAt
		post2.UpdateAt = post6.UpdateAt

		t.Run("should return each root post before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelId, PostId: post4.Id, PerPage: 2, CollapsedThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post2.Id, post1.Id}, postList.Order)
		})

		t.Run("should return each root post before a post with limit", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(model.GetPostsOptions{ChannelId: channelId, PostId: post4.Id, PerPage: 1, CollapsedThreads: true}, map[string]bool{})
			assert.NoError(t, err)

			assert.Equal(t, []string{post2.Id}, postList.Order)
		})

		t.Run("should return each root after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(model.GetPostsOptions{ChannelId: channelId, PostId: post4.Id, PerPage: 2, CollapsedThreads: true}, map[string]bool{})
			require.NoError(t, err)

			assert.Equal(t, []string{post5.Id}, postList.Order)
		})
	})
}

func testPostStoreGetPostsSince(t *testing.T, ss store.Store) {
	t.Run("should return posts created after the given time", func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		_, err = ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
			RootId:    post3.Id,
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
			RootId:    post1.Id,
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		postList, err := ss.Post().GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelId, Time: post3.CreateAt}, false, map[string]bool{})
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
		channelId := model.NewId()
		userId := model.NewId()

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		postList, err := ss.Post().GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelId, Time: post1.CreateAt}, false, map[string]bool{})
		assert.NoError(t, err)

		assert.Equal(t, []string{}, postList.Order)
		assert.Empty(t, postList.Posts)
	})

	t.Run("should not cache a timestamp of 0 when nothing has changed", func(t *testing.T) {
		ss.Post().ClearCaches()

		channelId := model.NewId()
		userId := model.NewId()

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		// Make a request that returns no results
		postList, err := ss.Post().GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelId, Time: post1.CreateAt}, true, map[string]bool{})
		require.NoError(t, err)
		require.Equal(t, model.NewPostList(), postList)

		// And then ensure that it doesn't cause future requests to also return no results
		postList, err = ss.Post().GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelId, Time: post1.CreateAt - 1}, true, map[string]bool{})
		require.NoError(t, err)

		assert.Equal(t, []string{post1.Id}, postList.Order)

		assert.Len(t, postList.Posts, 1)
		assert.NotNil(t, postList.Posts[post1.Id])
	})
}

func testPostStoreGetPosts(t *testing.T, ss store.Store) {
	channelId := model.NewId()
	userId := model.NewId()

	post1, err := ss.Post().Save(&model.Post{
		ChannelId: channelId,
		UserId:    userId,
		Message:   "message",
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post2, err := ss.Post().Save(&model.Post{
		ChannelId: channelId,
		UserId:    userId,
		Message:   "message",
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post3, err := ss.Post().Save(&model.Post{
		ChannelId: channelId,
		UserId:    userId,
		Message:   "message",
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post4, err := ss.Post().Save(&model.Post{
		ChannelId: channelId,
		UserId:    userId,
		Message:   "message",
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post5, err := ss.Post().Save(&model.Post{
		ChannelId: channelId,
		UserId:    userId,
		Message:   "message",
		RootId:    post3.Id,
	})
	require.NoError(t, err)
	time.Sleep(time.Millisecond)

	post6, err := ss.Post().Save(&model.Post{
		ChannelId: channelId,
		UserId:    userId,
		Message:   "message",
		RootId:    post1.Id,
	})
	require.NoError(t, err)

	t.Run("should return the last posts created in a channel", func(t *testing.T) {
		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelId, Page: 0, PerPage: 30, SkipFetchThreads: false}, false, map[string]bool{})
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
		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelId, Page: 0, PerPage: 2, SkipFetchThreads: false}, false, map[string]bool{})
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
		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelId, Page: 0, PerPage: 2, SkipFetchThreads: true}, false, map[string]bool{})
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
		err := ss.Post().Delete(post1.Id, 1, userId)
		require.NoError(t, err)

		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelId, Page: 0, PerPage: 30, SkipFetchThreads: false, IncludeDeleted: true}, false, map[string]bool{})
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
		err := ss.Post().Delete(post5.Id, 1, userId)
		require.NoError(t, err)

		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelId, Page: 0, PerPage: 30, SkipFetchThreads: true, IncludeDeleted: true}, false, map[string]bool{})
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
		err := ss.Post().Delete(post6.Id, 1, userId)
		require.NoError(t, err)

		postList, err := ss.Post().GetPosts(model.GetPostsOptions{ChannelId: channelId, Page: 0, PerPage: 30, SkipFetchThreads: true, IncludeDeleted: false}, false, map[string]bool{})
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

func testPostStoreGetPostBeforeAfter(t *testing.T, ss store.Store) {
	channelId := model.NewId()

	o0 := &model.Post{}
	o0.ChannelId = channelId
	o0.UserId = model.NewId()
	o0.Message = NewTestId()
	_, err := ss.Post().Save(o0)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o1 := &model.Post{}
	o1.ChannelId = channelId
	o1.Type = model.PostTypeJoinChannel
	o1.UserId = model.NewId()
	o1.Message = "system_join_channel message"
	_, err = ss.Post().Save(o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o0a := &model.Post{}
	o0a.ChannelId = channelId
	o0a.UserId = model.NewId()
	o0a.Message = NewTestId()
	o0a.RootId = o1.Id
	_, err = ss.Post().Save(o0a)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o0b := &model.Post{}
	o0b.ChannelId = channelId
	o0b.UserId = model.NewId()
	o0b.Message = "deleted message"
	o0b.RootId = o1.Id
	o0b.DeleteAt = 1
	_, err = ss.Post().Save(o0b)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	otherChannelPost := &model.Post{}
	otherChannelPost.ChannelId = model.NewId()
	otherChannelPost.UserId = model.NewId()
	otherChannelPost.Message = NewTestId()
	_, err = ss.Post().Save(otherChannelPost)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = channelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	_, err = ss.Post().Save(o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = channelId
	o2a.UserId = model.NewId()
	o2a.Message = NewTestId()
	o2a.RootId = o2.Id
	_, err = ss.Post().Save(o2a)
	require.NoError(t, err)

	rPostId1, err := ss.Post().GetPostIdBeforeTime(channelId, o0a.CreateAt, false)
	require.Equal(t, rPostId1, o1.Id, "should return before post o1")
	require.NoError(t, err)

	rPostId1, err = ss.Post().GetPostIdAfterTime(channelId, o0b.CreateAt, false)
	require.Equal(t, rPostId1, o2.Id, "should return before post o2")
	require.NoError(t, err)

	rPost1, err := ss.Post().GetPostAfterTime(channelId, o0b.CreateAt, false)
	require.Equal(t, rPost1.Id, o2.Id, "should return before post o2")
	require.NoError(t, err)

	rPostId2, err := ss.Post().GetPostIdBeforeTime(channelId, o0.CreateAt, false)
	require.Empty(t, rPostId2, "should return no post")
	require.NoError(t, err)

	rPostId2, err = ss.Post().GetPostIdAfterTime(channelId, o0.CreateAt, false)
	require.Equal(t, rPostId2, o1.Id, "should return before post o1")
	require.NoError(t, err)

	rPost2, err := ss.Post().GetPostAfterTime(channelId, o0.CreateAt, false)
	require.Equal(t, rPost2.Id, o1.Id, "should return before post o1")
	require.NoError(t, err)

	rPostId3, err := ss.Post().GetPostIdBeforeTime(channelId, o2a.CreateAt, false)
	require.Equal(t, rPostId3, o2.Id, "should return before post o2")
	require.NoError(t, err)

	rPostId3, err = ss.Post().GetPostIdAfterTime(channelId, o2a.CreateAt, false)
	require.Empty(t, rPostId3, "should return no post")
	require.NoError(t, err)

	rPost3, err := ss.Post().GetPostAfterTime(channelId, o2a.CreateAt, false)
	require.Empty(t, rPost3.Id, "should return no post")
	require.NoError(t, err)
}

func testUserCountsWithPostsByDay(t *testing.T, ss store.Store) {
	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = NewTestId()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	t1, err := ss.Team().Save(t1)
	require.NoError(t, err)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = NewTestId()
	c1.Type = model.ChannelTypeOpen
	c1, nErr := ss.Channel().Save(c1, -1)
	require.NoError(t, nErr)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = NewTestId()
	o1, nErr = ss.Post().Save(o1)
	require.NoError(t, nErr)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = NewTestId()
	_, nErr = ss.Post().Save(o1a)
	require.NoError(t, nErr)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2.Message = NewTestId()
	o2, nErr = ss.Post().Save(o2)
	require.NoError(t, nErr)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2a.Message = NewTestId()
	_, nErr = ss.Post().Save(o2a)
	require.NoError(t, nErr)

	r1, err := ss.Post().AnalyticsUserCountsWithPostsByDay(t1.Id)
	require.NoError(t, err)

	row1 := r1[0]
	require.Equal(t, float64(2), row1.Value, "wrong value")

	row2 := r1[1]
	require.Equal(t, float64(1), row2.Value, "wrong value")
}

func testPostCountsByDay(t *testing.T, ss store.Store) {
	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = NewTestId()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	t1, err := ss.Team().Save(t1)
	require.NoError(t, err)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = NewTestId()
	c1.Type = model.ChannelTypeOpen
	c1, nErr := ss.Channel().Save(c1, -1)
	require.NoError(t, nErr)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = NewTestId()
	o1.Hashtags = "hashtag"
	o1, nErr = ss.Post().Save(o1)
	require.NoError(t, nErr)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = NewTestId()
	o1a.FileIds = []string{"fileId1"}
	_, nErr = ss.Post().Save(o1a)
	require.NoError(t, nErr)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2.Message = NewTestId()
	o2.Filenames = []string{"filename1"}
	o2, nErr = ss.Post().Save(o2)
	require.NoError(t, nErr)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2a.Message = NewTestId()
	o2a.Hashtags = "hashtag"
	o2a.FileIds = []string{"fileId2"}
	_, nErr = ss.Post().Save(o2a)
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
	_, nErr = ss.Post().Save(b1)
	require.NoError(t, nErr)

	b1a := &model.Post{}
	b1a.Message = "bot message two"
	b1a.ChannelId = c1.Id
	b1a.UserId = bot1.UserId
	b1a.CreateAt = utils.MillisFromTime(utils.Yesterday()) - (1000 * 60 * 60 * 24 * 2)
	_, nErr = ss.Post().Save(b1a)
	require.NoError(t, nErr)

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

	// last 31 days, bots only
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: true, YesterdayOnly: false}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.NoError(t, err)
	assert.Equal(t, float64(1), r1[0].Value)
	assert.Equal(t, float64(1), r1[1].Value)

	// yesterday only, all users (including bots)
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: false, YesterdayOnly: true}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.NoError(t, err)
	assert.Equal(t, float64(3), r1[0].Value)

	// yesterday only, bots only
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: true, YesterdayOnly: true}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.NoError(t, err)
	assert.Equal(t, float64(1), r1[0].Value)

	// total for single team
	r2, err := ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id})
	require.NoError(t, err)
	assert.Equal(t, int64(6), r2)

	// total across teams
	r2, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, r2, int64(6))

	// total across teams with files
	r2, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{MustHaveFile: true})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, r2, int64(3))

	// total across teams with hashtags
	r2, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{MustHaveHashtag: true})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, r2, int64(2))

	// total across teams with hashtags and files
	r2, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{MustHaveFile: true, MustHaveHashtag: true})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, r2, int64(1))

	// delete 1 post
	err = ss.Post().Delete(o1.Id, 1, o1.UserId)
	require.NoError(t, err)

	// total for single team with the deleted post excluded
	r2, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, ExcludeDeleted: true})
	require.NoError(t, err)
	assert.Equal(t, int64(5), r2)

	// total users only posts for single team with the deleted post excluded
	r2, err = ss.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: t1.Id, ExcludeDeleted: true, UsersPostsOnly: true})
	require.NoError(t, err)
	assert.Equal(t, int64(3), r2)
}

func testPostStoreGetFlaggedPostsForTeam(t *testing.T, ss store.Store, s SqlStore) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = NewTestId()
	c1.Type = model.ChannelTypeOpen
	c1, err := ss.Channel().Save(c1, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err = ss.Post().Save(o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	m0 := &model.ChannelMember{}
	m0.ChannelId = c1.Id
	m0.UserId = o1.UserId
	m0.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(m0)
	require.NoError(t, err)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = NewTestId()
	o4, err = ss.Post().Save(o4)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	c2 := &model.Channel{}
	c2.DisplayName = "DMChannel1"
	c2.Name = NewTestId()
	c2.Type = model.ChannelTypeDirect

	m1 := &model.ChannelMember{}
	m1.ChannelId = c2.Id
	m1.UserId = o1.UserId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := &model.ChannelMember{}
	m2.ChannelId = c2.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	c2, err = ss.Channel().SaveDirectChannel(c2, m1, m2)
	require.NoError(t, err)

	o5 := &model.Post{}
	o5.ChannelId = c2.Id
	o5.UserId = m2.UserId
	o5.Message = NewTestId()
	o5, err = ss.Post().Save(o5)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Post on channel where user is not a member
	o6 := &model.Post{}
	o6.ChannelId = model.NewId()
	o6.UserId = m2.UserId
	o6.Message = NewTestId()
	o6, err = ss.Post().Save(o6)
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
	s.GetMasterX().Exec("TRUNCATE Channels")
}

func testPostStoreGetFlaggedPosts(t *testing.T, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = NewTestId()
	c1.Type = model.ChannelTypeOpen
	c1, err := ss.Channel().Save(c1, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err = ss.Post().Save(o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Post on channel where user is not a member
	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = NewTestId()
	o4, err = ss.Post().Save(o4)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	m0 := &model.ChannelMember{}
	m0.ChannelId = o1.ChannelId
	m0.UserId = o1.UserId
	m0.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(m0)
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

func testPostStoreGetFlaggedPostsForChannel(t *testing.T, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = NewTestId()
	c1.Type = model.ChannelTypeOpen
	c1, err := ss.Channel().Save(c1, -1)
	require.NoError(t, err)

	c2 := &model.Channel{}
	c2.TeamId = model.NewId()
	c2.DisplayName = "Channel2"
	c2.Name = NewTestId()
	c2.Type = model.ChannelTypeOpen
	c2, err = ss.Channel().Save(c2, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err = ss.Post().Save(o1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// deleted post
	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = o1.ChannelId
	o3.Message = NewTestId()
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = c2.Id
	o4.UserId = model.NewId()
	o4.Message = NewTestId()
	o4, err = ss.Post().Save(o4)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Post on channel where user is not a member
	o5 := &model.Post{}
	o5.ChannelId = model.NewId()
	o5.UserId = model.NewId()
	o5.Message = NewTestId()
	o5, err = ss.Post().Save(o5)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	m1 := &model.ChannelMember{}
	m1.ChannelId = o1.ChannelId
	m1.UserId = o1.UserId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(m1)
	require.NoError(t, err)

	m2 := &model.ChannelMember{}
	m2.ChannelId = o4.ChannelId
	m2.UserId = o1.UserId
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(m2)
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

func testPostStoreGetLastPostRowCreateAt(t *testing.T, ss store.Store) {
	createTime1 := model.GetMillis() + 1
	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = NewTestId()
	o0.CreateAt = createTime1
	o0, err := ss.Post().Save(o0)
	require.NoError(t, err)

	createTime2 := model.GetMillis() + 2

	o1 := &model.Post{}
	o1.ChannelId = o0.ChannelId
	o1.UserId = model.NewId()
	o1.Message = "Latest message"
	o1.CreateAt = createTime2
	_, err = ss.Post().Save(o1)
	require.NoError(t, err)

	createAt, err := ss.Post().GetLastPostRowCreateAt()
	require.NoError(t, err)
	assert.Equal(t, createAt, createTime2)
}

func testPostStoreGetPostsCreatedAt(t *testing.T, ss store.Store) {
	createTime := model.GetMillis() + 1

	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = NewTestId()
	o0.CreateAt = createTime
	o0, err := ss.Post().Save(o0)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = o0.ChannelId
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1.CreateAt = createTime
	o1, err = ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.RootId = o1.Id
	o2.CreateAt = createTime + 1
	_, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3.CreateAt = createTime
	_, err = ss.Post().Save(o3)
	require.NoError(t, err)

	r1, _ := ss.Post().GetPostsCreatedAt(o1.ChannelId, createTime)
	assert.Equal(t, 2, len(r1))
}

func testPostStoreOverwriteMultiple(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)

	o4, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})
	require.NoError(t, err)

	o5, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
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

		_, errIdx, err := ss.Post().OverwriteMultiple([]*model.Post{o1a, o2a, o3a})
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

		_, errIdx, err := ss.Post().OverwriteMultiple([]*model.Post{o4a, o5a})
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

func testPostStoreOverwrite(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)

	o4, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
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
		_, err = ss.Post().Overwrite(o1a)
		require.NoError(t, err)

		o2a := ro2.Clone()
		o2a.Message = ro2.Message + "DDDDDDD"
		_, err = ss.Post().Overwrite(o2a)
		require.NoError(t, err)

		o3a := ro3.Clone()
		o3a.Message = ro3.Message + "WWWWWWW"
		_, err = ss.Post().Overwrite(o3a)
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
		_, err = ss.Post().Overwrite(o4a)
		require.NoError(t, err)

		r4, err = ss.Post().Get(context.Background(), o4.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)

		ro4a := r4.Posts[o4.Id]
		require.Empty(t, ro4a.Filenames, "Failed to clear Filenames")
		require.Len(t, ro4a.FileIds, 1, "Failed to set FileIds")
	})
}

func testPostStoreGetPostsByIds(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3, err = ss.Post().Save(o3)
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

	err = ss.Post().Delete(ro1.Id, model.GetMillis(), "")
	require.NoError(t, err)

	posts, err = ss.Post().GetPostsByIds(postIds)
	require.NoError(t, err)
	require.Len(t, posts, 3, "Expected 3 posts in results. Got %v", len(posts))
}

func testPostStoreGetPostsBatchForIndexing(t *testing.T, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = NewTestId()
	c1.Type = model.ChannelTypeOpen
	c1, _ = ss.Channel().Save(c1, -1)

	c2 := &model.Channel{}
	c2.TeamId = model.NewId()
	c2.DisplayName = "Channel2"
	c2.Name = NewTestId()
	c2.Type = model.ChannelTypeOpen
	c2, _ = ss.Channel().Save(c2, -1)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1, err := ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = c2.Id
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	_, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = c1.Id
	o3.UserId = model.NewId()
	o3.RootId = o1.Id
	o3.Message = NewTestId()
	_, err = ss.Post().Save(o3)
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

func testPostStorePermanentDeleteBatch(t *testing.T, ss store.Store) {
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)
	channel, err := ss.Channel().Save(&model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = channel.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1.CreateAt = 1000
	o1, err = ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = channel.Id
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.CreateAt = 1000
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	o3 := &model.Post{}
	o3.ChannelId = channel.Id
	o3.UserId = model.NewId()
	o3.Message = NewTestId()
	o3.CreateAt = 100000
	o3, err = ss.Post().Save(o3)
	require.NoError(t, err)

	_, _, err = ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2000, 1000, model.RetentionPolicyCursor{})
	require.NoError(t, err)

	_, err = ss.Post().Get(context.Background(), o1.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Should have not found post 1 after purge")

	_, err = ss.Post().Get(context.Background(), o2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.Error(t, err, "Should have not found post 2 after purge")

	_, err = ss.Post().Get(context.Background(), o3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err, "Should have found post 3 after purge")

	t.Run("with pagination", func(t *testing.T) {
		for i := 0; i < 3; i++ {
			_, err = ss.Post().Save(&model.Post{
				ChannelId: channel.Id,
				UserId:    model.NewId(),
				Message:   "message",
				CreateAt:  1,
			})
			require.NoError(t, err)
		}
		cursor := model.RetentionPolicyCursor{}

		deleted, cursor, err := ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2, 2, cursor)
		require.NoError(t, err)
		require.Equal(t, int64(2), deleted)

		deleted, _, err = ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2, 2, cursor)
		require.NoError(t, err)
		require.Equal(t, int64(1), deleted)
	})

	t.Run("with data retention policies", func(t *testing.T) {
		channelPolicy, err2 := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "DisplayName",
				PostDurationDays: model.NewInt64(30),
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
		post, err2 = ss.Post().Save(post)
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
				PostDurationDays: model.NewInt64(20),
			},
			TeamIDs: []string{team.Id},
		})
		require.NoError(t, err2)
		post.Id = ""
		post, err2 = ss.Post().Save(post)
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
	})

	t.Run("with channel, team and global policies", func(t *testing.T) {
		c1 := &model.Channel{}
		c1.TeamId = model.NewId()
		c1.DisplayName = "Channel1"
		c1.Name = NewTestId()
		c1.Type = model.ChannelTypeOpen
		c1, _ = ss.Channel().Save(c1, -1)

		c2 := &model.Channel{}
		c2.TeamId = model.NewId()
		c2.DisplayName = "Channel2"
		c2.Name = NewTestId()
		c2.Type = model.ChannelTypeOpen
		c2, _ = ss.Channel().Save(c2, -1)

		channelPolicy, err2 := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "DisplayName",
				PostDurationDays: model.NewInt64(30),
			},
			ChannelIDs: []string{c1.Id},
		})
		require.NoError(t, err2)
		defer ss.RetentionPolicy().Delete(channelPolicy.ID)
		teamPolicy, err2 := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "DisplayName",
				PostDurationDays: model.NewInt64(30),
			},
			TeamIDs: []string{team.Id},
		})
		require.NoError(t, err2)
		defer ss.RetentionPolicy().Delete(teamPolicy.ID)

		// This one should be deleted by the channel policy
		_, err2 = ss.Post().Save(&model.Post{
			ChannelId: c1.Id,
			UserId:    model.NewId(),
			Message:   "message",
			CreateAt:  1,
		})
		require.NoError(t, err2)
		// This one, by the team policy
		_, err2 = ss.Post().Save(&model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   "message",
			CreateAt:  1,
		})
		require.NoError(t, err2)
		// This one, by the global policy
		_, err2 = ss.Post().Save(&model.Post{
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
	})
}

func testPostStoreGetOldest(t *testing.T, ss store.Store) {
	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = NewTestId()
	o0.CreateAt = 3
	o0, err := ss.Post().Save(o0)
	require.NoError(t, err)

	o1 := &model.Post{}
	o1.ChannelId = o0.Id
	o1.UserId = model.NewId()
	o1.Message = NewTestId()
	o1.CreateAt = 2
	o1, err = ss.Post().Save(o1)
	require.NoError(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = NewTestId()
	o2.CreateAt = 1
	o2, err = ss.Post().Save(o2)
	require.NoError(t, err)

	r1, err := ss.Post().GetOldest()

	require.NoError(t, err)
	assert.EqualValues(t, o2.Id, r1.Id)
}

func testGetMaxPostSize(t *testing.T, ss store.Store) {
	assert.Equal(t, model.PostMessageMaxRunesV2, ss.Post().GetMaxPostSize())
	assert.Equal(t, model.PostMessageMaxRunesV2, ss.Post().GetMaxPostSize())
}

func testPostStoreGetParentsForExportAfter(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = NewTestId()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	_, err := ss.Team().Save(&t1)
	require.NoError(t, err)

	c1 := model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel1"
	c1.Name = NewTestId()
	c1.Type = model.ChannelTypeOpen
	_, nErr := ss.Channel().Save(&c1, -1)
	require.NoError(t, nErr)

	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err = ss.User().Save(&u1)
	require.NoError(t, err)

	p1 := &model.Post{}
	p1.ChannelId = c1.Id
	p1.UserId = u1.Id
	p1.Message = NewTestId()
	p1.CreateAt = 1000
	p1, nErr = ss.Post().Save(p1)
	require.NoError(t, nErr)

	posts, err := ss.Post().GetParentsForExportAfter(10000, strings.Repeat("0", 26))
	assert.NoError(t, err)

	found := false
	for _, p := range posts {
		if p.Id == p1.Id {
			found = true
			assert.Equal(t, p.Id, p1.Id)
			assert.Equal(t, p.Message, p1.Message)
			assert.Equal(t, p.Username, u1.Username)
			assert.Equal(t, p.TeamName, t1.Name)
			assert.Equal(t, p.ChannelName, c1.Name)
		}
	}
	assert.True(t, found)
}

func testPostStoreGetRepliesForExport(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = NewTestId()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	_, err := ss.Team().Save(&t1)
	require.NoError(t, err)

	c1 := model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel1"
	c1.Name = NewTestId()
	c1.Type = model.ChannelTypeOpen
	_, nErr := ss.Channel().Save(&c1, -1)
	require.NoError(t, nErr)

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err = ss.User().Save(&u1)
	require.NoError(t, err)

	p1 := &model.Post{}
	p1.ChannelId = c1.Id
	p1.UserId = u1.Id
	p1.Message = NewTestId()
	p1.CreateAt = 1000
	p1, nErr = ss.Post().Save(p1)
	require.NoError(t, nErr)

	p2 := &model.Post{}
	p2.ChannelId = c1.Id
	p2.UserId = u1.Id
	p2.Message = NewTestId()
	p2.CreateAt = 1001
	p2.RootId = p1.Id
	p2, nErr = ss.Post().Save(p2)
	require.NoError(t, nErr)

	r1, err := ss.Post().GetRepliesForExport(p1.Id)
	assert.NoError(t, err)

	assert.Len(t, r1, 1)

	reply1 := r1[0]
	assert.Equal(t, reply1.Id, p2.Id)
	assert.Equal(t, reply1.Message, p2.Message)
	assert.Equal(t, reply1.Username, u1.Username)

	// Checking whether replies by deleted user are exported
	u1.DeleteAt = 1002
	_, err = ss.User().Update(&u1, false)
	require.NoError(t, err)

	r1, err = ss.Post().GetRepliesForExport(p1.Id)
	assert.NoError(t, err)

	assert.Len(t, r1, 1)

	reply1 = r1[0]
	assert.Equal(t, reply1.Id, p2.Id)
	assert.Equal(t, reply1.Message, p2.Message)
	assert.Equal(t, reply1.Username, u1.Username)

}

func testPostStoreGetDirectPostParentsForExportAfter(t *testing.T, ss store.Store, s SqlStore) {
	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = NewTestId()
	o1.Type = model.ChannelTypeDirect

	u1 := &model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	ss.Channel().SaveDirectChannel(&o1, &m1, &m2)

	p1 := &model.Post{}
	p1.ChannelId = o1.Id
	p1.UserId = u1.Id
	p1.Message = NewTestId()
	p1.CreateAt = 1000
	p1, nErr = ss.Post().Save(p1)
	require.NoError(t, nErr)

	r1, nErr := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26))
	assert.NoError(t, nErr)

	assert.Equal(t, p1.Message, r1[0].Message)

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMasterX().Exec("TRUNCATE Channels")
}

func testPostStoreGetDirectPostParentsForExportAfterDeleted(t *testing.T, ss store.Store, s SqlStore) {
	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = NewTestId()
	o1.Type = model.ChannelTypeDirect

	u1 := &model.User{}
	u1.DeleteAt = 1
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2 := &model.User{}
	u2.DeleteAt = 1
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	ss.Channel().SaveDirectChannel(&o1, &m1, &m2)

	o1.DeleteAt = 1
	nErr = ss.Channel().SetDeleteAt(o1.Id, 1, 1)
	assert.NoError(t, nErr)

	p1 := &model.Post{}
	p1.ChannelId = o1.Id
	p1.UserId = u1.Id
	p1.Message = NewTestId()
	p1.CreateAt = 1000
	p1, nErr = ss.Post().Save(p1)
	require.NoError(t, nErr)

	o1a := p1.Clone()
	o1a.DeleteAt = 1
	o1a.Message = p1.Message + "BBBBBBBBBB"
	_, nErr = ss.Post().Update(o1a, p1)
	require.NoError(t, nErr)

	r1, nErr := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26))
	assert.NoError(t, nErr)

	assert.Equal(t, 0, len(r1))

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMasterX().Exec("TRUNCATE Channels")
}

func testPostStoreGetDirectPostParentsForExportAfterBatched(t *testing.T, ss store.Store, s SqlStore) {
	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = NewTestId()
	o1.Type = model.ChannelTypeDirect

	var postIds []string
	for i := 0; i < 150; i++ {
		u1 := &model.User{}
		u1.Email = MakeEmail()
		u1.Nickname = model.NewId()
		_, err := ss.User().Save(u1)
		require.NoError(t, err)
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
		require.NoError(t, nErr)

		u2 := &model.User{}
		u2.Email = MakeEmail()
		u2.Nickname = model.NewId()
		_, err = ss.User().Save(u2)
		require.NoError(t, err)
		_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
		require.NoError(t, nErr)

		m1 := model.ChannelMember{}
		m1.ChannelId = o1.Id
		m1.UserId = u1.Id
		m1.NotifyProps = model.GetDefaultChannelNotifyProps()

		m2 := model.ChannelMember{}
		m2.ChannelId = o1.Id
		m2.UserId = u2.Id
		m2.NotifyProps = model.GetDefaultChannelNotifyProps()

		ss.Channel().SaveDirectChannel(&o1, &m1, &m2)

		p1 := &model.Post{}
		p1.ChannelId = o1.Id
		p1.UserId = u1.Id
		p1.Message = NewTestId()
		p1.CreateAt = 1000
		p1, nErr = ss.Post().Save(p1)
		require.NoError(t, nErr)
		postIds = append(postIds, p1.Id)
	}
	sort.Slice(postIds, func(i, j int) bool { return postIds[i] < postIds[j] })

	// Get all posts
	r1, err := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26))
	assert.NoError(t, err)
	assert.Equal(t, len(postIds), len(r1))
	var exportedPostIds []string
	for i := range r1 {
		exportedPostIds = append(exportedPostIds, r1[i].Id)
	}
	sort.Slice(exportedPostIds, func(i, j int) bool { return exportedPostIds[i] < exportedPostIds[j] })
	assert.ElementsMatch(t, postIds, exportedPostIds)

	// Get 100
	r1, err = ss.Post().GetDirectPostParentsForExportAfter(100, strings.Repeat("0", 26))
	assert.NoError(t, err)
	assert.Equal(t, 100, len(r1))
	exportedPostIds = []string{}
	for i := range r1 {
		exportedPostIds = append(exportedPostIds, r1[i].Id)
	}
	sort.Slice(exportedPostIds, func(i, j int) bool { return exportedPostIds[i] < exportedPostIds[j] })
	assert.ElementsMatch(t, postIds[:100], exportedPostIds)

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMasterX().Exec("TRUNCATE Channels")
}

func testHasAutoResponsePostByUserSince(t *testing.T, ss store.Store) {
	t.Run("should return posts created after the given time", func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		_, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		// We need to sleep because SendAutoResponseIfNecessary
		// runs in a goroutine.
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "auto response message",
			Type:      model.PostTypeAutoResponder,
		})
		require.NoError(t, err)
		time.Sleep(time.Millisecond)

		exists, err := ss.Post().HasAutoResponsePostByUserSince(model.GetPostsSinceOptions{ChannelId: channelId, Time: post2.CreateAt}, userId)
		require.NoError(t, err)
		assert.True(t, exists)

		err = ss.Post().Delete(post3.Id, time.Now().Unix(), userId)
		require.NoError(t, err)

		exists, err = ss.Post().HasAutoResponsePostByUserSince(model.GetPostsSinceOptions{ChannelId: channelId, Time: post2.CreateAt}, userId)
		require.NoError(t, err)
		assert.False(t, exists)
	})
}

func testGetPostsSinceForSync(t *testing.T, ss store.Store, s SqlStore) {
	// create some posts.
	channelID := model.NewId()
	remoteID := model.NewString(model.NewId())
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
			p.RemoteId = model.NewString(model.NewId())
		}
		_, err := ss.Post().Save(p)
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
		result, err := s.GetMasterX().Exec("UPDATE Posts SET UpdateAt = ?", model.GetMillis())
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

func testSetPostReminder(t *testing.T, ss store.Store, s SqlStore) {
	// Basic
	userID := NewTestId()

	p1 := &model.Post{
		UserId:    userID,
		ChannelId: NewTestId(),
		Message:   "hi there",
		Type:      model.PostTypeDefault,
	}
	p1, err := ss.Post().Save(p1)
	require.NoError(t, err)

	reminder := &model.PostReminder{
		TargetTime: 1234,
		PostId:     p1.Id,
		UserId:     userID,
	}

	require.NoError(t, ss.Post().SetPostReminder(reminder))

	out := model.PostReminder{}
	require.NoError(t, s.GetMasterX().Get(&out, `SELECT PostId, UserId, TargetTime FROM PostReminders WHERE PostId=? AND UserId=?`, reminder.PostId, reminder.UserId))
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
	require.NoError(t, s.GetMasterX().Get(&out, `SELECT PostId, UserId, TargetTime FROM PostReminders WHERE PostId=? AND UserId=?`, reminder.PostId, reminder.UserId))
	assert.Equal(t, reminder, &out)
}

func testGetPostReminders(t *testing.T, ss store.Store, s SqlStore) {
	times := []int64{100, 101, 102}
	for _, tt := range times {
		userID := NewTestId()

		p1 := &model.Post{
			UserId:    userID,
			ChannelId: NewTestId(),
			Message:   "hi there",
			Type:      model.PostTypeDefault,
		}
		p1, err := ss.Post().Save(p1)
		require.NoError(t, err)

		reminder := &model.PostReminder{
			TargetTime: tt,
			PostId:     p1.Id,
			UserId:     userID,
		}

		require.NoError(t, ss.Post().SetPostReminder(reminder))
	}

	reminders, err := ss.Post().GetPostReminders(102)
	require.NoError(t, err)
	require.Len(t, reminders, 2)

	// assert one reminder is left
	reminders, err = ss.Post().GetPostReminders(103)
	require.NoError(t, err)
	require.Len(t, reminders, 1)

	// assert everything is deleted.
	reminders, err = ss.Post().GetPostReminders(103)
	require.NoError(t, err)
	require.Len(t, reminders, 0)
}

func testGetPostReminderMetadata(t *testing.T, ss store.Store, s SqlStore) {
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
		Name:        NewTestId(),
		Type:        model.ChannelTypeOpen,
	}
	ch, err = ss.Channel().Save(ch, -1)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		Locale:   "es",
	}

	u1, err = ss.User().Save(u1)
	require.NoError(t, err)

	p1 := &model.Post{
		UserId:    u1.Id,
		ChannelId: ch.Id,
		Message:   "hi there",
		Type:      model.PostTypeDefault,
	}
	p1, err = ss.Post().Save(p1)
	require.NoError(t, err)

	meta, err := ss.Post().GetPostReminderMetadata(p1.Id)
	require.NoError(t, err)
	assert.Equal(t, meta.ChannelId, ch.Id)
	assert.Equal(t, meta.TeamName, team.Name)
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

func testGetNthRecentPostTime(t *testing.T, ss store.Store) {
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
	p1, err = ss.Post().Save(p1)
	require.NoError(t, err)

	p2 := &model.Post{}
	p2.ChannelId = p1.ChannelId
	p2.UserId = p1.UserId
	p2.Message = p1.Message
	now = now + diff
	p2.CreateAt = now
	p2, err = ss.Post().Save(p2)
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
	_, err = ss.Post().Save(b1)
	require.NoError(t, err)

	p3 := &model.Post{}
	p3.ChannelId = p1.ChannelId
	p3.UserId = p1.UserId
	p3.Message = p1.Message
	now = now + diff
	p3.CreateAt = now
	p3, err = ss.Post().Save(p3)
	require.NoError(t, err)

	s1 := &model.Post{}
	s1.Type = model.PostTypeJoinChannel
	s1.ChannelId = p1.ChannelId
	s1.UserId = model.NewId()
	s1.Message = "system_join_channel message"
	now = now + diff
	s1.CreateAt = now
	_, err = ss.Post().Save(s1)
	require.NoError(t, err)

	p4 := &model.Post{}
	p4.ChannelId = p1.ChannelId
	p4.UserId = p1.UserId
	p4.Message = p1.Message
	now = now + diff
	p4.CreateAt = now
	p4, err = ss.Post().Save(p4)
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

func testGetTopDMsForUserSince(t *testing.T, ss store.Store, s SqlStore) {
	// users
	user := model.User{Email: MakeEmail(), Username: model.NewId()}
	u1 := model.User{Email: MakeEmail(), Username: model.NewId()}
	u2 := model.User{Email: MakeEmail(), Username: model.NewId()}
	u3 := model.User{Email: MakeEmail(), Username: model.NewId()}
	u4 := model.User{Email: MakeEmail(), Username: model.NewId()}
	u5 := model.User{Email: MakeEmail(), Username: model.NewId()}

	_, err := ss.User().Save(&user)
	require.NoError(t, err)
	_, err = ss.User().Save(&u1)
	require.NoError(t, err)
	_, err = ss.User().Save(&u2)
	require.NoError(t, err)
	_, err = ss.User().Save(&u3)
	require.NoError(t, err)
	_, err = ss.User().Save(&u4)
	require.NoError(t, err)
	_, err = ss.User().Save(&u5)
	require.NoError(t, err)
	bot := &model.Bot{
		Username:    "bot_user",
		Description: "bot",
		OwnerId:     model.NewId(),
		UserId:      u5.Id,
	}

	savedBot, nErr := ss.Bot().Save(bot)
	require.NoError(t, nErr)
	// user direct messages
	chUser1, nErr := ss.Channel().CreateDirectChannel(&u1, &user)
	require.NoError(t, nErr)
	chUser2, nErr := ss.Channel().CreateDirectChannel(&u2, &user)
	require.NoError(t, nErr)
	chUser3, nErr := ss.Channel().CreateDirectChannel(&u3, &user)
	require.NoError(t, nErr)
	// other user direct message
	chUser3User4, nErr := ss.Channel().CreateDirectChannel(&u3, &u4)
	require.NoError(t, nErr)

	// bot direct message - should be ignored by top DMs
	botUser, err := ss.User().Get(context.Background(), savedBot.UserId)
	require.NoError(t, err)
	chBot, nErr := ss.Channel().CreateDirectChannel(&user, botUser)
	require.NoError(t, nErr)
	_, err = ss.Post().Save(&model.Post{
		ChannelId: chBot.Id,
		UserId:    botUser.Id,
	})
	require.NoError(t, err)

	// sample post data
	// for u1
	_, err = ss.Post().Save(&model.Post{
		ChannelId: chUser1.Id,
		UserId:    u1.Id,
	})
	require.NoError(t, err)
	_, err = ss.Post().Save(&model.Post{
		ChannelId: chUser1.Id,
		UserId:    user.Id,
	})
	require.NoError(t, err)
	// for u2: 1 post
	postToDelete, err := ss.Post().Save(&model.Post{
		ChannelId: chUser2.Id,
		UserId:    u2.Id,
	})
	require.NoError(t, err)
	// create second post for u2: modify create at to a very old date to make sure it isn't counted
	_, err = ss.Post().Save(&model.Post{
		ChannelId: chUser2.Id,
		UserId:    u2.Id,
		CreateAt:  100,
	})
	require.NoError(t, err)
	// for user-u3: 3 posts
	for i := 0; i < 3; i++ {
		_, err = ss.Post().Save(&model.Post{
			ChannelId: chUser3.Id,
			UserId:    user.Id,
		})
		require.NoError(t, err)
	}
	// for u4-u3: 4 posts
	_, err = ss.Post().Save(&model.Post{
		ChannelId: chUser3User4.Id,
		UserId:    u3.Id,
	})
	require.NoError(t, err)
	_, err = ss.Post().Save(&model.Post{
		ChannelId: chUser3User4.Id,
		UserId:    u4.Id,
	})
	require.NoError(t, err)
	_, err = ss.Post().Save(&model.Post{
		ChannelId: chUser3User4.Id,
		UserId:    u3.Id,
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(&model.Post{
		ChannelId: chUser3User4.Id,
		UserId:    u4.Id,
	})
	require.NoError(t, err)
	t.Run("should return topDMs when userid is specified ", func(t *testing.T) {
		topDMs, storeErr := ss.Post().GetTopDMsForUserSince(user.Id, 100, 0, 100)
		require.NoError(t, storeErr)
		// len of topDMs.Items should be 3
		require.Len(t, topDMs.Items, 3)
		// check order, magnitude of items
		require.Equal(t, topDMs.Items[0].SecondParticipant.Id, u3.Id)
		require.Equal(t, topDMs.Items[0].MessageCount, int64(3))
		require.Equal(t, topDMs.Items[0].OutgoingMessageCount, int64(3))
		require.Equal(t, topDMs.Items[1].SecondParticipant.Id, u1.Id)
		require.Equal(t, topDMs.Items[1].MessageCount, int64(2))
		require.Equal(t, topDMs.Items[1].OutgoingMessageCount, int64(1))
		require.Equal(t, topDMs.Items[2].SecondParticipant.Id, u2.Id)
		require.Equal(t, topDMs.Items[2].MessageCount, int64(1))
		require.Equal(t, topDMs.Items[2].OutgoingMessageCount, int64(0))
		// this also ensures that u3-u4 conversation doesn't show up in others' top DMs.
	})
	t.Run("topDMs should only consider user's DM channels ", func(t *testing.T) {
		// u4 only takes part in one conversation
		topDMs, storeErr := ss.Post().GetTopDMsForUserSince(u4.Id, 100, 0, 100)
		require.NoError(t, storeErr)
		// len of topDMs.Items should be 3
		require.Len(t, topDMs.Items, 1)
		// check order, magnitude of items
		require.Equal(t, topDMs.Items[0].SecondParticipant.Id, u3.Id)
		require.Equal(t, topDMs.Items[0].MessageCount, int64(4))
	})
	t.Run("topDMs will not consider self dms", func(t *testing.T) {
		chUser, nErr := ss.Channel().CreateDirectChannel(&user, &user)
		require.NoError(t, nErr)
		_, err = ss.Post().Save(&model.Post{
			ChannelId: chUser.Id,
			UserId:    user.Id,
		})
		// delete u2 post
		err := ss.Post().Delete(postToDelete.Id, 200, user.Id)
		require.NoError(t, err)
		// u4 only takes part in one conversation
		topDMs, err := ss.Post().GetTopDMsForUserSince(user.Id, 100, 0, 100)
		require.NoError(t, err)
		// len of topDMs.Items should be 3
		require.Len(t, topDMs.Items, 2)
	})
}
