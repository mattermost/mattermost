// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"math"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestChannelMemberHistoryStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("TestLogJoinEvent", func(t *testing.T) { testLogJoinEvent(t, rctx, ss) })
	t.Run("TestLogLeaveEvent", func(t *testing.T) { testLogLeaveEvent(t, rctx, ss) })
	t.Run("TestGetUsersInChannelAtChannelMemberHistory", func(t *testing.T) { testGetUsersInChannelAtChannelMemberHistory(t, rctx, ss) })
	t.Run("TestGetUsersInChannelAtChannelMembers", func(t *testing.T) { testGetUsersInChannelAtChannelMembers(t, rctx, ss) })
	t.Run("TestPermanentDeleteBatch", func(t *testing.T) { testPermanentDeleteBatch(t, rctx, ss) })
	t.Run("TestPermanentDeleteBatchForRetentionPolicies", func(t *testing.T) { testPermanentDeleteBatchForRetentionPolicies(t, rctx, ss) })
	t.Run("TestGetChannelsLeftSince", func(t *testing.T) { testGetChannelsLeftSince(t, rctx, ss) })
}

func testLogJoinEvent(t *testing.T, rctx request.CTX, ss store.Store) {
	// create a test channel
	ch := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        NewTestID(),
		Type:        model.ChannelTypeOpen,
	}
	channel, err := ss.Channel().Save(rctx, &ch, -1)
	require.NoError(t, err)

	// and a test user
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewUsername(),
	}
	userPtr, err := ss.User().Save(rctx, &user)
	require.NoError(t, err)
	user = *userPtr

	// log a join event
	err = ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	assert.NoError(t, err)
}

func testLogLeaveEvent(t *testing.T, rctx request.CTX, ss store.Store) {
	// create a test channel
	ch := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        NewTestID(),
		Type:        model.ChannelTypeOpen,
	}
	channel, err := ss.Channel().Save(rctx, &ch, -1)
	require.NoError(t, err)

	// and a test user
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewUsername(),
	}
	userPtr, err := ss.User().Save(rctx, &user)
	require.NoError(t, err)
	user = *userPtr

	// log a join event, followed by a leave event
	err = ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	assert.NoError(t, err)

	err = ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())
	assert.NoError(t, err)
}

func testGetUsersInChannelAtChannelMemberHistory(t *testing.T, rctx request.CTX, ss store.Store) {
	// create a test channel
	ch := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        NewTestID(),
		Type:        model.ChannelTypeOpen,
	}
	channel, err := ss.Channel().Save(rctx, ch, -1)
	require.NoError(t, err)

	// and a test user
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewUsername(),
	}
	userPtr, err := ss.User().Save(rctx, &user)
	require.NoError(t, err)
	user = *userPtr

	// the user was previously in the channel a long time ago, before the export period starts
	// the existence of this record makes it look like the MessageExport feature has been active for awhile, and prevents
	// us from looking in the ChannelMembers table for data that isn't found in the ChannelMemberHistory table
	leaveTime := model.GetMillis() - 20000
	joinTime := leaveTime - 10000
	err = ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime)
	require.NoError(t, err)
	err = ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime)
	require.NoError(t, err)

	// log a join event
	leaveTime = model.GetMillis()
	joinTime = leaveTime - 10000
	err = ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime)
	require.NoError(t, err)

	// case 1: user joins and leaves the channel before the export period begins
	channelMembers, err := ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-500, joinTime-100, channel.Id)
	require.NoError(t, err)
	assert.Empty(t, channelMembers)

	// case 2: user joins the channel after the export period begins, but has not yet left the channel when the export period ends
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, joinTime+500, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Nil(t, channelMembers[0].LeaveTime)

	// case 3: user joins the channel before the export period begins, but has not yet left the channel when the export period ends
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, joinTime+500, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Nil(t, channelMembers[0].LeaveTime)

	// add a leave time for the user
	err = ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime)
	require.NoError(t, err)

	// case 4: user joins the channel before the export period begins, but has not yet left the channel when the export period ends
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, leaveTime-100, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime, *channelMembers[0].LeaveTime)

	// case 5: user joins the channel after the export period begins, and leaves the channel before the export period ends
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, leaveTime+100, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime, *channelMembers[0].LeaveTime)

	// case 6: user has joined and left the channel long before the export period begins
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(leaveTime+100, leaveTime+200, channel.Id)
	require.NoError(t, err)
	assert.Empty(t, channelMembers)
}

func testGetUsersInChannelAtChannelMembers(t *testing.T, rctx request.CTX, ss store.Store) {
	// create a test channel
	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        NewTestID(),
		Type:        model.ChannelTypeOpen,
	}
	channel, err := ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, err)

	// and a test user
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewUsername(),
	}
	userPtr, err := ss.User().Save(rctx, &user)
	require.NoError(t, err)
	user = *userPtr

	// clear any existing ChannelMemberHistory data that might interfere with our test
	var tableDataTruncated = false
	for !tableDataTruncated {
		var count int64
		count, _, err = ss.ChannelMemberHistory().PermanentDeleteBatchForRetentionPolicies(
			0, model.GetMillis(), 1000, model.RetentionPolicyCursor{})
		require.NoError(t, err, "Failed to truncate ChannelMemberHistory contents")
		tableDataTruncated = count == int64(0)
	}

	// in this test, we're pretending that Message Export was not activated during the export period, so there's no data
	// available in the ChannelMemberHistory table. Instead, we'll fall back to the ChannelMembers table for a rough approximation
	joinTime := int64(1000)
	leaveTime := joinTime + 5000
	_, err = ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	// in every single case, the user will be included in the export, because ChannelMembers says they were in the channel at some point in
	// the past, even though the time that they were actually in the channel doesn't necessarily overlap with the export period

	// case 1: user joins and leaves the channel before the export period begins
	channelMembers, err := ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-500, joinTime-100, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime-500, channelMembers[0].JoinTime)
	assert.Equal(t, joinTime-100, *channelMembers[0].LeaveTime)

	// case 2: user joins the channel after the export period begins, but has not yet left the channel when the export period ends
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, joinTime+500, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime-100, channelMembers[0].JoinTime)
	assert.Equal(t, joinTime+500, *channelMembers[0].LeaveTime)

	// case 3: user joins the channel before the export period begins, but has not yet left the channel when the export period ends
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, joinTime+500, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime+100, channelMembers[0].JoinTime)
	assert.Equal(t, joinTime+500, *channelMembers[0].LeaveTime)

	// case 4: user joins the channel before the export period begins, but has not yet left the channel when the export period ends
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, leaveTime-100, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime+100, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime-100, *channelMembers[0].LeaveTime)

	// case 5: user joins the channel after the export period begins, and leaves the channel before the export period ends
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, leaveTime+100, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime-100, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime+100, *channelMembers[0].LeaveTime)

	// case 6: user has joined and left the channel long before the export period begins
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(leaveTime+100, leaveTime+200, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, leaveTime+100, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime+200, *channelMembers[0].LeaveTime)
}

func testPermanentDeleteBatch(t *testing.T, rctx request.CTX, ss store.Store) {
	// create a test channel
	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        NewTestID(),
		Type:        model.ChannelTypeOpen,
	}
	channel, err := ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, err)

	// and two test users
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewUsername(),
	}
	userPtr, err := ss.User().Save(rctx, &user)
	require.NoError(t, err)
	user = *userPtr

	user2 := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewUsername(),
	}
	user2Ptr, err := ss.User().Save(rctx, &user2)
	require.NoError(t, err)
	user2 = *user2Ptr

	// user1 joins and leaves the channel
	leaveTime := model.GetMillis()
	joinTime := leaveTime - 10000
	err = ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime)
	require.NoError(t, err)
	err = ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime)
	require.NoError(t, err)

	// user2 joins the channel but never leaves
	err = ss.ChannelMemberHistory().LogJoinEvent(user2.Id, channel.Id, joinTime)
	require.NoError(t, err)

	// in between the join time and the leave time, both users were members of the channel
	channelMembers, err := ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+10, leaveTime-10, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 2)

	// the permanent delete should delete at least one record
	rowsDeleted, _, err := ss.ChannelMemberHistory().PermanentDeleteBatchForRetentionPolicies(
		0, leaveTime+1, math.MaxInt64, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	assert.NotEqual(t, int64(0), rowsDeleted)

	// after the delete, there should be one less member in the channel
	channelMembers, err = ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+10, leaveTime-10, channel.Id)
	require.NoError(t, err)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, user2.Id, channelMembers[0].UserId)
}

func testPermanentDeleteBatchForRetentionPolicies(t *testing.T, rctx request.CTX, ss store.Store) {
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
	userID := model.NewId()

	joinTime := int64(1000)
	leaveTime := int64(1500)
	err = ss.ChannelMemberHistory().LogJoinEvent(userID, channel.Id, joinTime)
	require.NoError(t, err)
	err = ss.ChannelMemberHistory().LogLeaveEvent(userID, channel.Id, leaveTime)
	require.NoError(t, err)

	channelPolicy, err := ss.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "DisplayName",
			PostDurationDays: model.NewPointer(int64(30)),
		},
		ChannelIDs: []string{channel.Id},
	})
	require.NoError(t, err)

	nowMillis := leaveTime + *channelPolicy.PostDurationDays*model.DayInMilliseconds + 1
	_, _, err = ss.ChannelMemberHistory().PermanentDeleteBatchForRetentionPolicies(
		nowMillis, 0, limit, model.RetentionPolicyCursor{})
	require.NoError(t, err)
	result, err := ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime, leaveTime, channel.Id)
	require.NoError(t, err)
	require.Empty(t, result, "history should have been deleted by channel policy")
	rows, err := ss.RetentionPolicy().GetIdsForDeletionByTableName("ChannelMemberHistory", 1000)
	require.NoError(t, err)
	require.Equal(t, 0, len(rows))
}

func testGetChannelsLeftSince(t *testing.T, rctx request.CTX, ss store.Store) {
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

	userID := model.NewId()

	joinTime := int64(1000)
	err = ss.ChannelMemberHistory().LogJoinEvent(userID, channel.Id, joinTime)
	require.NoError(t, err)

	// has not left
	ids, err := ss.ChannelMemberHistory().GetChannelsLeftSince(userID, joinTime)
	require.NoError(t, err)
	assert.Empty(t, ids)

	// left
	err = ss.ChannelMemberHistory().LogLeaveEvent(userID, channel.Id, joinTime+100)
	require.NoError(t, err)
	ids, err = ss.ChannelMemberHistory().GetChannelsLeftSince(userID, joinTime+100)
	require.NoError(t, err)
	assert.Equal(t, []string{channel.Id}, ids)
	ids, err = ss.ChannelMemberHistory().GetChannelsLeftSince(userID, joinTime+200)
	require.NoError(t, err)
	assert.Empty(t, ids)

	// joined and left again.
	err = ss.ChannelMemberHistory().LogJoinEvent(userID, channel.Id, joinTime+200)
	require.NoError(t, err)
	err = ss.ChannelMemberHistory().LogLeaveEvent(userID, channel.Id, joinTime+300)
	require.NoError(t, err)
	// should be same for both time stamps
	ids, err = ss.ChannelMemberHistory().GetChannelsLeftSince(userID, joinTime+100)
	require.NoError(t, err)
	assert.Equal(t, []string{channel.Id}, ids)
	ids, err = ss.ChannelMemberHistory().GetChannelsLeftSince(userID, joinTime+300)
	require.NoError(t, err)
	assert.Equal(t, []string{channel.Id}, ids)
}
