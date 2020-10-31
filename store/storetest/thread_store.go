// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestThreadStore(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("ThreadStorePopulation", func(t *testing.T) { testThreadStorePopulation(t, ss) })
}

func testThreadStorePopulation(t *testing.T, ss store.Store) {
	makeSomePosts := func() []*model.Post {

		u1 := model.User{
			Email:    MakeEmail(),
			Username: model.NewId(),
		}

		u, err := ss.User().Save(&u1)
		require.Nil(t, err)

		c, err2 := ss.Channel().Save(&model.Channel{
			DisplayName: model.NewId(),
			Type:        model.CHANNEL_OPEN,
			Name:        model.NewId(),
		}, 999)
		require.NoError(t, err2)

		_, err44 := ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   c.Id,
			UserId:      u1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			MsgCount:    90,
		})
		require.NoError(t, err44)
		o := model.Post{}
		o.ChannelId = c.Id
		o.UserId = u.Id
		o.Message = "zz" + model.NewId() + "b"

		otmp, err3 := ss.Post().Save(&o)
		require.NoError(t, err3)
		o2 := model.Post{}
		o2.ChannelId = c.Id
		o2.UserId = model.NewId()
		o2.RootId = otmp.Id
		o2.Message = "zz" + model.NewId() + "b"

		o3 := model.Post{}
		o3.ChannelId = c.Id
		o3.UserId = u.Id
		o3.RootId = otmp.Id
		o3.Message = "zz" + model.NewId() + "b"

		o4 := model.Post{}
		o4.ChannelId = c.Id
		o4.UserId = model.NewId()
		o4.Message = "zz" + model.NewId() + "b"

		newPosts, errIdx, err3 := ss.Post().SaveMultiple([]*model.Post{&o2, &o3, &o4})

		olist, _ := ss.Post().Get(otmp.Id, true)
		o1 := olist.Posts[olist.Order[0]]

		newPosts = append([]*model.Post{o1}, newPosts...)
		require.Nil(t, err3, "couldn't save item")
		require.Equal(t, -1, errIdx)
		require.Len(t, newPosts, 4)
		require.Equal(t, int64(2), newPosts[0].ReplyCount)
		require.Equal(t, int64(2), newPosts[1].ReplyCount)
		require.Equal(t, int64(2), newPosts[2].ReplyCount)
		require.Equal(t, int64(0), newPosts[3].ReplyCount)

		return newPosts
	}
	t.Run("Save replies creates a thread", func(t *testing.T) {
		newPosts := makeSomePosts()
		thread, err := ss.Thread().Get(newPosts[0].Id)
		require.Nil(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(2), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId}, thread.Participants)

		o5 := model.Post{}
		o5.ChannelId = model.NewId()
		o5.UserId = model.NewId()
		o5.RootId = newPosts[0].Id
		o5.Message = "zz" + model.NewId() + "b"

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&o5})
		require.Nil(t, err, "couldn't save item")

		thread, err = ss.Thread().Get(newPosts[0].Id)
		require.Nil(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(3), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId, o5.UserId}, thread.Participants)
	})

	t.Run("Delete a reply updates count on a thread", func(t *testing.T) {
		newPosts := makeSomePosts()
		thread, err := ss.Thread().Get(newPosts[0].Id)
		require.Nil(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(2), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId}, thread.Participants)

		err = ss.Post().Delete(newPosts[1].Id, 1234, model.NewId())
		require.Nil(t, err, "couldn't delete post")

		thread, err = ss.Thread().Get(newPosts[0].Id)
		require.Nil(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(1), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId}, thread.Participants)
	})

	t.Run("Update reply should update the UpdateAt of the thread", func(t *testing.T) {
		rootPost := model.Post{}
		rootPost.RootId = model.NewId()
		rootPost.ChannelId = model.NewId()
		rootPost.UserId = model.NewId()
		rootPost.Message = "zz" + model.NewId() + "b"

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = "zz" + model.NewId() + "b"
		replyPost.RootId = rootPost.RootId

		newPosts, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost, &replyPost})
		require.Nil(t, err)

		thread1, err := ss.Thread().Get(newPosts[0].RootId)
		require.Nil(t, err)

		rrootPost, err := ss.Post().GetSingle(rootPost.Id)
		require.Nil(t, err)
		require.Equal(t, rrootPost.UpdateAt, rootPost.UpdateAt)

		replyPost2 := model.Post{}
		replyPost2.ChannelId = rootPost.ChannelId
		replyPost2.UserId = model.NewId()
		replyPost2.Message = "zz" + model.NewId() + "b"
		replyPost2.RootId = rootPost.Id

		replyPost3 := model.Post{}
		replyPost3.ChannelId = rootPost.ChannelId
		replyPost3.UserId = model.NewId()
		replyPost3.Message = "zz" + model.NewId() + "b"
		replyPost3.RootId = rootPost.Id

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&replyPost2, &replyPost3})
		require.Nil(t, err)

		rrootPost2, err := ss.Post().GetSingle(rootPost.Id)
		require.Nil(t, err)
		require.Greater(t, rrootPost2.UpdateAt, rrootPost.UpdateAt)

		thread2, err := ss.Thread().Get(rootPost.Id)
		require.Nil(t, err)
		require.Greater(t, thread2.LastReplyAt, thread1.LastReplyAt)
	})

	t.Run("Deleting reply should update the thread", func(t *testing.T) {
		rootPost := model.Post{}
		rootPost.RootId = model.NewId()
		rootPost.ChannelId = model.NewId()
		rootPost.UserId = model.NewId()
		rootPost.Message = "zz" + model.NewId() + "b"

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = "zz" + model.NewId() + "b"
		replyPost.RootId = rootPost.RootId

		newPosts, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost, &replyPost})
		require.Nil(t, err)

		thread1, err := ss.Thread().Get(newPosts[0].RootId)
		require.Nil(t, err)
		require.EqualValues(t, thread1.ReplyCount, 2)
		require.Len(t, thread1.Participants, 2)

		err = ss.Post().Delete(replyPost.Id, 123, model.NewId())
		require.Nil(t, err)

		thread2, err := ss.Thread().Get(rootPost.RootId)
		require.Nil(t, err)
		require.EqualValues(t, thread2.ReplyCount, 1)
		require.Len(t, thread2.Participants, 1)
	})

	t.Run("Deleting root post should delete the thread", func(t *testing.T) {
		rootPost := model.Post{}
		rootPost.ChannelId = model.NewId()
		rootPost.UserId = model.NewId()
		rootPost.Message = "zz" + model.NewId() + "b"

		newPosts1, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost})
		require.Nil(t, err)

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = "zz" + model.NewId() + "b"
		replyPost.RootId = newPosts1[0].Id

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&replyPost})
		require.Nil(t, err)

		thread1, err := ss.Thread().Get(newPosts1[0].Id)
		require.Nil(t, err)
		require.EqualValues(t, thread1.ReplyCount, 1)
		require.Len(t, thread1.Participants, 1)

		err = ss.Post().Delete(rootPost.Id, 123, model.NewId())
		require.Nil(t, err)

		thread2, _ := ss.Thread().Get(rootPost.Id)
		require.Nil(t, thread2)
	})

	t.Run("Thread last updated is changed when channel is updated after UpdateLastViewedAtPost", func(t *testing.T) {
		newPosts := makeSomePosts()

		require.Nil(t, ss.Thread().CreateMembershipIfNeeded(newPosts[0].UserId, newPosts[0].Id))
		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.Nil(t, err1)
		m.LastUpdated -= 1000
		_, err := ss.Thread().UpdateMembership(m)
		require.Nil(t, err)

		_, err = ss.Channel().UpdateLastViewedAtPost(newPosts[0], newPosts[0].UserId, 0, true)
		require.Nil(t, err)

		assert.Eventually(t, func() bool {
			m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
			require.Nil(t, err2)
			return m2.LastUpdated > m.LastUpdated
		}, time.Second, 10*time.Millisecond)
	})

	t.Run("Thread last updated is changed when channel is updated after IncrementMentionCount", func(t *testing.T) {
		newPosts := makeSomePosts()

		require.Nil(t, ss.Thread().CreateMembershipIfNeeded(newPosts[0].UserId, newPosts[0].Id))
		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.Nil(t, err1)
		m.LastUpdated -= 1000
		_, err := ss.Thread().UpdateMembership(m)
		require.Nil(t, err)

		err = ss.Channel().IncrementMentionCount(newPosts[0].ChannelId, newPosts[0].UserId, true)
		require.Nil(t, err)

		assert.Eventually(t, func() bool {
			m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
			require.Nil(t, err2)
			return m2.LastUpdated > m.LastUpdated
		}, time.Second, 10*time.Millisecond)
	})

	t.Run("Thread last updated is changed when channel is updated after UpdateLastViewedAt", func(t *testing.T) {
		newPosts := makeSomePosts()

		require.Nil(t, ss.Thread().CreateMembershipIfNeeded(newPosts[0].UserId, newPosts[0].Id))
		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.Nil(t, err1)
		m.LastUpdated -= 1000
		_, err := ss.Thread().UpdateMembership(m)
		require.Nil(t, err)

		_, err = ss.Channel().UpdateLastViewedAt([]string{newPosts[0].ChannelId}, newPosts[0].UserId, true)
		require.Nil(t, err)

		assert.Eventually(t, func() bool {
			m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
			require.Nil(t, err2)
			return m2.LastUpdated > m.LastUpdated
		}, time.Second, 10*time.Millisecond)
	})

	t.Run("Thread last updated is changed when channel is updated after UpdateLastViewedAtPost for mark unread", func(t *testing.T) {
		newPosts := makeSomePosts()

		require.Nil(t, ss.Thread().CreateMembershipIfNeeded(newPosts[0].UserId, newPosts[0].Id))
		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.Nil(t, err1)
		m.LastUpdated += 1000
		_, err := ss.Thread().UpdateMembership(m)
		require.Nil(t, err)

		_, err = ss.Channel().UpdateLastViewedAtPost(newPosts[0], newPosts[0].UserId, 0, true)
		require.Nil(t, err)

		assert.Eventually(t, func() bool {
			m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
			require.Nil(t, err2)
			return m2.LastUpdated < m.LastUpdated
		}, time.Second, 10*time.Millisecond)
	})
}
