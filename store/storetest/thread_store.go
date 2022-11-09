// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

func TestThreadStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("ThreadStorePopulation", func(t *testing.T) { testThreadStorePopulation(t, ss) })
	t.Run("ThreadStorePermanentDeleteBatchForRetentionPolicies", func(t *testing.T) {
		testThreadStorePermanentDeleteBatchForRetentionPolicies(t, ss)
	})
	t.Run("ThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies", func(t *testing.T) {
		testThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies(t, ss, s)
	})
	t.Run("GetTeamsUnreadForUser", func(t *testing.T) { testGetTeamsUnreadForUser(t, ss) })
	t.Run("GetVarious", func(t *testing.T) { testVarious(t, ss) })
	t.Run("MarkAllAsReadByChannels", func(t *testing.T) { testMarkAllAsReadByChannels(t, ss) })
	t.Run("GetTopThreads", func(t *testing.T) { testGetTopThreads(t, ss) })
}

func testThreadStorePopulation(t *testing.T, ss store.Store) {
	makeSomePosts := func(urgent bool) []*model.Post {

		u1 := model.User{
			Email:    MakeEmail(),
			Username: model.NewId(),
		}

		u, err := ss.User().Save(&u1)
		require.NoError(t, err)

		c, err2 := ss.Channel().Save(&model.Channel{
			DisplayName: model.NewId(),
			Type:        model.ChannelTypeOpen,
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
		o.Message = NewTestId()

		if urgent {
			o.Metadata = &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewString("urgent"),
					RequestedAck:            model.NewBool(false),
					PersistentNotifications: model.NewBool(false),
				},
			}
		}

		otmp, err3 := ss.Post().Save(&o)
		require.NoError(t, err3)
		o2 := model.Post{}
		o2.ChannelId = c.Id
		o2.UserId = model.NewId()
		o2.RootId = otmp.Id
		o2.Message = NewTestId()

		o3 := model.Post{}
		o3.ChannelId = c.Id
		o3.UserId = u.Id
		o3.RootId = otmp.Id
		o3.Message = NewTestId()

		o4 := model.Post{}
		o4.ChannelId = c.Id
		o4.UserId = model.NewId()
		o4.Message = NewTestId()

		newPosts, errIdx, err3 := ss.Post().SaveMultiple([]*model.Post{&o2, &o3, &o4})

		opts := model.GetPostsOptions{
			SkipFetchThreads: true,
		}
		olist, _ := ss.Post().Get(context.Background(), otmp.Id, opts, "", map[string]bool{})
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
		newPosts := makeSomePosts(false)
		thread, err := ss.Thread().Get(newPosts[0].Id)
		require.NoError(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(2), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId}, thread.Participants)

		teamId := model.NewId()
		channel, err := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "DisplayName1",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o5 := model.Post{}
		o5.ChannelId = channel.Id
		o5.UserId = model.NewId()
		o5.RootId = newPosts[0].Id
		o5.Message = NewTestId()

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&o5})
		require.NoError(t, err, "couldn't save item")

		thread, err = ss.Thread().Get(newPosts[0].Id)
		require.NoError(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(3), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId, o5.UserId}, thread.Participants)
	})

	t.Run("Delete a reply updates count on a thread", func(t *testing.T) {
		newPosts := makeSomePosts(false)
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
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId}, thread.Participants)
	})

	t.Run("Update reply should update the UpdateAt of the thread", func(t *testing.T) {
		teamId := model.NewId()
		channel, err := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		rootPost := model.Post{}
		rootPost.RootId = model.NewId()
		rootPost.ChannelId = channel.Id
		rootPost.UserId = model.NewId()
		rootPost.Message = NewTestId()

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = NewTestId()
		replyPost.RootId = rootPost.RootId

		newPosts, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost, &replyPost})
		require.NoError(t, err)

		thread1, err := ss.Thread().Get(newPosts[0].RootId)
		require.NoError(t, err)

		rrootPost, err := ss.Post().GetSingle(rootPost.Id, false)
		require.NoError(t, err)
		require.Equal(t, rrootPost.UpdateAt, rootPost.UpdateAt)

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

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&replyPost2, &replyPost3})
		require.NoError(t, err)

		rrootPost2, err := ss.Post().GetSingle(rootPost.Id, false)
		require.NoError(t, err)
		require.Greater(t, rrootPost2.UpdateAt, rrootPost.UpdateAt)

		thread2, err := ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
		require.Greater(t, thread2.LastReplyAt, thread1.LastReplyAt)
	})

	t.Run("Deleting reply should update the thread", func(t *testing.T) {
		teamId := model.NewId()
		channel, err := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o1 := model.Post{}
		o1.ChannelId = channel.Id
		o1.UserId = model.NewId()
		o1.Message = NewTestId()
		rootPost, err := ss.Post().Save(&o1)
		require.NoError(t, err)

		o2 := model.Post{}
		o2.RootId = rootPost.Id
		o2.ChannelId = rootPost.ChannelId
		o2.UserId = model.NewId()
		o2.Message = NewTestId()
		replyPost, err := ss.Post().Save(&o2)
		require.NoError(t, err)

		o3 := model.Post{}
		o3.RootId = rootPost.Id
		o3.ChannelId = rootPost.ChannelId
		o3.UserId = o2.UserId
		o3.Message = NewTestId()
		replyPost2, err := ss.Post().Save(&o3)
		require.NoError(t, err)

		o4 := model.Post{}
		o4.RootId = rootPost.Id
		o4.ChannelId = rootPost.ChannelId
		o4.UserId = model.NewId()
		o4.Message = NewTestId()
		replyPost3, err := ss.Post().Save(&o4)
		require.NoError(t, err)

		thread, err := ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
		require.EqualValues(t, thread.ReplyCount, 3)
		require.EqualValues(t, thread.Participants, model.StringArray{replyPost.UserId, replyPost3.UserId})

		err = ss.Post().Delete(replyPost2.Id, 123, model.NewId())
		require.NoError(t, err)
		thread, err = ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
		require.EqualValues(t, thread.ReplyCount, 2)
		require.EqualValues(t, thread.Participants, model.StringArray{replyPost.UserId, replyPost3.UserId})

		err = ss.Post().Delete(replyPost.Id, 123, model.NewId())
		require.NoError(t, err)
		thread, err = ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
		require.EqualValues(t, thread.ReplyCount, 1)
		require.EqualValues(t, thread.Participants, model.StringArray{replyPost3.UserId})
	})

	t.Run("Deleting root post should delete the thread", func(t *testing.T) {
		teamId := model.NewId()
		channel, err := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		rootPost := model.Post{}
		rootPost.ChannelId = channel.Id
		rootPost.UserId = model.NewId()
		rootPost.Message = NewTestId()

		newPosts1, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost})
		require.NoError(t, err)

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = NewTestId()
		replyPost.RootId = newPosts1[0].Id

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&replyPost})
		require.NoError(t, err)

		thread1, err := ss.Thread().Get(newPosts1[0].Id)
		require.NoError(t, err)
		require.EqualValues(t, thread1.ReplyCount, 1)
		require.Len(t, thread1.Participants, 1)

		err = ss.Post().PermanentDeleteByUser(rootPost.UserId)
		require.NoError(t, err)

		thread2, _ := ss.Thread().Get(rootPost.Id)
		require.Nil(t, thread2)
	})

	t.Run("Thread membership 'viewed' timestamp is updated properly", func(t *testing.T) {
		newPosts := makeSomePosts(false)

		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    true,
		}
		tm, e := ss.Thread().MaintainMembership(newPosts[0].UserId, newPosts[0].Id, opts)
		require.NoError(t, e)
		require.Equal(t, int64(0), tm.LastViewed)

		// No update since array has same elements.
		th, e := ss.Thread().Get(newPosts[0].Id)
		require.NoError(t, e)
		assert.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId}, th.Participants)

		opts.UpdateViewedTimestamp = true
		_, e = ss.Thread().MaintainMembership(newPosts[0].UserId, newPosts[0].Id, opts)
		require.NoError(t, e)
		m2, err2 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.NoError(t, err2)
		require.Greater(t, m2.LastViewed, int64(0))

		// Adding a new participant
		_, e = ss.Thread().MaintainMembership("newuser", newPosts[0].Id, opts)
		require.NoError(t, e)
		th, e = ss.Thread().Get(newPosts[0].Id)
		require.NoError(t, e)
		assert.ElementsMatch(t, model.StringArray{newPosts[0].UserId, newPosts[1].UserId, "newuser"}, th.Participants)
	})

	t.Run("Thread membership 'viewed' timestamp is updated properly for new membership", func(t *testing.T) {
		newPosts := makeSomePosts(false)

		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       false,
			UpdateViewedTimestamp: true,
			UpdateParticipants:    false,
		}
		tm, e := ss.Thread().MaintainMembership(newPosts[0].UserId, newPosts[0].Id, opts)
		require.NoError(t, e)
		require.NotEqual(t, int64(0), tm.LastViewed)
	})

	t.Run("Updating post does not make thread unread", func(t *testing.T) {
		newPosts := makeSomePosts(false)
		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}
		m, err := ss.Thread().MaintainMembership(newPosts[0].UserId, newPosts[0].Id, opts)
		require.NoError(t, err)
		th, err := ss.Thread().GetThreadForUser(m, false)
		require.NoError(t, err)
		require.Equal(t, int64(2), th.UnreadReplies)

		m.LastViewed = newPosts[2].UpdateAt + 1
		_, err = ss.Thread().UpdateMembership(m)
		require.NoError(t, err)
		th, err = ss.Thread().GetThreadForUser(m, false)
		require.NoError(t, err)
		require.Equal(t, int64(0), th.UnreadReplies)

		editedPost := newPosts[2].Clone()
		editedPost.Message = "This is an edited post"
		_, err = ss.Post().Update(editedPost, newPosts[2])
		require.NoError(t, err)

		th, err = ss.Thread().GetThreadForUser(m, false)
		require.NoError(t, err)
		require.Equal(t, int64(0), th.UnreadReplies)
	})

	t.Run("Empty participantID should not appear in thread response", func(t *testing.T) {
		newPosts := makeSomePosts(false)
		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    true,
		}
		m, err := ss.Thread().MaintainMembership("", newPosts[0].Id, opts)
		require.NoError(t, err)
		m.UserId = newPosts[0].UserId
		th, err := ss.Thread().GetThreadForUser(m, true)
		require.NoError(t, err)
		for _, user := range th.Participants {
			require.NotNil(t, user)
		}
	})
	t.Run("Get unread reply counts for thread", func(t *testing.T) {
		t.Skip("MM-41797")
		newPosts := makeSomePosts(false)
		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: true,
			UpdateParticipants:    false,
		}

		_, e := ss.Thread().MaintainMembership(newPosts[0].UserId, newPosts[0].Id, opts)
		require.NoError(t, e)

		m, err1 := ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.NoError(t, err1)

		unreads, err := ss.Thread().GetThreadUnreadReplyCount(m)
		require.NoError(t, err)
		require.Equal(t, int64(0), unreads)

		err = ss.Thread().MarkAsRead(newPosts[0].UserId, newPosts[0].Id, newPosts[0].CreateAt)
		require.NoError(t, err)
		m, err = ss.Thread().GetMembershipForUser(newPosts[0].UserId, newPosts[0].Id)
		require.NoError(t, err)

		unreads, err = ss.Thread().GetThreadUnreadReplyCount(m)
		require.NoError(t, err)
		require.Equal(t, int64(2), unreads)
	})

	testCases := []bool{true, false}

	for _, isUrgent := range testCases {
		t.Run("Return is urgent for user thread/s", func(t *testing.T) {
			newPosts := makeSomePosts(isUrgent)
			opts := store.ThreadMembershipOpts{
				Following:             true,
				IncrementMentions:     false,
				UpdateFollowing:       true,
				UpdateViewedTimestamp: true,
				UpdateParticipants:    false,
			}

			userID := newPosts[0].UserId
			_, e := ss.Thread().MaintainMembership(userID, newPosts[0].Id, opts)
			require.NoError(t, e)

			m, e := ss.Thread().GetMembershipForUser(userID, newPosts[0].Id)
			require.NoError(t, e)

			th, e := ss.Thread().GetThreadForUser(m, false)
			require.NoError(t, e)
			require.Equal(t, isUrgent, th.IsUrgent)

			threads, e := ss.Thread().GetThreadsForUser(userID, "", model.GetUserThreadsOpts{})
			require.NoError(t, e)
			require.Equal(t, isUrgent, threads[0].IsUrgent)
		})
	}
}

func threadStoreCreateReply(t *testing.T, ss store.Store, channelID, postID, userID string, createAt int64) *model.Post {
	t.Helper()

	reply, err := ss.Post().Save(&model.Post{
		ChannelId: channelID,
		UserId:    userID,
		CreateAt:  createAt,
		RootId:    postID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)
	return reply
}

func testThreadStorePermanentDeleteBatchForRetentionPolicies(t *testing.T, ss store.Store) {
	const limit = 1000
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

	post, err := ss.Post().Save(&model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, ss, channel.Id, post.Id, post.UserId, 2000)

	thread, err := ss.Thread().Get(post.Id)
	require.NoError(t, err)

	channelPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "DisplayName",
			PostDurationDays: model.NewInt64(30),
		},
		ChannelIDs: []string{channel.Id},
	})
	require.NoError(t, err)

	nowMillis := thread.LastReplyAt + *channelPolicy.PostDurationDays*model.DayInMilliseconds + 1
	_, _, err = ss.Thread().PermanentDeleteBatchForRetentionPolicies(nowMillis, 0, limit, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	thread, err = ss.Thread().Get(post.Id)
	assert.NoError(t, err)
	assert.Nil(t, thread, "thread should have been deleted by channel policy")

	// create a new thread
	threadStoreCreateReply(t, ss, channel.Id, post.Id, post.UserId, 2000)
	thread, err = ss.Thread().Get(post.Id)
	require.NoError(t, err)

	// Create a team policy which is stricter than the channel policy
	teamPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "DisplayName",
			PostDurationDays: model.NewInt64(20),
		},
		TeamIDs: []string{team.Id},
	})
	require.NoError(t, err)

	nowMillis = thread.LastReplyAt + *teamPolicy.PostDurationDays*model.DayInMilliseconds + 1
	_, _, err = ss.Thread().PermanentDeleteBatchForRetentionPolicies(nowMillis, 0, limit, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	_, err = ss.Thread().Get(post.Id)
	require.NoError(t, err, "channel policy should have overridden team policy")

	// Delete channel policy and re-run team policy
	err = ss.RetentionPolicy().Delete(channelPolicy.ID)
	require.NoError(t, err)
	_, _, err = ss.Thread().PermanentDeleteBatchForRetentionPolicies(nowMillis, 0, limit, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	thread, err = ss.Thread().Get(post.Id)
	assert.NoError(t, err)
	assert.Nil(t, thread, "thread should have been deleted by team policy")
}

func testThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies(t *testing.T, ss store.Store, s SqlStore) {
	const limit = 1000
	userID := model.NewId()
	createThreadMembership := func(userID, postID string) *model.ThreadMembership {
		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}
		_, err := ss.Thread().MaintainMembership(userID, postID, opts)
		require.NoError(t, err)
		threadMembership, err := ss.Thread().GetMembershipForUser(userID, postID)
		require.NoError(t, err)
		return threadMembership
	}
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
	post, err := ss.Post().Save(&model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, ss, channel.Id, post.Id, post.UserId, 2000)

	threadMembership := createThreadMembership(userID, post.Id)

	channelPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "DisplayName",
			PostDurationDays: model.NewInt64(30),
		},
		ChannelIDs: []string{channel.Id},
	})
	require.NoError(t, err)

	nowMillis := threadMembership.LastUpdated + *channelPolicy.PostDurationDays*model.DayInMilliseconds + 1
	_, _, err = ss.Thread().PermanentDeleteBatchThreadMembershipsForRetentionPolicies(nowMillis, 0, limit, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.Error(t, err, "thread membership should have been deleted by channel policy")

	// create a new thread membership
	threadMembership = createThreadMembership(userID, post.Id)

	// Create a team policy which is stricter than the channel policy
	teamPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "DisplayName",
			PostDurationDays: model.NewInt64(20),
		},
		TeamIDs: []string{team.Id},
	})
	require.NoError(t, err)

	nowMillis = threadMembership.LastUpdated + *teamPolicy.PostDurationDays*model.DayInMilliseconds + 1
	_, _, err = ss.Thread().PermanentDeleteBatchThreadMembershipsForRetentionPolicies(nowMillis, 0, limit, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.NoError(t, err, "channel policy should have overridden team policy")

	// Delete channel policy and re-run team policy
	err = ss.RetentionPolicy().Delete(channelPolicy.ID)
	require.NoError(t, err)
	_, _, err = ss.Thread().PermanentDeleteBatchThreadMembershipsForRetentionPolicies(nowMillis, 0, limit, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.Error(t, err, "thread membership should have been deleted by team policy")

	// create a new thread membership
	createThreadMembership(userID, post.Id)

	// Delete team policy and thread
	err = ss.RetentionPolicy().Delete(teamPolicy.ID)
	require.NoError(t, err)
	_, err = s.GetMasterX().Exec("DELETE FROM Threads WHERE PostId='" + post.Id + "'")
	require.NoError(t, err)

	deleted, err := ss.Thread().DeleteOrphanedRows(1000)
	require.NoError(t, err)
	require.NotZero(t, deleted)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.Error(t, err, "thread membership should have been deleted because thread no longer exists")
}

func testGetTeamsUnreadForUser(t *testing.T, ss store.Store) {
	userID := model.NewId()
	createThreadMembership := func(userID, postID string) {
		t.Helper()
		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}
		_, err := ss.Thread().MaintainMembership(userID, postID, opts)
		require.NoError(t, err)
	}
	team1, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)
	channel1, err := ss.Channel().Save(&model.Channel{
		TeamId:      team1.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	post, err := ss.Post().Save(&model.Post{
		ChannelId: channel1.Id,
		UserId:    userID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, ss, channel1.Id, post.Id, post.UserId, model.GetMillis())
	createThreadMembership(userID, post.Id)

	teamsUnread, err := ss.Thread().GetTeamsUnreadForUser(userID, []string{team1.Id}, true)
	require.NoError(t, err)
	assert.Len(t, teamsUnread, 1)
	assert.Equal(t, int64(1), teamsUnread[team1.Id].ThreadCount)

	post, err = ss.Post().Save(&model.Post{
		ChannelId: channel1.Id,
		UserId:    userID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, ss, channel1.Id, post.Id, post.UserId, model.GetMillis())
	createThreadMembership(userID, post.Id)

	teamsUnread, err = ss.Thread().GetTeamsUnreadForUser(userID, []string{team1.Id}, true)
	require.NoError(t, err)
	assert.Len(t, teamsUnread, 1)
	assert.Equal(t, int64(2), teamsUnread[team1.Id].ThreadCount)

	team2, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)
	channel2, err := ss.Channel().Save(&model.Channel{
		TeamId:      team2.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	post2, err := ss.Post().Save(&model.Post{
		ChannelId: channel2.Id,
		UserId:    userID,
		Message:   model.NewRandomString(10),
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewString("urgent"),
				RequestedAck:            model.NewBool(false),
				PersistentNotifications: model.NewBool(false),
			},
		},
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, ss, channel2.Id, post2.Id, post2.UserId, model.GetMillis())
	createThreadMembership(userID, post2.Id)

	teamsUnread, err = ss.Thread().GetTeamsUnreadForUser(userID, []string{team1.Id, team2.Id}, true)
	require.NoError(t, err)
	assert.Len(t, teamsUnread, 2)
	assert.Equal(t, int64(2), teamsUnread[team1.Id].ThreadCount)
	assert.Equal(t, int64(1), teamsUnread[team2.Id].ThreadCount)

	opts := store.ThreadMembershipOpts{
		Following:         true,
		IncrementMentions: true,
	}
	_, err = ss.Thread().MaintainMembership(userID, post2.Id, opts)
	require.NoError(t, err)

	teamsUnread, err = ss.Thread().GetTeamsUnreadForUser(userID, []string{team2.Id}, true)
	require.NoError(t, err)
	assert.Len(t, teamsUnread, 1)
	assert.Equal(t, int64(1), teamsUnread[team2.Id].ThreadCount)
	assert.Equal(t, int64(1), teamsUnread[team2.Id].ThreadMentionCount)
	assert.Equal(t, int64(1), teamsUnread[team2.Id].ThreadUrgentMentionCount)
}

type byPostId []*model.Post

func (a byPostId) Len() int           { return len(a) }
func (a byPostId) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byPostId) Less(i, j int) bool { return a[i].Id < a[j].Id }

func testVarious(t *testing.T, ss store.Store) {
	createThreadMembership := func(userID, postID string, isMention bool) {
		t.Helper()

		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     isMention,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}
		_, err := ss.Thread().MaintainMembership(userID, postID, opts)
		require.NoError(t, err)
	}

	viewThread := func(userID, postID string) {
		t.Helper()

		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: true,
			UpdateParticipants:    false,
		}
		_, err := ss.Thread().MaintainMembership(userID, postID, opts)
		require.NoError(t, err)
	}

	user1, err := ss.User().Save(&model.User{
		Username: "user1" + model.NewId(),
		Email:    MakeEmail(),
	})
	require.NoError(t, err)
	user2, err := ss.User().Save(&model.User{
		Username: "user2" + model.NewId(),
		Email:    MakeEmail(),
	})
	require.NoError(t, err)

	user1ID := user1.Id
	user2ID := user2.Id

	team1, err := ss.Team().Save(&model.Team{
		DisplayName: "Team1",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	team2, err := ss.Team().Save(&model.Team{
		DisplayName: "Team2",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	team1channel1, err := ss.Channel().Save(&model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Channel1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	team2channel1, err := ss.Channel().Save(&model.Channel{
		TeamId:      team2.Id,
		DisplayName: "Channel2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	dm1, err := ss.Channel().CreateDirectChannel(&model.User{Id: user1ID}, &model.User{Id: user2ID})
	require.NoError(t, err)

	gm1, err := ss.Channel().Save(&model.Channel{
		DisplayName: "GM",
		Name:        "gm" + model.NewId(),
		Type:        model.ChannelTypeGroup,
	}, -1)
	require.NoError(t, err)

	team1channel1post1, err := ss.Post().Save(&model.Post{
		ChannelId: team1channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	team1channel1post2, err := ss.Post().Save(&model.Post{
		ChannelId: team1channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	team1channel1post3, err := ss.Post().Save(&model.Post{
		ChannelId: team1channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewString("urgent"),
				RequestedAck:            model.NewBool(false),
				PersistentNotifications: model.NewBool(false),
			},
		},
	})
	require.NoError(t, err)

	team2channel1post1, err := ss.Post().Save(&model.Post{
		ChannelId: team2channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	team2channel1post2deleted, err := ss.Post().Save(&model.Post{
		ChannelId: team2channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	dm1post1, err := ss.Post().Save(&model.Post{
		ChannelId: dm1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	gm1post1, err := ss.Post().Save(&model.Post{
		ChannelId: gm1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	postNames := map[string]string{
		team1channel1post1.Id:        "team1channel1post1",
		team1channel1post2.Id:        "team1channel1post2",
		team1channel1post3.Id:        "team1channel1post3",
		team2channel1post1.Id:        "team2channel1post1",
		team2channel1post2deleted.Id: "team2channel1post2deleted",
		dm1post1.Id:                  "dm1post1",
		gm1post1.Id:                  "gm1post1",
	}

	threadStoreCreateReply(t, ss, team1channel1.Id, team1channel1post1.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, ss, team1channel1.Id, team1channel1post2.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, ss, team1channel1.Id, team1channel1post3.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, ss, team2channel1.Id, team2channel1post1.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, ss, team2channel1.Id, team2channel1post2deleted.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, ss, dm1.Id, dm1post1.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, ss, gm1.Id, gm1post1.Id, user2ID, model.GetMillis())

	// Create thread memberships, with simulated unread mentions.
	createThreadMembership(user1ID, team1channel1post1.Id, false)
	createThreadMembership(user1ID, team1channel1post2.Id, false)
	createThreadMembership(user1ID, team1channel1post3.Id, true)
	createThreadMembership(user1ID, team2channel1post1.Id, false)
	createThreadMembership(user1ID, team2channel1post2deleted.Id, false)
	createThreadMembership(user1ID, dm1post1.Id, false)
	createThreadMembership(user1ID, gm1post1.Id, true)

	// Have user1 view a subset of the threads
	viewThread(user1ID, team1channel1post1.Id)
	viewThread(user2ID, team1channel1post2.Id)
	viewThread(user1ID, team2channel1post1.Id)
	viewThread(user1ID, dm1post1.Id)

	// Add reply to a viewed thread to confirm it's unread again.
	time.Sleep(2 * time.Millisecond)
	threadStoreCreateReply(t, ss, team1channel1.Id, team1channel1post2.Id, user2ID, model.GetMillis())

	// Actually make team2channel1post2deleted deleted
	err = ss.Post().Delete(team2channel1post2deleted.Id, model.GetMillis(), user1ID)
	require.NoError(t, err)

	// Re-fetch posts to ensure metadata up-to-date
	allPosts := []*model.Post{
		team1channel1post1,
		team1channel1post2,
		team1channel1post3,
		team2channel1post1,
		team2channel1post2deleted,
		dm1post1,
		gm1post1,
	}
	for i := range allPosts {
		updatedPost, err := ss.Post().GetSingle(allPosts[i].Id, true)
		require.NoError(t, err)

		// Fix some inconsistencies with how the post store returns posts vs. how the
		// thread store returns it.
		if updatedPost.RemoteId == nil {
			updatedPost.RemoteId = new(string)
		}

		// Also, we don't populate ReplyCount for posts when querying threads, so don't
		// assert same.
		updatedPost.ReplyCount = 0

		updatedPost.ShallowCopy(allPosts[i])
	}

	t.Run("GetTotalUnreadThreads", func(t *testing.T) {
		testCases := []struct {
			Description string
			UserID      string
			TeamID      string
			Options     model.GetUserThreadsOpts

			ExpectedThreads []*model.Post
		}{
			{"all teams, user1", user1ID, "", model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post2, team1channel1post3, gm1post1,
			}},
			{"team1, user1", user1ID, team1.Id, model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post2, team1channel1post3, gm1post1,
			}},
			{"team1, user1, deleted", user1ID, team1.Id, model.GetUserThreadsOpts{Deleted: true}, []*model.Post{
				team1channel1post2, team1channel1post3, gm1post1, // (no deleted threads in team1)
			}},
			{"team2, user1", user1ID, team2.Id, model.GetUserThreadsOpts{}, []*model.Post{
				gm1post1, // (no unread threads in team2)
			}},
			{"team2, user1, deleted", user1ID, team2.Id, model.GetUserThreadsOpts{Deleted: true}, []*model.Post{
				team2channel1post2deleted, gm1post1,
			}},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				totalUnreadThreads, err := ss.Thread().GetTotalUnreadThreads(testCase.UserID, testCase.TeamID, testCase.Options)
				require.NoError(t, err)

				assert.EqualValues(t, int64(len(testCase.ExpectedThreads)), totalUnreadThreads)
			})
		}
	})

	t.Run("GetTotalThreads", func(t *testing.T) {
		testCases := []struct {
			Description string
			UserID      string
			TeamID      string
			Options     model.GetUserThreadsOpts

			ExpectedThreads []*model.Post
		}{
			{"all teams, user1", user1ID, "", model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post1, team1channel1post2, team1channel1post3, team2channel1post1, dm1post1, gm1post1,
			}},
			{"team1, user1", user1ID, team1.Id, model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post1, team1channel1post2, team1channel1post3, dm1post1, gm1post1,
			}},
			{"team1, user1, deleted", user1ID, team1.Id, model.GetUserThreadsOpts{Deleted: true}, []*model.Post{
				team1channel1post1, team1channel1post2, team1channel1post3, dm1post1, gm1post1, // (no deleted threads in team1)
			}},
			{"team2, user1", user1ID, team2.Id, model.GetUserThreadsOpts{}, []*model.Post{
				team2channel1post1, dm1post1, gm1post1,
			}},
			{"team2, user1, deleted", user1ID, team2.Id, model.GetUserThreadsOpts{Deleted: true}, []*model.Post{
				team2channel1post1, team2channel1post2deleted, dm1post1, gm1post1,
			}},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				totalThreads, err := ss.Thread().GetTotalThreads(testCase.UserID, testCase.TeamID, testCase.Options)
				require.NoError(t, err)

				assert.EqualValues(t, int64(len(testCase.ExpectedThreads)), totalThreads)
			})
		}
	})

	t.Run("GetTotalUnreadMentions", func(t *testing.T) {
		testCases := []struct {
			Description string
			UserID      string
			TeamID      string
			Options     model.GetUserThreadsOpts

			ExpectedThreads []*model.Post
		}{
			{"all teams, user1", user1ID, "", model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post3, gm1post1,
			}},
			{"team1, user1", user1ID, team1.Id, model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post3, gm1post1,
			}},
			{"team2, user1", user1ID, team2.Id, model.GetUserThreadsOpts{}, []*model.Post{
				gm1post1,
			}},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				totalUnreadMentions, err := ss.Thread().GetTotalUnreadMentions(testCase.UserID, testCase.TeamID, testCase.Options)
				require.NoError(t, err)

				assert.EqualValues(t, int64(len(testCase.ExpectedThreads)), totalUnreadMentions)
			})
		}
	})

	t.Run("GetTotalUnreadUrgentMentions", func(t *testing.T) {
		testCases := []struct {
			Description     string
			UserID          string
			TeamID          string
			Options         model.GetUserThreadsOpts
			ExpectedThreads []*model.Post
		}{
			{"all teams, user1", user1ID, "", model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post3,
			}},
			{"team1, user1", user1ID, team1.Id, model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post3,
			}},
			{"team2, user1", user1ID, team2.Id, model.GetUserThreadsOpts{}, []*model.Post{}},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				totalUnreadUrgentMentions, err := ss.Thread().GetTotalUnreadUrgentMentions(testCase.UserID, testCase.TeamID, testCase.Options)
				require.NoError(t, err)

				assert.EqualValues(t, int64(len(testCase.ExpectedThreads)), totalUnreadUrgentMentions)
			})
		}
	})

	assertThreadPosts := func(t *testing.T, threads []*model.ThreadResponse, expectedPosts []*model.Post) {
		t.Helper()

		actualPosts := make([]*model.Post, 0, len(threads))
		actualPostNames := make([]string, 0, len(threads))
		for _, thread := range threads {
			actualPosts = append(actualPosts, thread.Post)
			postName, ok := postNames[thread.PostId]
			require.True(t, ok, "failed to find actual %s in post names", thread.PostId)
			actualPostNames = append(actualPostNames, postName)
		}
		sort.Strings(actualPostNames)

		expectedPostNames := make([]string, 0, len(expectedPosts))
		for _, post := range expectedPosts {
			postName, ok := postNames[post.Id]
			require.True(t, ok, "failed to find expected %s in post names", post.Id)
			expectedPostNames = append(expectedPostNames, postName)
		}
		sort.Strings(expectedPostNames)

		assert.Equal(t, expectedPostNames, actualPostNames)

		// Check posts themselves
		sort.Sort(byPostId(expectedPosts))
		sort.Sort(byPostId(actualPosts))
		if assert.Len(t, actualPosts, len(expectedPosts)) {
			for i := range actualPosts {
				assert.Equal(t, expectedPosts[i], actualPosts[i], "mismatch comparing expected post %s with actual post %s", postNames[expectedPosts[i].Id], postNames[actualPosts[i].Id])
			}
		} else {
			assert.Equal(t, expectedPosts, actualPosts)
		}

		// Check common fields between threads and posts.
		for _, thread := range threads {
			assert.Equal(t, thread.DeleteAt, thread.Post.DeleteAt, "expected Thread.DeleteAt == Post.DeleteAt")
		}
	}

	t.Run("GetThreadsForUser", func(t *testing.T) {
		testCases := []struct {
			Description string
			UserID      string
			TeamID      string
			Options     model.GetUserThreadsOpts

			ExpectedThreads []*model.Post
		}{
			{"all teams, user1", user1ID, "", model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post1, team1channel1post2, team1channel1post3, team2channel1post1, dm1post1, gm1post1,
			}},
			{"team1, user1", user1ID, team1.Id, model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post1, team1channel1post2, team1channel1post3, dm1post1, gm1post1,
			}},
			{"team1, user1, unread", user1ID, team1.Id, model.GetUserThreadsOpts{Unread: true}, []*model.Post{
				team1channel1post2, team1channel1post3, gm1post1,
			}},
			{"team1, user1, deleted", user1ID, team1.Id, model.GetUserThreadsOpts{Deleted: true}, []*model.Post{
				team1channel1post1, team1channel1post2, team1channel1post3, dm1post1, gm1post1, // (no deleted threads in team1)
			}},
			{"team1, user1, unread + deleted", user1ID, team1.Id, model.GetUserThreadsOpts{Unread: true, Deleted: true}, []*model.Post{
				team1channel1post2, team1channel1post3, gm1post1, // (no deleted threads in team1)
			}},
			{"team2, user1", user1ID, team2.Id, model.GetUserThreadsOpts{}, []*model.Post{
				team2channel1post1, dm1post1, gm1post1,
			}},
			{"team2, user1, unread", user1ID, team2.Id, model.GetUserThreadsOpts{Unread: true}, []*model.Post{
				gm1post1, // (no unread in team2)
			}},
			{"team2, user1, deleted", user1ID, team2.Id, model.GetUserThreadsOpts{Deleted: true}, []*model.Post{
				team2channel1post1, team2channel1post2deleted, dm1post1, gm1post1,
			}},
			{"team2, user1, unread + deleted", user1ID, team2.Id, model.GetUserThreadsOpts{Unread: true, Deleted: true}, []*model.Post{
				team2channel1post2deleted, gm1post1,
			}},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				threads, err := ss.Thread().GetThreadsForUser(testCase.UserID, testCase.TeamID, testCase.Options)
				require.NoError(t, err)

				assertThreadPosts(t, threads, testCase.ExpectedThreads)
			})
		}
	})
}

func testMarkAllAsReadByChannels(t *testing.T, ss store.Store) {
	postingUserId := model.NewId()
	userAID := model.NewId()
	userBID := model.NewId()

	team1, err := ss.Team().Save(&model.Team{
		DisplayName: "Team1",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	channel1, err := ss.Channel().Save(&model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Channel1",
		Name:        "channel1" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	channel2, err := ss.Channel().Save(&model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Channel2",
		Name:        "channel2" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	createThreadMembership := func(userID, postID string) {
		t.Helper()
		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}
		_, err := ss.Thread().MaintainMembership(userID, postID, opts)
		require.NoError(t, err)
	}

	assertThreadReplyCount := func(t *testing.T, userID string, count int64) {
		t.Helper()

		teamsUnread, err := ss.Thread().GetTeamsUnreadForUser(userID, []string{team1.Id}, false)
		require.NoError(t, err)
		require.Len(t, teamsUnread, 1, "unexpected unread teams count")
		assert.Equal(t, count, teamsUnread[team1.Id].ThreadCount, "unexpected thread count")
	}

	t.Run("empty set of channels", func(t *testing.T) {
		err := ss.Thread().MarkAllAsReadByChannels(model.NewId(), []string{})
		require.NoError(t, err)
	})

	t.Run("single channel", func(t *testing.T) {
		post, err := ss.Post().Save(&model.Post{
			ChannelId: channel1.Id,
			UserId:    postingUserId,
			Message:   "Root",
		})
		require.NoError(t, err)

		_, err = ss.Post().Save(&model.Post{
			ChannelId: channel1.Id,
			UserId:    postingUserId,
			RootId:    post.Id,
			Message:   "Reply",
		})
		require.NoError(t, err)

		createThreadMembership(userAID, post.Id)
		createThreadMembership(userBID, post.Id)

		assertThreadReplyCount(t, userAID, 1)
		assertThreadReplyCount(t, userBID, 1)

		err = ss.Thread().MarkAllAsReadByChannels(userAID, []string{channel1.Id})
		require.NoError(t, err)

		assertThreadReplyCount(t, userAID, 0)
		assertThreadReplyCount(t, userBID, 1)

		err = ss.Thread().MarkAllAsReadByChannels(userBID, []string{channel1.Id})
		require.NoError(t, err)

		assertThreadReplyCount(t, userAID, 0)
		assertThreadReplyCount(t, userBID, 0)
	})

	t.Run("multiple channels", func(t *testing.T) {
		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channel1.Id,
			UserId:    postingUserId,
			Message:   "Root",
		})
		require.NoError(t, err)

		_, err = ss.Post().Save(&model.Post{
			ChannelId: channel1.Id,
			UserId:    postingUserId,
			RootId:    post1.Id,
			Message:   "Reply",
		})
		require.NoError(t, err)

		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channel2.Id,
			UserId:    postingUserId,
			Message:   "Root",
		})
		require.NoError(t, err)

		_, err = ss.Post().Save(&model.Post{
			ChannelId: channel2.Id,
			UserId:    postingUserId,
			RootId:    post2.Id,
			Message:   "Reply",
		})
		require.NoError(t, err)

		createThreadMembership(userAID, post1.Id)
		createThreadMembership(userBID, post1.Id)
		createThreadMembership(userAID, post2.Id)
		createThreadMembership(userBID, post2.Id)

		assertThreadReplyCount(t, userAID, 2)
		assertThreadReplyCount(t, userBID, 2)

		err = ss.Thread().MarkAllAsReadByChannels(userAID, []string{channel1.Id, channel2.Id})
		require.NoError(t, err)

		assertThreadReplyCount(t, userAID, 0)
		assertThreadReplyCount(t, userBID, 2)

		err = ss.Thread().MarkAllAsReadByChannels(userBID, []string{channel1.Id, channel2.Id})
		require.NoError(t, err)

		assertThreadReplyCount(t, userAID, 0)
		assertThreadReplyCount(t, userBID, 0)
	})
}

func testGetTopThreads(t *testing.T, ss store.Store) {
	// create two users
	u1 := model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}

	_, err := ss.User().Save(&u1)
	require.NoError(t, err)

	u2 := model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}

	_, err = ss.User().Save(&u2)
	require.NoError(t, err)

	u3 := model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}

	_, err = ss.User().Save(&u3)
	require.NoError(t, err)

	t.Run("test get top team threads", func(t *testing.T) {
		const limit = 10
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

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channel.Id,
			UserId:    u1.Id,
		})
		require.NoError(t, err)
		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channel.Id,
			UserId:    u2.Id,
		})
		require.NoError(t, err)
		threadStoreCreateReply(t, ss, channel.Id, post1.Id, post1.UserId, 2000)
		threadStoreCreateReply(t, ss, channel.Id, post1.Id, post1.UserId, 2000)

		threadStoreCreateReply(t, ss, channel.Id, post2.Id, post1.UserId, 2000)

		//  get top threads
		topThreadsInTeam, err := ss.Thread().GetTopThreadsForTeamSince(team.Id, model.NewId(), 12, 0, limit)
		require.NoError(t, err)
		// require length of top threads to be 2
		require.Len(t, topThreadsInTeam.Items, 2)

		// require first element to be post1 with 2 replyCount=2
		require.Equal(t, topThreadsInTeam.Items[0].PostId, post1.Id)
		require.Equal(t, topThreadsInTeam.Items[0].UserId, post1.UserId)
		require.Equal(t, topThreadsInTeam.Items[0].UserInformation.Id, post1.UserId)
		require.Equal(t, topThreadsInTeam.Items[0].Post.ReplyCount, int64(2))
		require.Equal(t, topThreadsInTeam.Items[0].Post.Message, post1.Message)
		// require second element to be post2 with 2 replyCount=2
		require.Equal(t, topThreadsInTeam.Items[1].PostId, post2.Id)
		require.Equal(t, topThreadsInTeam.Items[1].Post.ReplyCount, int64(1))
		require.Equal(t, topThreadsInTeam.Items[1].UserId, post2.UserId)
		require.Equal(t, topThreadsInTeam.Items[1].UserInformation.Id, post2.UserId)
		require.Equal(t, topThreadsInTeam.Items[1].Post.Message, post2.Message)

		// require topThreads[i].Post is not null
		require.Equal(t, topThreadsInTeam.Items[0].Post.Id, post1.Id)
		require.Equal(t, topThreadsInTeam.Items[1].Post.Id, post2.Id)
	})
	t.Run("test get top user threads", func(t *testing.T) {
		const limit = 10
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

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channel.Id,
			UserId:    u1.Id,
		})
		require.NoError(t, err)
		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channel.Id,
			UserId:    u2.Id,
		})
		require.NoError(t, err)
		post3, err := ss.Post().Save(&model.Post{
			ChannelId: channel.Id,
			UserId:    u3.Id,
		})
		require.NoError(t, err)
		threadStoreCreateReply(t, ss, channel.Id, post1.Id, post1.UserId, 2000)
		threadStoreCreateReply(t, ss, channel.Id, post1.Id, post1.UserId, 2000)

		threadStoreCreateReply(t, ss, channel.Id, post2.Id, post2.UserId, 2000)
		threadStoreCreateReply(t, ss, channel.Id, post2.Id, post2.UserId, 2000)
		threadStoreCreateReply(t, ss, channel.Id, post3.Id, post3.UserId, 2000)
		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}

		// create threadmemberships entries.
		_, err = ss.Thread().MaintainMembership(post1.UserId, post1.Id, opts)
		require.NoError(t, err)
		_, err = ss.Thread().MaintainMembership(post2.UserId, post2.Id, opts)
		require.NoError(t, err)
		_, err = ss.Thread().MaintainMembership(post2.UserId, post3.Id, opts)
		require.NoError(t, err)

		//  get top threads by user
		topThreadsByUser1, err := ss.Thread().GetTopThreadsForUserSince(team.Id, post1.UserId, 12, 0, limit)
		require.NoError(t, err)
		topThreadsByUser2, err := ss.Thread().GetTopThreadsForUserSince(team.Id, post2.UserId, 12, 0, limit)
		require.NoError(t, err)
		// require length of top threads by users to be 1,2 respectively
		require.Len(t, topThreadsByUser1.Items, 1)
		require.Len(t, topThreadsByUser2.Items, 2)

		// require first element of topThreadsByUser1 to be post1 with 2 replyCount=2
		require.Equal(t, topThreadsByUser1.Items[0].PostId, post1.Id)
		require.Equal(t, topThreadsByUser1.Items[0].Post.ReplyCount, int64(2))
		require.Equal(t, topThreadsByUser1.Items[0].Post.Message, post1.Message)
		require.Equal(t, topThreadsByUser1.Items[0].UserId, post1.UserId)
		require.Equal(t, topThreadsByUser1.Items[0].UserInformation.Id, post1.UserId)
		// require elements of topThreadsByUser2 to be post2 and post3 respectively
		require.Equal(t, topThreadsByUser2.Items[0].PostId, post2.Id)
		require.Equal(t, topThreadsByUser2.Items[0].Post.ReplyCount, int64(2))
		require.Equal(t, topThreadsByUser2.Items[0].Post.Message, post2.Message)
		require.Equal(t, topThreadsByUser2.Items[0].UserId, post2.UserId)
		require.Equal(t, topThreadsByUser2.Items[0].UserInformation.Id, post2.UserId)

		require.Equal(t, topThreadsByUser2.Items[1].PostId, post3.Id)
		require.Equal(t, topThreadsByUser2.Items[1].Post.ReplyCount, int64(1))
		require.Equal(t, topThreadsByUser2.Items[1].Post.Message, post3.Message)
		require.Equal(t, topThreadsByUser2.Items[1].UserId, post3.UserId)
		require.Equal(t, topThreadsByUser2.Items[1].UserInformation.Id, post3.UserId)

		// require topThreads[i].Post is not null
		require.Equal(t, topThreadsByUser1.Items[0].Post.Id, post1.Id)
		require.Equal(t, topThreadsByUser2.Items[1].Post.Id, post3.Id)
	})
	t.Run("test get top threads only from given teamid", func(t *testing.T) {
		const limit = 10
		team1, err := ss.Team().Save(&model.Team{
			DisplayName: "DisplayName",
			Name:        "team" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TeamOpen,
		})
		require.NoError(t, err)
		team2, err := ss.Team().Save(&model.Team{
			DisplayName: "DisplayName",
			Name:        "team" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TeamOpen,
		})
		require.NoError(t, err)
		channel1, err := ss.Channel().Save(&model.Channel{
			TeamId:      team1.Id,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		channel2, err := ss.Channel().Save(&model.Channel{
			TeamId:      team2.Id,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channel1.Id,
			UserId:    u1.Id,
		})
		require.NoError(t, err)
		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channel2.Id,
			UserId:    u2.Id,
		})
		require.NoError(t, err)
		threadStoreCreateReply(t, ss, channel1.Id, post1.Id, post1.UserId, 2000)
		threadStoreCreateReply(t, ss, channel1.Id, post1.Id, post1.UserId, 2000)

		threadStoreCreateReply(t, ss, channel2.Id, post2.Id, post2.UserId, 2000)

		//  assert that getting top threads from teamid 1 doesn't have post1.Id

		topThreadsTeam2, err := ss.Thread().GetTopThreadsForTeamSince(team2.Id, u1.Id, 12, 0, limit)
		require.NoError(t, err)
		require.Len(t, topThreadsTeam2.Items, 1)
		require.Equal(t, topThreadsTeam2.Items[0].Post.Id, post2.Id)
	})
	t.Run("test get top threads only from non-direct channels", func(t *testing.T) {
		const limit = 10
		team1, err := ss.Team().Save(&model.Team{
			DisplayName: "DisplayName",
			Name:        "team" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TeamOpen,
		})
		require.NoError(t, err)
		channel1, err := ss.Channel().CreateDirectChannel(&u1, &u2)
		require.NoError(t, err)

		channel2, err := ss.Channel().Save(&model.Channel{
			TeamId:      team1.Id,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channel1.Id,
			UserId:    u1.Id,
		})
		require.NoError(t, err)
		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channel2.Id,
			UserId:    u2.Id,
		})
		require.NoError(t, err)
		threadStoreCreateReply(t, ss, channel1.Id, post1.Id, post1.UserId, 2000)
		threadStoreCreateReply(t, ss, channel1.Id, post1.Id, post1.UserId, 2000)

		threadStoreCreateReply(t, ss, channel2.Id, post2.Id, u1.Id, 2000)

		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}

		// create threadmemberships entries.
		_, err = ss.Thread().MaintainMembership(u1.Id, post1.Id, opts)
		require.NoError(t, err)
		_, err = ss.Thread().MaintainMembership(u1.Id, post2.Id, opts)
		require.NoError(t, err)
		_, err = ss.Thread().MaintainMembership(u2.Id, post1.Id, opts)
		require.NoError(t, err)
		_, err = ss.Thread().MaintainMembership(u2.Id, post2.Id, opts)
		require.NoError(t, err)

		//  assert that getting top threads from teamid 1 doesn't have DMs

		topThreadsTeam1, err := ss.Thread().GetTopThreadsForTeamSince(team1.Id, u1.Id, 12, 0, limit)
		require.NoError(t, err)
		require.Len(t, topThreadsTeam1.Items, 1)
		require.Equal(t, topThreadsTeam1.Items[0].Post.Id, post2.Id)

		// assert that getting top threads from user 1 doesn't contain dm threads.
		topUserThreads, err := ss.Thread().GetTopThreadsForUserSince(team1.Id, u1.Id, 12, 0, limit)
		require.NoError(t, err)
		require.Len(t, topUserThreads.Items, 1)
		require.Equal(t, topUserThreads.Items[0].Post.Id, post2.Id)
	})
	t.Run("test get top threads doesn't exceed duration", func(t *testing.T) {
		const limit = 10
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

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channel.Id,
			UserId:    u1.Id,
		})
		require.NoError(t, err)
		// post 2 has replies after 10 ms unix time.
		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channel.Id,
			UserId:    u2.Id,
			CreateAt:  1,
		})
		require.NoError(t, err)
		threadStoreCreateReply(t, ss, channel.Id, post1.Id, post1.UserId, 2000)
		threadStoreCreateReply(t, ss, channel.Id, post1.Id, post1.UserId, 2000)

		threadStoreCreateReply(t, ss, channel.Id, post2.Id, post1.UserId, 10)

		//  get top threads
		topThreadsInTeamNewer, err := ss.Thread().GetTopThreadsForTeamSince(team.Id, model.NewId(), 12, 0, limit)
		require.NoError(t, err)
		// require length of top threads to be 2
		require.Len(t, topThreadsInTeamNewer.Items, 1)

		// require first element to be post1 with 2 replyCount=2
		require.Equal(t, topThreadsInTeamNewer.Items[0].PostId, post1.Id)

		//  get top threads
		topThreadsInTeamOlder, err := ss.Thread().GetTopThreadsForTeamSince(team.Id, model.NewId(), 9, 0, limit)
		require.NoError(t, err)
		// require length of top threads to be 2
		require.Len(t, topThreadsInTeamOlder.Items, 2)

		// require first element to be post1 with 2 replyCount=2
		require.Equal(t, topThreadsInTeamOlder.Items[1].PostId, post2.Id)
	})
}
