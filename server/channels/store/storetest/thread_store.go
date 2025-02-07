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

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestThreadStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("ThreadStorePopulation", func(t *testing.T) { testThreadStorePopulation(t, rctx, ss) })
	t.Run("ThreadStorePermanentDeleteBatchForRetentionPolicies", func(t *testing.T) {
		testThreadStorePermanentDeleteBatchForRetentionPolicies(t, rctx, ss)
	})
	t.Run("ThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies", func(t *testing.T) {
		testThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies(t, rctx, ss, s)
	})
	t.Run("GetTeamsUnreadForUser", func(t *testing.T) { testGetTeamsUnreadForUser(t, rctx, ss) })
	t.Run("GetVarious", func(t *testing.T) { testVarious(t, rctx, ss) })
	t.Run("MarkAllAsReadByChannels", func(t *testing.T) { testMarkAllAsReadByChannels(t, rctx, ss) })
	t.Run("MarkAllAsReadByTeam", func(t *testing.T) { testMarkAllAsReadByTeam(t, rctx, ss) })
	t.Run("DeleteMembershipsForChannel", func(t *testing.T) { testDeleteMembershipsForChannel(t, rctx, ss) })
	t.Run("SaveMultipleMemberships", func(t *testing.T) { testSaveMultipleMemberships(t, ss) })
	t.Run("MaintainMultipleFromImport", func(t *testing.T) { testMaintainMultipleFromImport(t, rctx, ss) })
	t.Run("UpdateTeamIdForChannelThreads", func(t *testing.T) { testUpdateTeamIdForChannelThreads(t, rctx, ss) })
}

func testThreadStorePopulation(t *testing.T, rctx request.CTX, ss store.Store) {
	makeSomePosts := func(urgent bool) []*model.Post {
		u1 := model.User{
			Email:    MakeEmail(),
			Username: model.NewUsername(),
		}

		u, err := ss.User().Save(rctx, &u1)
		require.NoError(t, err)

		c, err2 := ss.Channel().Save(rctx, &model.Channel{
			DisplayName: model.NewId(),
			Type:        model.ChannelTypeOpen,
			Name:        model.NewId(),
		}, 999)
		require.NoError(t, err2)

		_, err44 := ss.Channel().SaveMember(rctx, &model.ChannelMember{
			ChannelId:   c.Id,
			UserId:      u1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			MsgCount:    0,
		})
		require.NoError(t, err44)
		o := model.Post{}
		o.ChannelId = c.Id
		o.UserId = u.Id
		o.Message = NewTestID()

		if urgent {
			o.Metadata = &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer(model.PostPriorityUrgent),
					RequestedAck:            model.NewPointer(false),
					PersistentNotifications: model.NewPointer(false),
				},
			}
		}

		otmp, err3 := ss.Post().Save(rctx, &o)
		require.NoError(t, err3)
		o2 := model.Post{}
		o2.ChannelId = c.Id
		o2.UserId = model.NewId()
		o2.RootId = otmp.Id
		o2.Message = NewTestID()

		o3 := model.Post{}
		o3.ChannelId = c.Id
		o3.UserId = u.Id
		o3.RootId = otmp.Id
		o3.Message = NewTestID()

		o4 := model.Post{}
		o4.ChannelId = c.Id
		o4.UserId = model.NewId()
		o4.Message = NewTestID()

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
		channel, err := ss.Channel().Save(rctx, &model.Channel{
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
		o5.Message = NewTestID()

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

		err = ss.Post().Delete(rctx, newPosts[1].Id, 1234, model.NewId())
		require.NoError(t, err, "couldn't delete post")

		thread, err = ss.Thread().Get(newPosts[0].Id)
		require.NoError(t, err, "couldn't get thread")
		require.NotNil(t, thread)
		require.Equal(t, int64(1), thread.ReplyCount)
		require.ElementsMatch(t, model.StringArray{newPosts[0].UserId}, thread.Participants)
	})

	t.Run("Update reply should update the UpdateAt of the thread", func(t *testing.T) {
		teamId := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
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
		rootPost.Message = NewTestID()

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = NewTestID()
		replyPost.RootId = rootPost.RootId

		newPosts, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost, &replyPost})
		require.NoError(t, err)

		thread1, err := ss.Thread().Get(newPosts[0].RootId)
		require.NoError(t, err)

		rrootPost, err := ss.Post().GetSingle(rctx, rootPost.Id, false)
		require.NoError(t, err)
		require.Equal(t, rrootPost.UpdateAt, rootPost.UpdateAt)

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

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&replyPost2, &replyPost3})
		require.NoError(t, err)

		rrootPost2, err := ss.Post().GetSingle(rctx, rootPost.Id, false)
		require.NoError(t, err)
		require.Greater(t, rrootPost2.UpdateAt, rrootPost.UpdateAt)

		thread2, err := ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
		require.Greater(t, thread2.LastReplyAt, thread1.LastReplyAt)
	})

	t.Run("Deleting reply should update the thread", func(t *testing.T) {
		teamId := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamId,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		o1 := model.Post{}
		o1.ChannelId = channel.Id
		o1.UserId = model.NewId()
		o1.Message = NewTestID()
		rootPost, err := ss.Post().Save(rctx, &o1)
		require.NoError(t, err)

		o2 := model.Post{}
		o2.RootId = rootPost.Id
		o2.ChannelId = rootPost.ChannelId
		o2.UserId = model.NewId()
		o2.Message = NewTestID()
		replyPost, err := ss.Post().Save(rctx, &o2)
		require.NoError(t, err)

		o3 := model.Post{}
		o3.RootId = rootPost.Id
		o3.ChannelId = rootPost.ChannelId
		o3.UserId = o2.UserId
		o3.Message = NewTestID()
		replyPost2, err := ss.Post().Save(rctx, &o3)
		require.NoError(t, err)

		o4 := model.Post{}
		o4.RootId = rootPost.Id
		o4.ChannelId = rootPost.ChannelId
		o4.UserId = model.NewId()
		o4.Message = NewTestID()
		replyPost3, err := ss.Post().Save(rctx, &o4)
		require.NoError(t, err)

		thread, err := ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
		require.EqualValues(t, thread.ReplyCount, 3)
		require.EqualValues(t, thread.Participants, model.StringArray{replyPost.UserId, replyPost3.UserId})

		err = ss.Post().Delete(rctx, replyPost2.Id, 123, model.NewId())
		require.NoError(t, err)
		thread, err = ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
		require.EqualValues(t, thread.ReplyCount, 2)
		require.EqualValues(t, thread.Participants, model.StringArray{replyPost.UserId, replyPost3.UserId})

		err = ss.Post().Delete(rctx, replyPost.Id, 123, model.NewId())
		require.NoError(t, err)
		thread, err = ss.Thread().Get(rootPost.Id)
		require.NoError(t, err)
		require.EqualValues(t, thread.ReplyCount, 1)
		require.EqualValues(t, thread.Participants, model.StringArray{replyPost3.UserId})
	})

	t.Run("Deleting root post should delete the thread", func(t *testing.T) {
		teamId := model.NewId()
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamId,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		rootPost := model.Post{}
		rootPost.ChannelId = channel.Id
		rootPost.UserId = model.NewId()
		rootPost.Message = NewTestID()

		newPosts1, _, err := ss.Post().SaveMultiple([]*model.Post{&rootPost})
		require.NoError(t, err)

		replyPost := model.Post{}
		replyPost.ChannelId = rootPost.ChannelId
		replyPost.UserId = model.NewId()
		replyPost.Message = NewTestID()
		replyPost.RootId = newPosts1[0].Id

		_, _, err = ss.Post().SaveMultiple([]*model.Post{&replyPost})
		require.NoError(t, err)

		thread1, err := ss.Thread().Get(newPosts1[0].Id)
		require.NoError(t, err)
		require.EqualValues(t, thread1.ReplyCount, 1)
		require.Len(t, thread1.Participants, 1)

		err = ss.Post().PermanentDeleteByUser(rctx, rootPost.UserId)
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
		th, err := ss.Thread().GetThreadForUser(m, false, false)
		require.NoError(t, err)
		require.Equal(t, int64(2), th.UnreadReplies)

		m.LastViewed = newPosts[2].UpdateAt + 1
		_, err = ss.Thread().UpdateMembership(m)
		require.NoError(t, err)
		th, err = ss.Thread().GetThreadForUser(m, false, false)
		require.NoError(t, err)
		require.Equal(t, int64(0), th.UnreadReplies)

		editedPost := newPosts[2].Clone()
		editedPost.Message = "This is an edited post"
		_, err = ss.Post().Update(rctx, editedPost, newPosts[2])
		require.NoError(t, err)

		th, err = ss.Thread().GetThreadForUser(m, false, false)
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
		th, err := ss.Thread().GetThreadForUser(m, true, false)
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

			th, e := ss.Thread().GetThreadForUser(m, false, true)
			require.NoError(t, e)
			require.Equal(t, isUrgent, th.IsUrgent)

			threads, e := ss.Thread().GetThreadsForUser(userID, "", model.GetUserThreadsOpts{IncludeIsUrgent: true})
			require.NoError(t, e)
			require.Equal(t, isUrgent, threads[0].IsUrgent)
		})
	}
}

func threadStoreCreateReply(t *testing.T, rctx request.CTX, ss store.Store, channelID, postID, userID string, createAt int64) *model.Post {
	t.Helper()
	reply, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channelID,
		UserId:    userID,
		CreateAt:  createAt,
		RootId:    postID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)
	return reply
}

func testThreadStorePermanentDeleteBatchForRetentionPolicies(t *testing.T, rctx request.CTX, ss store.Store) {
	const limit = 1000
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

	post, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, rctx, ss, channel.Id, post.Id, post.UserId, 2000)

	thread, err := ss.Thread().Get(post.Id)
	require.NoError(t, err)

	channelPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "DisplayName",
			PostDurationDays: model.NewPointer(int64(30)),
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
	threadStoreCreateReply(t, rctx, ss, channel.Id, post.Id, post.UserId, 2000)
	thread, err = ss.Thread().Get(post.Id)
	require.NoError(t, err)

	// Create a team policy which is stricter than the channel policy
	teamPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "DisplayName",
			PostDurationDays: model.NewPointer(int64(20)),
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

func testThreadStorePermanentDeleteBatchThreadMembershipsForRetentionPolicies(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
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
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	post, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, rctx, ss, channel.Id, post.Id, post.UserId, 2000)

	threadMembership := createThreadMembership(userID, post.Id)

	channelPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "DisplayName",
			PostDurationDays: model.NewPointer(int64(30)),
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
			PostDurationDays: model.NewPointer(int64(20)),
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
	_, err = s.GetMaster().Exec("DELETE FROM Threads WHERE PostId='" + post.Id + "'")
	require.NoError(t, err)

	deleted, err := ss.Thread().DeleteOrphanedRows(1000)
	require.NoError(t, err)
	require.NotZero(t, deleted)
	_, err = ss.Thread().GetMembershipForUser(userID, post.Id)
	require.Error(t, err, "thread membership should have been deleted because thread no longer exists")
}

func testGetTeamsUnreadForUser(t *testing.T, rctx request.CTX, ss store.Store) {
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
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	post, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel1.Id,
		UserId:    userID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, rctx, ss, channel1.Id, post.Id, post.UserId, model.GetMillis())
	createThreadMembership(userID, post.Id)

	teamsUnread, err := ss.Thread().GetTeamsUnreadForUser(userID, []string{team1.Id}, true)
	require.NoError(t, err)
	assert.Len(t, teamsUnread, 1)
	assert.Equal(t, int64(1), teamsUnread[team1.Id].ThreadCount)

	post, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel1.Id,
		UserId:    userID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, rctx, ss, channel1.Id, post.Id, post.UserId, model.GetMillis())
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
	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team2.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	post2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel2.Id,
		UserId:    userID,
		Message:   model.NewRandomString(10),
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(false),
			},
		},
	})
	require.NoError(t, err)
	threadStoreCreateReply(t, rctx, ss, channel2.Id, post2.Id, post2.UserId, model.GetMillis())
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

func testVarious(t *testing.T, rctx request.CTX, ss store.Store) {
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

	user1, err := ss.User().Save(rctx, &model.User{
		Username: "user1" + model.NewId(),
		Email:    MakeEmail(),
	})
	require.NoError(t, err)
	user2, err := ss.User().Save(rctx, &model.User{
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

	team1channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Channel1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	team2channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team2.Id,
		DisplayName: "Channel2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	dm1, err := ss.Channel().CreateDirectChannel(rctx, &model.User{Id: user1ID}, &model.User{Id: user2ID})
	require.NoError(t, err)

	gm1, err := ss.Channel().Save(rctx, &model.Channel{
		DisplayName: "GM",
		Name:        "gm" + model.NewId(),
		Type:        model.ChannelTypeGroup,
	}, -1)
	require.NoError(t, err)

	team1channel1post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team1channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	team1channel1post2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team1channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	team1channel1post3, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team1channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(false),
			},
		},
	})
	require.NoError(t, err)

	team2channel1post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team2channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	team2channel1post2deleted, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team2channel1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	dm1post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: dm1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	gm1post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: gm1.Id,
		UserId:    user1ID,
		Message:   model.NewRandomString(10),
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(false),
			},
		},
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

	threadStoreCreateReply(t, rctx, ss, team1channel1.Id, team1channel1post1.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, rctx, ss, team1channel1.Id, team1channel1post2.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, rctx, ss, team1channel1.Id, team1channel1post3.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, rctx, ss, team2channel1.Id, team2channel1post1.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, rctx, ss, team2channel1.Id, team2channel1post2deleted.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, rctx, ss, dm1.Id, dm1post1.Id, user2ID, model.GetMillis())
	threadStoreCreateReply(t, rctx, ss, gm1.Id, gm1post1.Id, user2ID, model.GetMillis())

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
	threadStoreCreateReply(t, rctx, ss, team1channel1.Id, team1channel1post2.Id, user2ID, model.GetMillis())

	// Actually make team2channel1post2deleted deleted
	err = ss.Post().Delete(rctx, team2channel1post2deleted.Id, model.GetMillis(), user1ID)
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
		updatedPost, err := ss.Post().GetSingle(rctx, allPosts[i].Id, true)
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
			{"team1, user1, exclude direct", user1ID, team1.Id, model.GetUserThreadsOpts{ExcludeDirect: true}, []*model.Post{
				team1channel1post3,
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
				team1channel1post3, gm1post1,
			}},
			{"team1, user1", user1ID, team1.Id, model.GetUserThreadsOpts{}, []*model.Post{
				team1channel1post3, gm1post1,
			}},
			{"team2, user1", user1ID, team2.Id, model.GetUserThreadsOpts{}, []*model.Post{gm1post1}},
			{"team1, user1, exclude direct", user1ID, team2.Id, model.GetUserThreadsOpts{}, []*model.Post{team1channel1post3}},
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
			{"team2, user1, exclude direct", user1ID, team2.Id, model.GetUserThreadsOpts{ExcludeDirect: true}, []*model.Post{
				team2channel1post1,
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
			{"team2, user1, unread + deleted + exclude direct", user1ID, team2.Id, model.GetUserThreadsOpts{Unread: true, Deleted: true, ExcludeDirect: true}, []*model.Post{
				team2channel1post2deleted,
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

	t.Run(("GetThreadMembershipsForExport"), func(t *testing.T) {
		t.Run("Get members for thread, ensure usernames", func(t *testing.T) {
			members, err := ss.Thread().GetThreadMembershipsForExport(team1channel1post1.Id)
			require.NoError(t, err)

			// team1channel1post1 has 1 member
			assert.Len(t, members, 1)

			userIDs, err := ss.Thread().GetThreadFollowers(team1channel1post1.Id, true)
			require.NoError(t, err)
			require.Len(t, userIDs, 1)

			u, err := ss.User().Get(context.Background(), userIDs[0])
			require.NoError(t, err)

			assert.Equal(t, u.Username, members[0].Username)

			members, err = ss.Thread().GetThreadMembershipsForExport(team1channel1post2.Id)
			require.NoError(t, err)

			// team1channel1post2 has 2 members
			assert.Len(t, members, 2)

			userIDs, err = ss.Thread().GetThreadFollowers(team1channel1post2.Id, true)
			require.NoError(t, err)
			require.Len(t, userIDs, 2)

			for i := range userIDs {
				u, err := ss.User().Get(context.Background(), userIDs[i])
				require.NoError(t, err)

				assert.Equal(t, u.Username, members[i].Username)
			}
		})

		t.Run("Get members for a thread, ensure only following members are exported", func(t *testing.T) {
			createThreadMembership(user2ID, team1channel1post1.Id, false)

			members, err := ss.Thread().GetThreadMembershipsForExport(team1channel1post1.Id)
			require.NoError(t, err)

			// team1channel1post1 should have 2 members
			assert.Len(t, members, 2)

			_, err = ss.Thread().MaintainMembership(user2ID, team1channel1post1.Id, store.ThreadMembershipOpts{
				Following:             false,
				UpdateFollowing:       true,
				UpdateViewedTimestamp: false,
				UpdateParticipants:    true,
			})
			require.NoError(t, err)

			members, err = ss.Thread().GetThreadMembershipsForExport(team1channel1post1.Id)
			require.NoError(t, err)

			// team1channel1post1 should have 1 following member
			assert.Len(t, members, 1)

			userIDs, err := ss.Thread().GetThreadFollowers(team1channel1post1.Id, true)
			require.NoError(t, err)
			require.Len(t, userIDs, 1)

			u, err := ss.User().Get(context.Background(), userIDs[0])
			require.NoError(t, err)

			assert.Equal(t, u.Username, members[0].Username)
		})
	})
}

func testMarkAllAsReadByChannels(t *testing.T, rctx request.CTX, ss store.Store) {
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

	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Channel1",
		Name:        "channel1" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
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
		post, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel1.Id,
			UserId:    postingUserId,
			Message:   "Root",
		})
		require.NoError(t, err)

		_, err = ss.Post().Save(rctx, &model.Post{
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
		post1, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel1.Id,
			UserId:    postingUserId,
			Message:   "Root",
		})
		require.NoError(t, err)

		_, err = ss.Post().Save(rctx, &model.Post{
			ChannelId: channel1.Id,
			UserId:    postingUserId,
			RootId:    post1.Id,
			Message:   "Reply",
		})
		require.NoError(t, err)

		post2, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel2.Id,
			UserId:    postingUserId,
			Message:   "Root",
		})
		require.NoError(t, err)

		_, err = ss.Post().Save(rctx, &model.Post{
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

func testMarkAllAsReadByTeam(t *testing.T, rctx request.CTX, ss store.Store) {
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

	assertThreadReplyCount := func(t *testing.T, userID, teamID string, count int64, message string) {
		t.Helper()

		teamsUnread, err := ss.Thread().GetTeamsUnreadForUser(userID, []string{teamID}, true)
		require.NoError(t, err)
		require.Lenf(t, teamsUnread, 1, "unexpected unread teams count: %s", message)
		assert.Equalf(t, count, teamsUnread[teamID].ThreadCount, "unexpected thread count: %s", message)
	}

	postingUserId := model.NewId()
	userAID := model.NewId()
	userBID := model.NewId()

	team1, err := ss.Team().Save(&model.Team{
		DisplayName: "Team1",
		Name:        "team1" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	team1channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Team1: Channel1",
		Name:        "team1channel1" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	team1channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Team1: Channel2",
		Name:        "team1channel2" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	team2, err := ss.Team().Save(&model.Team{
		DisplayName: "Team2",
		Name:        "team2" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	team2channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team2.Id,
		DisplayName: "Team2: Channel1",
		Name:        "team2channel1" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	team2channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team2.Id,
		DisplayName: "Team2: Channel2",
		Name:        "team2channel2" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	team1channel1post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team1channel1.Id,
		UserId:    postingUserId,
		Message:   "Root",
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: team1channel1.Id,
		UserId:    postingUserId,
		RootId:    team1channel1post1.Id,
		Message:   "Reply",
	})
	require.NoError(t, err)

	team1channel2post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team1channel2.Id,
		UserId:    postingUserId,
		Message:   "Root",
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: team1channel1.Id,
		UserId:    postingUserId,
		RootId:    team1channel2post1.Id,
		Message:   "Reply",
	})
	require.NoError(t, err)

	team2channel1post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team2channel1.Id,
		UserId:    postingUserId,
		Message:   "Root",
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: team2channel1.Id,
		UserId:    postingUserId,
		RootId:    team2channel1post1.Id,
		Message:   "Reply",
	})
	require.NoError(t, err)

	team2channel2post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: team2channel2.Id,
		UserId:    postingUserId,
		Message:   "Root",
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: team2channel1.Id,
		UserId:    postingUserId,
		RootId:    team2channel2post1.Id,
		Message:   "Reply",
	})
	require.NoError(t, err)

	gm1, err := ss.Channel().Save(rctx, &model.Channel{
		DisplayName: "GM1",
		Name:        "gm1" + model.NewId(),
		Type:        model.ChannelTypeGroup,
	}, -1)
	require.NoError(t, err)

	gm1post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: gm1.Id,
		UserId:    postingUserId,
		Message:   "Root",
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: gm1.Id,
		UserId:    postingUserId,
		RootId:    gm1post1.Id,
		Message:   "Reply",
	})
	require.NoError(t, err)

	gm2, err := ss.Channel().Save(rctx, &model.Channel{
		DisplayName: "GM1",
		Name:        "gm1" + model.NewId(),
		Type:        model.ChannelTypeGroup,
	}, -1)
	require.NoError(t, err)

	gm2post1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: gm2.Id,
		UserId:    postingUserId,
		Message:   "Root",
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: gm2.Id,
		UserId:    postingUserId,
		RootId:    gm2post1.Id,
		Message:   "Reply",
	})
	require.NoError(t, err)

	t.Run("empty team", func(t *testing.T) {
		err = ss.Thread().MarkAllAsReadByTeam(model.NewId(), "")
		require.NoError(t, err)
	})

	t.Run("unknown team", func(t *testing.T) {
		err = ss.Thread().MarkAllAsReadByTeam(model.NewId(), model.NewId())
		require.NoError(t, err)
	})

	t.Run("team1", func(t *testing.T) {
		createThreadMembership(userAID, team1channel1post1.Id)
		createThreadMembership(userBID, team1channel1post1.Id)
		createThreadMembership(userAID, team1channel2post1.Id)
		createThreadMembership(userBID, team1channel2post1.Id)
		createThreadMembership(userAID, team2channel1post1.Id)
		createThreadMembership(userBID, team2channel1post1.Id)

		// Note that GMs (and similarly, DMs) don't count towards this API.
		createThreadMembership(userAID, gm1.Id)
		createThreadMembership(userBID, gm1.Id)
		createThreadMembership(userAID, gm2.Id)
		createThreadMembership(userBID, gm2.Id)

		assertThreadReplyCount(t, userAID, team1.Id, 2, "expected 2 unread messages in team1 for userA")
		assertThreadReplyCount(t, userBID, team1.Id, 2, "expected 2 unread messages in team1 for userB")
		assertThreadReplyCount(t, userAID, team2.Id, 1, "expected 1 unread message in team2 for userA")
		assertThreadReplyCount(t, userBID, team2.Id, 1, "expected 1 unread message in team2 for userB")

		err = ss.Thread().MarkAllAsReadByTeam(userAID, team1.Id)
		require.NoError(t, err)

		assertThreadReplyCount(t, userAID, team1.Id, 0, "expected 0 unread messages in team1 for userA")
		assertThreadReplyCount(t, userBID, team1.Id, 2, "expected 2 unread messages in team1 for userB")
		assertThreadReplyCount(t, userAID, team2.Id, 1, "expected 1 unread message in team2 for userA")
		assertThreadReplyCount(t, userBID, team2.Id, 1, "expected 1 unread message in team2 for userB")

		err = ss.Thread().MarkAllAsReadByTeam(userBID, team1.Id)
		require.NoError(t, err)

		assertThreadReplyCount(t, userAID, team1.Id, 0, "expected 0 unread messages in team1 for userA")
		assertThreadReplyCount(t, userBID, team1.Id, 0, "expected 0 unread messages in team1 for userB")
		assertThreadReplyCount(t, userAID, team2.Id, 1, "expected 1 unread message in team2 for userA")
		assertThreadReplyCount(t, userBID, team2.Id, 1, "expected 1 unread message in team2 for userB")
	})
}

func testDeleteMembershipsForChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	createThreadMembership := func(userID, postID string) (*model.ThreadMembership, func()) {
		t.Helper()
		opts := store.ThreadMembershipOpts{
			Following:             true,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}
		mem, err := ss.Thread().MaintainMembership(userID, postID, opts)
		require.NoError(t, err)

		return mem, func() {
			err := ss.Thread().DeleteMembershipForUser(userID, postID)
			require.NoError(t, err)
		}
	}

	postingUserID := model.NewId()
	userAID := model.NewId()
	userBID := model.NewId()

	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel1" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName2",
		Name:        "channel2" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	rootPost1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel1.Id,
		UserId:    postingUserID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel1.Id,
		UserId:    postingUserID,
		Message:   model.NewRandomString(10),
		RootId:    rootPost1.Id,
	})
	require.NoError(t, err)

	rootPost2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel2.Id,
		UserId:    postingUserID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)
	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel2.Id,
		UserId:    postingUserID,
		Message:   model.NewRandomString(10),
		RootId:    rootPost2.Id,
	})
	require.NoError(t, err)

	t.Run("should return memberships for user", func(t *testing.T) {
		memA1, cleanupA1 := createThreadMembership(userAID, rootPost1.Id)
		defer cleanupA1()
		memA2, cleanupA2 := createThreadMembership(userAID, rootPost2.Id)
		defer cleanupA2()

		membershipsA, err := ss.Thread().GetMembershipsForUser(userAID, team.Id)
		require.NoError(t, err)

		require.Len(t, membershipsA, 2)
		require.ElementsMatch(t, []*model.ThreadMembership{memA1, memA2}, membershipsA)
	})

	t.Run("should delete memberships for user for channel", func(t *testing.T) {
		_, cleanupA1 := createThreadMembership(userAID, rootPost1.Id)
		defer cleanupA1()
		memA2, cleanupA2 := createThreadMembership(userAID, rootPost2.Id)
		defer cleanupA2()

		ss.Thread().DeleteMembershipsForChannel(userAID, channel1.Id)
		membershipsA, err := ss.Thread().GetMembershipsForUser(userAID, team.Id)
		require.NoError(t, err)

		require.Len(t, membershipsA, 1)
		require.ElementsMatch(t, []*model.ThreadMembership{memA2}, membershipsA)
	})

	t.Run("deleting memberships for channel for userA should not affect userB", func(t *testing.T) {
		_, cleanupA1 := createThreadMembership(userAID, rootPost1.Id)
		defer cleanupA1()
		_, cleanupA2 := createThreadMembership(userAID, rootPost2.Id)
		defer cleanupA2()
		memB1, cleanupB2 := createThreadMembership(userBID, rootPost1.Id)
		defer cleanupB2()

		membershipsB, err := ss.Thread().GetMembershipsForUser(userBID, team.Id)
		require.NoError(t, err)

		require.Len(t, membershipsB, 1)
		require.ElementsMatch(t, []*model.ThreadMembership{memB1}, membershipsB)
	})
}

func testSaveMultipleMemberships(t *testing.T, ss store.Store) {
	t.Run("should save multiple memberships", func(t *testing.T) {
		memberships := []*model.ThreadMembership{
			{
				PostId:    model.NewId(),
				UserId:    model.NewId(),
				Following: true,
			},
			{
				PostId:    model.NewId(),
				UserId:    model.NewId(),
				Following: true,
			},
		}

		_, err := ss.Thread().SaveMultipleMemberships(memberships)
		require.NoError(t, err)
	})

	t.Run("should return error if any of the memberships is invalid", func(t *testing.T) {
		memberships := []*model.ThreadMembership{
			{
				PostId:    model.NewId(),
				UserId:    "invalid",
				Following: true,
			},
			{
				PostId:    model.NewId(),
				UserId:    model.NewId(),
				Following: true,
			},
		}

		_, err := ss.Thread().SaveMultipleMemberships(memberships)
		require.Error(t, err)
	})

	t.Run("should not fail if the list is empty", func(t *testing.T) {
		_, err := ss.Thread().SaveMultipleMemberships([]*model.ThreadMembership{})
		require.NoError(t, err)
	})

	t.Run("should fail if there is a conflict", func(t *testing.T) {
		postID := model.NewId()
		userID := model.NewId()

		memberships := []*model.ThreadMembership{
			{
				PostId:    postID,
				UserId:    userID,
				Following: true,
			},
			{
				PostId:    postID,
				UserId:    userID,
				Following: true,
			},
		}

		_, err := ss.Thread().SaveMultipleMemberships(memberships)
		require.Error(t, err)
	})
}

func testMaintainMultipleFromImport(t *testing.T, rctx request.CTX, ss store.Store) {
	createThreadMembership := func(userID, postID string, following bool) (*model.ThreadMembership, func()) {
		t.Helper()
		opts := store.ThreadMembershipOpts{
			Following:             following,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    false,
		}
		mem, err := ss.Thread().MaintainMembership(userID, postID, opts)
		require.NoError(t, err)

		return mem, func() {
			err := ss.Thread().DeleteMembershipForUser(userID, postID)
			require.NoError(t, err)
		}
	}

	cleanMembers := func(userIDs []string, postID string) error {
		// clean the thread memberships
		for _, id := range userIDs {
			err := ss.Thread().DeleteMembershipForUser(id, postID)
			if err != nil {
				return err
			}
		}
		return nil
	}

	postingUserID := model.NewId()

	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel1" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	rootPost1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel1.Id,
		UserId:    postingUserID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel1.Id,
		UserId:    postingUserID,
		Message:   model.NewRandomString(10),
		RootId:    rootPost1.Id,
	})
	require.NoError(t, err)

	t.Run("Should create new memberships from new list", func(t *testing.T) {
		userAID := model.NewId()
		userBID := model.NewId()

		_, err := ss.Thread().MaintainMultipleFromImport([]*model.ThreadMembership{
			{
				UserId:    userAID,
				PostId:    rootPost1.Id,
				Following: true,
			},
			{
				UserId:    userBID,
				PostId:    rootPost1.Id,
				Following: true,
			},
		})
		require.NoError(t, err)

		followers, err := ss.Thread().GetThreadFollowers(rootPost1.Id, true)
		require.NoError(t, err)
		require.ElementsMatch(t, followers, []string{userAID, userBID})

		// clean the thread memberships
		err = cleanMembers(followers, rootPost1.Id)
		require.NoError(t, err)
	})

	t.Run("Should add incoming memberships from the list", func(t *testing.T) {
		userAID := model.NewId()
		userBID := model.NewId()

		_, clean := createThreadMembership(userAID, rootPost1.Id, true)
		defer clean()

		_, err := ss.Thread().MaintainMultipleFromImport([]*model.ThreadMembership{
			{
				UserId:    userBID,
				PostId:    rootPost1.Id,
				Following: true,
			},
		})
		require.NoError(t, err)

		followers, err := ss.Thread().GetThreadFollowers(rootPost1.Id, true)
		require.NoError(t, err)
		require.ElementsMatch(t, followers, []string{userAID, userBID})

		// clean the thread memberships
		err = cleanMembers(followers, rootPost1.Id)
		require.NoError(t, err)
	})

	t.Run("Should update memberships if they are newer", func(t *testing.T) {
		userAID := model.NewId()

		old, clean := createThreadMembership(userAID, rootPost1.Id, true)
		defer clean()

		_, err := ss.Thread().MaintainMultipleFromImport([]*model.ThreadMembership{
			{
				UserId:     userAID,
				PostId:     rootPost1.Id,
				Following:  true,
				LastViewed: time.Now().Add(time.Minute).UnixMilli(),
			},
		})
		require.NoError(t, err)

		followers, err := ss.Thread().GetThreadFollowers(rootPost1.Id, true)
		require.NoError(t, err)
		require.ElementsMatch(t, followers, []string{userAID})

		updated, err := ss.Thread().GetMembershipForUser(userAID, rootPost1.Id)
		require.NoError(t, err)
		require.Greater(t, updated.LastViewed, old.LastViewed)

		// clean the thread memberships
		err = cleanMembers(followers, rootPost1.Id)
		require.NoError(t, err)
	})

	t.Run("Should not update membership if incoming is not newer", func(t *testing.T) {
		userAID := model.NewId()

		_, clean := createThreadMembership(userAID, rootPost1.Id, false)
		defer clean()

		_, err := ss.Thread().MaintainMultipleFromImport([]*model.ThreadMembership{
			{
				UserId:     userAID,
				PostId:     rootPost1.Id,
				Following:  true,
				LastViewed: time.Now().Add(-1 * time.Hour).UnixMilli(),
			},
		})
		require.NoError(t, err)

		followers, err := ss.Thread().GetThreadFollowers(rootPost1.Id, true)
		require.NoError(t, err)
		require.Empty(t, followers)

		m, err := ss.Thread().GetMembershipForUser(userAID, rootPost1.Id)
		require.NoError(t, err)
		require.False(t, m.Following)

		// clean the thread memberships
		err = cleanMembers(followers, rootPost1.Id)
		require.NoError(t, err)
	})
}

func testUpdateTeamIdForChannelThreads(t *testing.T, rctx request.CTX, ss store.Store) {
	createThreadMembership := func(userID, postID string, following bool) (*model.ThreadMembership, func()) {
		t.Helper()
		opts := store.ThreadMembershipOpts{
			Following:             following,
			IncrementMentions:     false,
			UpdateFollowing:       true,
			UpdateViewedTimestamp: false,
			UpdateParticipants:    true,
		}
		mem, err := ss.Thread().MaintainMembership(userID, postID, opts)
		require.NoError(t, err)

		return mem, func() {
			err := ss.Thread().DeleteMembershipForUser(userID, postID)
			require.NoError(t, err)
		}
	}

	postingUserID := model.NewId()

	team1, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	team2, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayNameTwo",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "DisplayName",
		Name:        "channel1" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	rootPost1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel1.Id,
		UserId:    postingUserID,
		Message:   model.NewRandomString(10),
	})
	require.NoError(t, err)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel1.Id,
		UserId:    postingUserID,
		Message:   model.NewRandomString(10),
		RootId:    rootPost1.Id,
	})
	require.NoError(t, err)

	t.Run("Should move threads to the new team", func(t *testing.T) {
		userA, err := ss.User().Save(request.TestContext(t), &model.User{
			Username: model.NewId(),
			Email:    MakeEmail(),
			Password: model.NewId(),
		})
		require.NoError(t, err)

		_, clean := createThreadMembership(userA.Id, rootPost1.Id, true)
		defer clean()

		err = ss.Thread().UpdateTeamIdForChannelThreads(channel1.Id, team2.Id)
		require.NoError(t, err)

		defer func() {
			err = ss.Thread().UpdateTeamIdForChannelThreads(channel1.Id, team1.Id)
			require.NoError(t, err)
		}()

		threads, err := ss.Thread().GetThreadsForUser(userA.Id, team2.Id, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		require.Len(t, threads, 1)
	})

	t.Run("Should not move threads to a non existent team", func(t *testing.T) {
		userA, err := ss.User().Save(request.TestContext(t), &model.User{
			Username: model.NewId(),
			Email:    MakeEmail(),
			Password: model.NewId(),
		})
		require.NoError(t, err)

		newTeamID := model.NewId()

		_, clean := createThreadMembership(userA.Id, rootPost1.Id, true)
		t.Cleanup(clean)

		err = ss.Thread().UpdateTeamIdForChannelThreads(channel1.Id, newTeamID)
		require.NoError(t, err)

		threads, err := ss.Thread().GetThreadsForUser(userA.Id, newTeamID, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		require.Len(t, threads, 0)

		threads, err = ss.Thread().GetThreadsForUser(userA.Id, team1.Id, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		require.Len(t, threads, 1)
	})
}
