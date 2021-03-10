// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func TestThreadStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("ThreadStorePopulation", func(t *testing.T) { testThreadStorePopulation(t, ss) })
	t.Run("ThreadStorePermanentDeleteBatchThreadsForRetentionPolicies", func(t *testing.T) {
		testThreadStorePermanentDeleteBatchThreadsForRetentionPolicies(t, ss)
	})
	t.Run("ThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies", func(t *testing.T) {
		testThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies(t, ss)
	})
}

func testThreadStorePopulation(t *testing.T, ss store.Store) {
	makeSomePosts := func() []*model.Post {

		u1 := model.User{
			Email:    MakeEmail(),
			Username: model.NewId(),
		}

		u, err := ss.User().Save(&u1)
		require.NoError(t, err)

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
			MsgCount:    0,
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

		olist, _ := ss.Post().Get(otmp.Id, true, false, false)
		o1 := olist.Posts[olist.Order[0]]

		newPosts = append([]*model.Post{o1}, newPosts...)
		require.NoError(t, err3, "couldn't save item")
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
		require.NoError(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(2), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId}, thread.Participants)

		o5 := model.Post{}
		o5.ChannelId = model.NewId()
		o5.UserId = model.NewId()
		o5.RootId = newPosts[0].Id
		o5.Message = "zz" + model.NewId() + "b"

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&o5})
		require.NoError(t, err, "couldn't save item")

		thread, err = ss.Thread().Get(newPosts[0].Id)
		require.NoError(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(3), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId, o5.UserId}, thread.Participants)
	})

	t.Run("Delete a reply updates count on a thread", func(t *testing.T) {
		newPosts := makeSomePosts()
		thread, err := ss.Thread().Get(newPosts[0].Id)
		require.NoError(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(2), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId}, thread.Participants)

		err = ss.Post().Delete(newPosts[1].Id, 1234, model.NewId())
		require.NoError(t, err, "couldn't delete post")

		thread, err = ss.Thread().Get(newPosts[0].Id)
		require.NoError(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(1), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId}, thread.Participants)
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
		require.NoError(t, err)

		thread1, err := ss.Thread().Get(newPosts[0].RootId)
		require.NoError(t, err)

		rrootPost, err := ss.Post().GetSingle(rootPost.Id)
		require.NoError(t, err)
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
		require.NoError(t, err)

		rrootPost2, err := ss.Post().GetSingle(rootPost.Id)
		require.NoError(t, err)
		require.Greater(t, rrootPost2.UpdateAt, rrootPost.UpdateAt)

		thread2, err := ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
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
		require.NoError(t, err)

		thread1, err := ss.Thread().Get(newPosts[0].RootId)
		require.NoError(t, err)
		require.EqualValues(t, thread1.ReplyCount, 2)
		require.Len(t, thread1.Participants, 2)

		err = ss.Post().Delete(replyPost.Id, 123, model.NewId())
		require.NoError(t, err)

		thread2, err := ss.Thread().Get(rootPost.RootId)
		require.NoError(t, err)
		require.EqualValues(t, thread2.ReplyCount, 1)
		require.Len(t, thread2.Participants, 2)
	})

	t.Run("Deleting root post should delete the thread", func(t *testing.T) {
		rootPost := model.Post{}
		rootPost.ChannelId = model.NewId()
		rootPost.UserId = model.NewId()
		rootPost.Message = "zz" + model.NewId() + "b"

		newPosts1, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost})
		require.NoError(t, err)

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = "zz" + model.NewId() + "b"
		replyPost.RootId = newPosts1[0].Id

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&replyPost})
		require.NoError(t, err)

		thread1, err := ss.Thread().Get(newPosts1[0].Id)
		require.NoError(t, err)
		require.EqualValues(t, thread1.ReplyCount, 1)
		require.Len(t, thread1.Participants, 2)

		err = ss.Post().PermanentDeleteByUser(rootPost.UserId)
		require.NoError(t, err)

		thread2, _ := ss.Thread().Get(rootPost.Id)
		require.Nil(t, thread2)
	})

	t.Run("Thread last updated is changed when channel is updated after UpdateLastViewedAtPost", func(t *testing.T) {
		newPosts := makeSomePosts()

		require.NoError(t, ss.Thread().CreateMembershipIfNeeded(newPosts[0].UserId, newPosts[0].Id, true, false, true))
		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.NoError(t, err1)
		m.LastUpdated -= 1000
		_, err := ss.Thread().UpdateMembership(m)
		require.NoError(t, err)

		_, err = ss.Channel().UpdateLastViewedAtPost(newPosts[0], newPosts[0].UserId, 0, true)
		require.NoError(t, err)

		assert.Eventually(t, func() bool {
			m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
			require.NoError(t, err2)
			return m2.LastUpdated > m.LastUpdated
		}, time.Second, 10*time.Millisecond)
	})

	t.Run("Thread last updated is changed when channel is updated after IncrementMentionCount", func(t *testing.T) {
		newPosts := makeSomePosts()

		require.NoError(t, ss.Thread().CreateMembershipIfNeeded(newPosts[0].UserId, newPosts[0].Id, true, false, true))
		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.NoError(t, err1)
		m.LastUpdated -= 1000
		_, err := ss.Thread().UpdateMembership(m)
		require.NoError(t, err)

		err = ss.Channel().IncrementMentionCount(newPosts[0].ChannelId, newPosts[0].UserId, true)
		require.NoError(t, err)

		assert.Eventually(t, func() bool {
			m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
			require.NoError(t, err2)
			return m2.LastUpdated > m.LastUpdated
		}, time.Second, 10*time.Millisecond)
	})

	t.Run("Thread last updated is changed when channel is updated after UpdateLastViewedAt", func(t *testing.T) {
		newPosts := makeSomePosts()

		require.NoError(t, ss.Thread().CreateMembershipIfNeeded(newPosts[0].UserId, newPosts[0].Id, true, false, true))
		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.NoError(t, err1)
		m.LastUpdated -= 1000
		_, err := ss.Thread().UpdateMembership(m)
		require.NoError(t, err)

		_, err = ss.Channel().UpdateLastViewedAt([]string{newPosts[0].ChannelId}, newPosts[0].UserId, true)
		require.NoError(t, err)

		assert.Eventually(t, func() bool {
			m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
			require.NoError(t, err2)
			return m2.LastUpdated > m.LastUpdated
		}, time.Second, 10*time.Millisecond)
	})

	t.Run("Thread last updated is changed when channel is updated after UpdateLastViewedAtPost for mark unread", func(t *testing.T) {
		newPosts := makeSomePosts()

		require.NoError(t, ss.Thread().CreateMembershipIfNeeded(newPosts[0].UserId, newPosts[0].Id, true, false, true))
		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.NoError(t, err1)
		m.LastUpdated += 1000
		_, err := ss.Thread().UpdateMembership(m)
		require.NoError(t, err)

		_, err = ss.Channel().UpdateLastViewedAtPost(newPosts[0], newPosts[0].UserId, 0, true)
		require.NoError(t, err)

		assert.Eventually(t, func() bool {
			m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
			require.NoError(t, err2)
			return m2.LastUpdated < m.LastUpdated
		}, time.Second, 10*time.Millisecond)
	})
}

func threadStoreCreateReply(t *testing.T, ss store.Store, channelID, postID string, createAt int64) *model.Post {
	reply, err := ss.Post().Save(&model.Post{
		ChannelId: channelID,
		UserId:    model.NewId(),
		CreateAt:  createAt,
		RootId:    postID,
		ParentId:  postID,
	})
	require.Nil(t, err)
	return reply
}

func testThreadStorePermanentDeleteBatchThreadsForRetentionPolicies(t *testing.T, ss store.Store) {
	const limit = 1000
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	})
	require.Nil(t, err)
	channel, err := ss.Channel().Save(&model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}, -1)
	require.Nil(t, err)

	post, err := ss.Post().Save(&model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
	})
	require.Nil(t, err)
	threadStoreCreateReply(t, ss, channel.Id, post.Id, 2000)

	thread, err := ss.Thread().Get(post.Id)
	require.Nil(t, err)

	channelPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:  "DisplayName",
			PostDuration: 30,
		},
		ChannelIDs: []string{channel.Id},
	})
	require.Nil(t, err)

	nowMillis := thread.LastReplyAt + channelPolicy.PostDuration*24*60*60*1000 + 1
	_, err = ss.Thread().PermanentDeleteBatchThreadsForRetentionPolicies(nowMillis, limit)
	require.Nil(t, err)
	_, err = ss.Thread().Get(post.Id)
	require.NotNil(t, err, "thread should have been deleted by channel policy")

	// create a new thread
	threadStoreCreateReply(t, ss, channel.Id, post.Id, 2000)
	thread, err = ss.Thread().Get(post.Id)
	require.Nil(t, err)

	// Create a team policy which is stricter than the channel policy
	teamPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:  "DisplayName",
			PostDuration: 20,
		},
		TeamIDs: []string{team.Id},
	})
	require.Nil(t, err)

	nowMillis = thread.LastReplyAt + teamPolicy.PostDuration*24*60*60*1000 + 1
	_, err = ss.Thread().PermanentDeleteBatchThreadsForRetentionPolicies(nowMillis, limit)
	require.Nil(t, err)
	_, err = ss.Thread().Get(post.Id)
	require.Nil(t, err, "channel policy should have overridden team policy")

	// Delete channel policy and re-run team policy
	err = ss.RetentionPolicy().Delete(channelPolicy.ID)
	require.Nil(t, err)
	_, err = ss.Thread().PermanentDeleteBatchThreadsForRetentionPolicies(nowMillis, limit)
	require.Nil(t, err)
	_, err = ss.Thread().Get(post.Id)
	require.NotNil(t, err, "thread should have been deleted by team policy")
}

func testThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies(t *testing.T, ss store.Store) {
	const limit = 1000
	userID := model.NewId()
	createThreadMembership := func(userID, postID string) *model.ThreadMembership {
		err := ss.Thread().CreateMembershipIfNeeded(userID, postID, true, false, true)
		require.Nil(t, err)
		threadMembership, err := ss.Thread().GetMembershipForUser(userID, postID)
		require.Nil(t, err)
		return threadMembership
	}
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	})
	require.Nil(t, err)
	channel, err := ss.Channel().Save(&model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}, -1)
	require.Nil(t, err)
	post, err := ss.Post().Save(&model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
	})
	require.Nil(t, err)
	threadStoreCreateReply(t, ss, channel.Id, post.Id, 2000)

	threadMembership := createThreadMembership(userID, post.Id)

	channelPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:  "DisplayName",
			PostDuration: 30,
		},
		ChannelIDs: []string{channel.Id},
	})
	require.Nil(t, err)

	nowMillis := threadMembership.LastUpdated + channelPolicy.PostDuration*24*60*60*1000 + 1
	_, err = ss.Thread().PermanentDeleteBatchThreadMembershipsForRetentionPolicies(nowMillis, limit)
	require.Nil(t, err)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.NotNil(t, err, "thread membership should have been deleted by channel policy")

	// create a new thread membership
	threadMembership = createThreadMembership(userID, post.Id)

	// Create a team policy which is stricter than the channel policy
	teamPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:  "DisplayName",
			PostDuration: 20,
		},
		TeamIDs: []string{team.Id},
	})
	require.Nil(t, err)

	nowMillis = threadMembership.LastUpdated + teamPolicy.PostDuration*24*60*60*1000 + 1
	_, err = ss.Thread().PermanentDeleteBatchThreadMembershipsForRetentionPolicies(nowMillis, limit)
	require.Nil(t, err)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.Nil(t, err, "channel policy should have overridden team policy")

	// Delete channel policy and re-run team policy
	err = ss.RetentionPolicy().Delete(channelPolicy.ID)
	require.Nil(t, err)
	_, err = ss.Thread().PermanentDeleteBatchThreadMembershipsForRetentionPolicies(nowMillis, limit)
	require.Nil(t, err)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.NotNil(t, err, "thread membership should have been deleted by team policy")

	// create a new thread membership
	threadMembership = createThreadMembership(userID, post.Id)

	// Delete team policy and thread
	err = ss.RetentionPolicy().Delete(teamPolicy.ID)
	require.Nil(t, err)
	err = ss.Thread().Delete(post.Id)
	require.Nil(t, err)

	nowMillis = threadMembership.LastUpdated + teamPolicy.PostDuration*24*60*60*1000 + 1
	_, err = ss.Thread().PermanentDeleteBatchThreadMembershipsForRetentionPolicies(nowMillis, limit)
	require.Nil(t, err)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.NotNil(t, err, "thread membership should have been deleted because thread no longer exists")
}
