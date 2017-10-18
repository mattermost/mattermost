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
	t.Run("Purge History", func(t *testing.T) { testPurgeHistoryBefore(t, ss) })
}

func testLogJoinEvent(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel)).(*model.Channel)

	// and a test user
	user := model.User{
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// log a join event
	channelMemberHistory := *store.Must(ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())).(*model.ChannelMemberHistory)
	assert.Equal(t, channel.Id, channelMemberHistory.ChannelId)
	assert.Equal(t, user.Id, channelMemberHistory.UserId)
	assert.True(t, channelMemberHistory.JoinTime > 0)
	assert.Nil(t, channelMemberHistory.LeaveTime)
}

func testLogLeaveEvent(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel)).(*model.Channel)

	// and a test user
	user := model.User{
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// log a join event, followed by a leave event
	store.Must(ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()))
	channelMemberHistory := *store.Must(ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())).(*model.ChannelMemberHistory)
	assert.Equal(t, channel.Id, channelMemberHistory.ChannelId)
	assert.Equal(t, user.Id, channelMemberHistory.UserId)
	assert.True(t, channelMemberHistory.JoinTime > 0)
	assert.True(t, *channelMemberHistory.LeaveTime > 0)
}

func testGetUsersInChannelAt(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel)).(*model.Channel)

	// and a test user
	user := model.User{
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// log a join event, followed by a leave event
	leaveTime := model.GetMillis()
	joinTime := leaveTime - 10000
	store.Must(ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime))
	store.Must(ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime))

	// in between the join time and the leave time, the user was a member of the channel
	channelMembers := store.Must(ss.ChannelMemberHistory().GetUsersInChannelAt(joinTime+10, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 1)
	assert.Equal(t, channel.Id, channelMembers[0].ChannelId)
	assert.Equal(t, user.Id, channelMembers[0].UserId)
	assert.Equal(t, joinTime, channelMembers[0].JoinTime)
	assert.Equal(t, leaveTime, *channelMembers[0].LeaveTime)

	// outside of those bounds, they were not
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelAt(joinTime-10, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 0)

	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelAt(leaveTime+10, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 0)
}

func testPurgeHistoryBefore(t *testing.T, ss store.Store) {
	// create a test channel
	channel := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = *store.Must(ss.Channel().Save(&channel)).(*model.Channel)

	// and a test user
	user := model.User{
		Email:    model.NewId() + "@mattermost.com",
		Nickname: model.NewId(),
	}
	user = *store.Must(ss.User().Save(&user)).(*model.User)

	// log a join event, followed by a leave event
	leaveTime := model.GetMillis()
	joinTime := leaveTime - 10000
	store.Must(ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, joinTime))
	store.Must(ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, leaveTime))

	// in between the join time and the leave time, the user was a member of the channel
	channelMembers := store.Must(ss.ChannelMemberHistory().GetUsersInChannelAt(joinTime+10, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 1)

	// but if we purge the old data, that's no longer the case
	store.Must(ss.ChannelMemberHistory().PurgeHistoryBefore(leaveTime))
	channelMembers = store.Must(ss.ChannelMemberHistory().GetUsersInChannelAt(joinTime+10, channel.Id)).([]*model.ChannelMemberHistory)
	assert.Len(t, channelMembers, 0)
}
