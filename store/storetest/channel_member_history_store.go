// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
)

func TestChannelMemberHistoryStore(t *testing.T, ss store.Store) {
	t.Run("Log Join Event", func(t *testing.T) { testLogJoinEvent(t, ss) })
	t.Run("Log Leave Event", func(t *testing.T) { testLogLeaveEvent(t, ss) })
	t.Run("Get Users In Channel At Time", func(t *testing.T) { testGetUsersInChannelAt(t, ss) })
	t.Run("Purge History", func(t *testing.T) { testPermanentDeleteBatch(t, ss) })
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
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
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
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// log a join event, followed by a leave event
	result := <-ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	assert.Nil(t, result.Err)

	result = <-ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())
	assert.Nil(t, result.Err)
}

func testGetUsersInChannelAt(t *testing.T, ss store.Store) {
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
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// log a join event
	leaveTime := model.GetMillis()
	joinTime := leaveTime - 10000
	store.Must(ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime))

	// case 1: both start and end before join time
	channelMembers := store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-500, joinTime-100, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 0)

	// case 2: start before join time, no leave time
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, joinTime+100, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Nil(t, channelMembers[0].LeaveTime)

	// case 3: start after join time, no leave time
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, joinTime+500, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Nil(t, channelMembers[0].LeaveTime)

	// add a leave time for the user
	store.Must(ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime))

	// case 4: start after join time, end before leave time
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+100, leaveTime-100, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime, *channelMembers[0].LeaveTime)

	// case 5: start before join time, end after leave time
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime-100, leaveTime+100, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, user.Email, channelMembers[0].UserEmail)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime, *channelMembers[0].LeaveTime)

	// case 6: start and end after leave time
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(leaveTime+100, leaveTime+200, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 0)
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
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	user2 := model.User{
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
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
	channelMembers := store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+10, leaveTime-10, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 2)

	// but if we purge the old data, only the user that didn't leave is left
	rowsDeleted := store.Must(ss.ChannelMemberHistory().PermanentDeleteBatchForChannel(channel.Id, leaveTime, 2)).(int64)
	assert.Equal(t, int64(1), rowsDeleted)

	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelDuring(joinTime+10, leaveTime-10, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, user2.Id, channelMembers[0].UserId)
}
