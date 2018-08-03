// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"math"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
)

func TestChannelMemberHistoryStore(t *testing.T, ss store.Store) {
	t.Run("TestLogJoinEvent", func(t *testing.T) { testLogJoinEvent(t, ss) })
	t.Run("TestLogLeaveEvent", func(t *testing.T) { testLogLeaveEvent(t, ss) })
	t.Run("TestGetUsersInChannelAtChannelMemberHistory", func(t *testing.T) { testGetUsersInChannelAtChannelMemberHistory(t, ss) })
	t.Run("TestGetUsersInChannelAtChannelMembers", func(t *testing.T) { testGetUsersInChannelAtChannelMembers(t, ss) })
	t.Run("TestPermanentDeleteBatch", func(t *testing.T) { testPermanentDeleteBatch(t, ss) })
}

func testLogJoinEvent(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel, -1)).(*model.Channel)

	// and a test user
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// log a join event
	result := <-ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	assert.Nil(t, result.Err)
}

func testLogLeaveEvent(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel, -1)).(*model.Channel)

	// and a test user
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// log a join event, followed by a leave event
	result := <-ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	assert.Nil(t, result.Err)

	result = <-ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())
	assert.Nil(t, result.Err)
}

func testGetUsersInChannelAtChannelMemberHistory(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel, -1)).(*model.Channel)

	// and a test user
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// the user was previously in the channel a long time ago, before the export period starts
	// the existence of this record makes it look like the MessageExport feature has been active for awhile, and prevents
	// us from looking in the ChannelMembers table for data that isn't found in the ChannelMemberHistory table
	leaveTime := model.GetMillis() - 20000
	joinTime := leaveTime - 10000
	store.Must(ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime))
	store.Must(ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime))

	// log a join event
	leaveTime = model.GetMillis()
	joinTime = leaveTime - 10000
	store.Must(ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime))

	// case 1: user joins and leaves the channel before the export period begins
	channelMembers := store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-500, joinTime-100, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 0)

	// case 2: user joins the channel after the export period begins, but has not yet left the channel when the export period ends
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, joinTime+500, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Nil(t, channelMembers[0].LeaveTime)

	// case 3: user joins the channel before the export period begins, but has not yet left the channel when the export period ends
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, joinTime+500, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Nil(t, channelMembers[0].LeaveTime)

	// add a leave time for the user
	store.Must(ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime))

	// case 4: user joins the channel before the export period begins, but has not yet left the channel when the export period ends
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, leaveTime-100, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime, *channelMembers[0].LeaveTime)

	// case 5: user joins the channel after the export period begins, and leaves the channel before the export period ends
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, leaveTime+100, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime, *channelMembers[0].LeaveTime)

	// case 6: user has joined and left the channel long before the export period begins
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(leaveTime+100, leaveTime+200, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 0)
}

func testGetUsersInChannelAtChannelMembers(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel, -1)).(*model.Channel)

	// and a test user
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// clear any existing ChannelMemberHistory data that might interfere with our test
	var tableDataTruncated = false
	for !tableDataTruncated {
		if result := <-ss.ChannelMemberHistory().PermanentDeleteBatch(model.GetMillis(), 1000); result.Err != nil {
			assert.Fail(t, "Failed to truncate ChannelMemberHistory contents", result.Err.Error())
		} else {
			tableDataTruncated = result.Data.(int64) == int64(0)
		}
	}

	// in this test, we're pretending that Message Export was not activated during the export period, so there's no data
	// available in the ChannelMemberHistory table. Instead, we'll fall back to the ChannelMembers table for a rough approximation
	joinTime := int64(1000)
	leaveTime := joinTime + 5000
	store.Must(ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}))

	// in every single case, the user will be included in the export, because ChannelMembers says they were in the channel at some point in
	// the past, even though the time that they were actually in the channel doesn't necessarily overlap with the export period

	// case 1: user joins and leaves the channel before the export period begins
	channelMembers := store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-500, joinTime-100, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime-500, channelMembers[0].JoinTime)
	assert.Equal(t, joinTime-100, *channelMembers[0].LeaveTime)

	// case 2: user joins the channel after the export period begins, but has not yet left the channel when the export period ends
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, joinTime+500, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime-100, channelMembers[0].JoinTime)
	assert.Equal(t, joinTime+500, *channelMembers[0].LeaveTime)

	// case 3: user joins the channel before the export period begins, but has not yet left the channel when the export period ends
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, joinTime+500, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime+100, channelMembers[0].JoinTime)
	assert.Equal(t, joinTime+500, *channelMembers[0].LeaveTime)

	// case 4: user joins the channel before the export period begins, but has not yet left the channel when the export period ends
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, leaveTime-100, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime+100, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime-100, *channelMembers[0].LeaveTime)

	// case 5: user joins the channel after the export period begins, and leaves the channel before the export period ends
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, leaveTime+100, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, joinTime-100, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime+100, *channelMembers[0].LeaveTime)

	// case 6: user has joined and left the channel long before the export period begins
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(leaveTime+100, leaveTime+200, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, user.Username, channelMembers[0].Username)
	assert.Equal(t, leaveTime+100, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime+200, *channelMembers[0].LeaveTime)
}

func testPermanentDeleteBatch(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel, -1)).(*model.Channel)

	// and two test users
	user := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	user2 := model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
		Username: model.NewId(),
	}
	user2 = *store.Must(ss.User().Save(&user2)).(*model.User)

	// user1 joins and leaves the channel
	leaveTime := model.GetMillis()
	joinTime := leaveTime - 10000
	store.Must(ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime))
	store.Must(ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime))

	// user2 joins the channel but never leaves
	store.Must(ss.ChannelMemberHistory().LogJoinEvent(user2.Id, channel.Id, joinTime))

	// in between the join time and the leave time, both users were members of the channel
	channelMembers := store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+10, leaveTime-10, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 2)

	// the permanent delete should delete at least one record
	rowsDeleted := store.Must(ss.ChannelMemberHistory().PermanentDeleteBatch(leaveTime, math.MaxInt64)).(int64)
	assert.NotEqual(t, int64(0), rowsDeleted)

	// after the delete, there should be one less member in the channel
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+10, leaveTime-10, channel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, user2.Id, channelMembers[0].UserId)
}
