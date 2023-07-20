// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestPermanentDeleteChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableIncomingWebhooks = true
		*cfg.ServiceSettings.EnableOutgoingWebhooks = true
	})

	channel, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "deletion-test", Name: "deletion-test", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.NotNil(t, channel, "Channel shouldn't be nil")
	require.Nil(t, err)
	defer func() {
		th.App.PermanentDeleteChannel(th.Context, channel)
	}()

	incoming, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, channel, &model.IncomingWebhook{ChannelId: channel.Id})
	require.NotNil(t, incoming, "incoming webhook should not be nil")
	require.Nil(t, err, "Unable to create Incoming Webhook for Channel")
	defer th.App.DeleteIncomingWebhook(incoming.Id)

	incoming, err = th.App.GetIncomingWebhook(incoming.Id)
	require.NotNil(t, incoming, "incoming webhook should not be nil")
	require.Nil(t, err, "Unable to get new incoming webhook")

	outgoing, err := th.App.CreateOutgoingWebhook(&model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       channel.TeamId,
		CreatorId:    th.BasicUser.Id,
		CallbackURLs: []string{"http://foo"},
	})
	require.Nil(t, err)
	defer th.App.DeleteOutgoingWebhook(outgoing.Id)

	outgoing, err = th.App.GetOutgoingWebhook(outgoing.Id)
	require.NotNil(t, outgoing, "Outgoing webhook should not be nil")
	require.Nil(t, err, "Unable to get new outgoing webhook")

	err = th.App.PermanentDeleteChannel(th.Context, channel)
	require.Nil(t, err)

	incoming, err = th.App.GetIncomingWebhook(incoming.Id)
	require.Nil(t, incoming, "Incoming webhook should be nil")
	require.NotNil(t, err, "Incoming webhook wasn't deleted")

	outgoing, err = th.App.GetOutgoingWebhook(outgoing.Id)
	require.Nil(t, outgoing, "Outgoing webhook should be nil")
	require.NotNil(t, err, "Outgoing webhook wasn't deleted")
}

func TestRemoveAllDeactivatedMembersFromChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	var err *model.AppError

	team := th.CreateTeam()
	channel := th.CreateChannel(th.Context, team)
	defer func() {
		th.App.PermanentDeleteChannel(th.Context, channel)
		th.App.PermanentDeleteTeam(th.Context, team)
	}()

	_, _, err = th.App.AddUserToTeam(th.Context, team.Id, th.BasicUser.Id, "")
	require.Nil(t, err)

	deactivatedUser := th.CreateUser()
	_, _, err = th.App.AddUserToTeam(th.Context, team.Id, deactivatedUser.Id, "")
	require.Nil(t, err)
	_, err = th.App.AddUserToChannel(th.Context, deactivatedUser, channel, false)
	require.Nil(t, err)
	channelMembers, err := th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 10000000)
	require.Nil(t, err)
	require.Len(t, channelMembers, 2)
	_, err = th.App.UpdateActive(th.Context, deactivatedUser, false)
	require.Nil(t, err)

	err = th.App.RemoveAllDeactivatedMembersFromChannel(th.Context, channel)
	require.Nil(t, err)

	channelMembers, err = th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 10000000)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)
}

func TestMoveChannel(t *testing.T) {
	t.Run("should move channels between teams", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		var err *model.AppError

		sourceTeam := th.CreateTeam()
		targetTeam := th.CreateTeam()
		channel1 := th.CreateChannel(th.Context, sourceTeam)
		defer func() {
			th.App.PermanentDeleteChannel(th.Context, channel1)
			th.App.PermanentDeleteTeam(th.Context, sourceTeam)
			th.App.PermanentDeleteTeam(th.Context, targetTeam)
		}()

		_, _, err = th.App.AddUserToTeam(th.Context, sourceTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, err)

		_, _, err = th.App.AddUserToTeam(th.Context, sourceTeam.Id, th.BasicUser2.Id, "")
		require.Nil(t, err)

		_, _, err = th.App.AddUserToTeam(th.Context, targetTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, th.BasicUser, channel1, false)
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, th.BasicUser2, channel1, false)
		require.Nil(t, err)

		err = th.App.MoveChannel(th.Context, targetTeam, channel1, th.BasicUser)
		require.NotNil(t, err, "Should have failed due to mismatched members.")

		_, _, err = th.App.AddUserToTeam(th.Context, targetTeam.Id, th.BasicUser2.Id, "")
		require.Nil(t, err)

		err = th.App.MoveChannel(th.Context, targetTeam, channel1, th.BasicUser)
		require.Nil(t, err)

		// Test moving a channel with a deactivated user who isn't in the destination team.
		// It should fail, unless removeDeactivatedMembers is true.
		deactivatedUser := th.CreateUser()
		channel2 := th.CreateChannel(th.Context, sourceTeam)
		defer th.App.PermanentDeleteChannel(th.Context, channel2)

		_, _, err = th.App.AddUserToTeam(th.Context, sourceTeam.Id, deactivatedUser.Id, "")
		require.Nil(t, err)
		_, err = th.App.AddUserToChannel(th.Context, th.BasicUser, channel2, false)
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, deactivatedUser, channel2, false)
		require.Nil(t, err)

		_, err = th.App.UpdateActive(th.Context, deactivatedUser, false)
		require.Nil(t, err)

		err = th.App.MoveChannel(th.Context, targetTeam, channel2, th.BasicUser)
		require.NotNil(t, err, "Should have failed due to mismatched deactivated member.")

		// Test moving a channel with no members.
		channel3 := &model.Channel{
			DisplayName: "dn_" + model.NewId(),
			Name:        "name_" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      sourceTeam.Id,
			CreatorId:   th.BasicUser.Id,
		}

		channel3, err = th.App.CreateChannel(th.Context, channel3, false)
		require.Nil(t, err)
		defer th.App.PermanentDeleteChannel(th.Context, channel3)

		err = th.App.MoveChannel(th.Context, targetTeam, channel3, th.BasicUser)
		assert.Nil(t, err)
	})

	t.Run("should remove sidebar entries when moving channels from one team to another", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		sourceTeam := th.CreateTeam()
		targetTeam := th.CreateTeam()
		channel := th.CreateChannel(th.Context, sourceTeam)

		th.LinkUserToTeam(th.BasicUser, sourceTeam)
		th.LinkUserToTeam(th.BasicUser, targetTeam)
		th.AddUserToChannel(th.BasicUser, channel)

		// Put the channel in a custom category so that it explicitly exists in SidebarChannels
		category, err := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, sourceTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "new category",
			},
			Channels: []string{channel.Id},
		})
		require.Nil(t, err)
		require.Equal(t, []string{channel.Id}, category.Channels)

		err = th.App.MoveChannel(th.Context, targetTeam, channel, th.BasicUser)
		require.Nil(t, err)

		moved, err := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, err)
		require.Equal(t, targetTeam.Id, moved.TeamId)

		// The channel should no longer be on the old team
		updatedCategory, err := th.App.GetSidebarCategory(th.Context, category.Id)
		require.Nil(t, err)
		assert.Equal(t, []string{}, updatedCategory.Channels)

		// And it should be on the new team instead
		categories, err := th.App.GetSidebarCategoriesForTeamForUser(th.Context, th.BasicUser.Id, targetTeam.Id)
		require.Nil(t, err)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Contains(t, categories.Categories[1].Channels, channel.Id)
	})
}

func TestRemoveUsersFromChannelNotMemberOfTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.CreateTeam()
	team2 := th.CreateTeam()
	channel1 := th.CreateChannel(th.Context, team)
	defer func() {
		th.App.PermanentDeleteChannel(th.Context, channel1)
		th.App.PermanentDeleteTeam(th.Context, team)
		th.App.PermanentDeleteTeam(th.Context, team2)
	}()

	_, _, err := th.App.AddUserToTeam(th.Context, team.Id, th.BasicUser.Id, "")
	require.Nil(t, err)
	_, _, err = th.App.AddUserToTeam(th.Context, team2.Id, th.BasicUser.Id, "")
	require.Nil(t, err)
	_, _, err = th.App.AddUserToTeam(th.Context, team.Id, th.BasicUser2.Id, "")
	require.Nil(t, err)

	_, err = th.App.AddUserToChannel(th.Context, th.BasicUser, channel1, false)
	require.Nil(t, err)
	_, err = th.App.AddUserToChannel(th.Context, th.BasicUser2, channel1, false)
	require.Nil(t, err)

	err = th.App.RemoveUsersFromChannelNotMemberOfTeam(th.Context, th.SystemAdminUser, channel1, team2)
	require.Nil(t, err)

	channelMembers, err := th.App.GetChannelMembersPage(th.Context, channel1.Id, 0, 10000000)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)
	members := make([]model.ChannelMember, len(channelMembers))
	copy(members, channelMembers)
	require.Equal(t, members[0].UserId, th.BasicUser.Id)
}

func TestJoinDefaultChannelsCreatesChannelMemberHistoryRecordTownSquare(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// figure out the initial number of users in town square
	channel, err := th.App.Srv().Store().Channel().GetByName(th.BasicTeam.Id, "town-square", true)
	require.NoError(t, err)
	townSquareChannelId := channel.Id
	users, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, townSquareChannelId)
	require.NoError(t, nErr)
	initialNumTownSquareUsers := len(users)

	// create a new user that joins the default channels
	user := th.CreateUser()
	th.App.JoinDefaultChannels(th.Context, th.BasicTeam.Id, user, false, "")

	// there should be a ChannelMemberHistory record for the user
	histories, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, townSquareChannelId)
	require.NoError(t, nErr)
	assert.Len(t, histories, initialNumTownSquareUsers+1)

	found := false
	for _, history := range histories {
		if user.Id == history.UserId && townSquareChannelId == history.ChannelId {
			found = true
			break
		}
	}
	assert.True(t, found)
}

func TestJoinDefaultChannelsCreatesChannelMemberHistoryRecordOffTopic(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// figure out the initial number of users in off-topic
	channel, err := th.App.Srv().Store().Channel().GetByName(th.BasicTeam.Id, "off-topic", true)
	require.NoError(t, err)
	offTopicChannelId := channel.Id
	users, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, offTopicChannelId)
	require.NoError(t, nErr)
	initialNumTownSquareUsers := len(users)

	// create a new user that joins the default channels
	user := th.CreateUser()
	th.App.JoinDefaultChannels(th.Context, th.BasicTeam.Id, user, false, "")

	// there should be a ChannelMemberHistory record for the user
	histories, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, offTopicChannelId)
	require.NoError(t, nErr)
	assert.Len(t, histories, initialNumTownSquareUsers+1)

	found := false
	for _, history := range histories {
		if user.Id == history.UserId && offTopicChannelId == history.ChannelId {
			found = true
			break
		}
	}
	assert.True(t, found)
}

func TestJoinDefaultChannelsExperimentalDefaultChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	basicChannel2 := th.CreateChannel(th.Context, th.BasicTeam)
	defer th.App.PermanentDeleteChannel(th.Context, basicChannel2)
	defaultChannelList := []string{th.BasicChannel.Name, basicChannel2.Name, basicChannel2.Name}
	th.App.Config().TeamSettings.ExperimentalDefaultChannels = defaultChannelList

	user := th.CreateUser()
	th.App.JoinDefaultChannels(th.Context, th.BasicTeam.Id, user, false, "")

	for _, channelName := range defaultChannelList {
		channel, err := th.App.GetChannelByName(th.Context, channelName, th.BasicTeam.Id, false)
		require.Nil(t, err, "Expected nil, didn't receive nil")

		member, err := th.App.GetChannelMember(th.Context, channel.Id, user.Id)

		require.NotNil(t, member, "Expected member object, got nil")
		require.Nil(t, err, "Expected nil object, didn't receive nil")
	}
}

func TestJoinDefaultChannelsExperimentalDefaultChannelsMissing(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	basicChannel2 := th.CreateChannel(th.Context, th.BasicTeam)
	defer th.App.PermanentDeleteChannel(th.Context, basicChannel2)
	defaultChannelList := []string{th.BasicChannel.Name, basicChannel2.Name, "thischanneldoesnotexist", basicChannel2.Name}
	th.App.Config().TeamSettings.ExperimentalDefaultChannels = defaultChannelList

	user := th.CreateUser()
	require.Nil(t, th.App.JoinDefaultChannels(th.Context, th.BasicTeam.Id, user, false, ""))

	for _, channelName := range defaultChannelList {
		if channelName == "thischanneldoesnotexist" {
			continue // skip the non-existent channel
		}

		channel, err := th.App.GetChannelByName(th.Context, channelName, th.BasicTeam.Id, false)
		require.Nil(t, err, "Expected nil, didn't receive nil")

		member, err := th.App.GetChannelMember(th.Context, channel.Id, user.Id)

		require.NotNil(t, member, "Expected member object, got nil")
		require.Nil(t, err, "Expected nil object, didn't receive nil")
	}
}

func TestCreateChannelPublicCreatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// creates a public channel and adds basic user to it
	publicChannel := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen)

	// there should be a ChannelMemberHistory record for the user
	histories, err := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, publicChannel.Id)
	require.NoError(t, err)
	assert.Len(t, histories, 1)
	assert.Equal(t, th.BasicUser.Id, histories[0].UserId)
	assert.Equal(t, publicChannel.Id, histories[0].ChannelId)
}

func TestCreateChannelPrivateCreatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// creates a private channel and adds basic user to it
	privateChannel := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypePrivate)

	// there should be a ChannelMemberHistory record for the user
	histories, err := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, privateChannel.Id)
	require.NoError(t, err)
	assert.Len(t, histories, 1)
	assert.Equal(t, th.BasicUser.Id, histories[0].UserId)
	assert.Equal(t, privateChannel.Id, histories[0].ChannelId)
}
func TestCreateChannelDisplayNameTrimsWhitespace(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "  Public 1  ", Name: "public1", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	defer th.App.PermanentDeleteChannel(th.Context, channel)
	require.Nil(t, err)
	require.Equal(t, channel.DisplayName, "Public 1")
}

func TestUpdateChannelPrivacy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	privateChannel := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypePrivate)
	privateChannel.Type = model.ChannelTypeOpen

	publicChannel, err := th.App.UpdateChannelPrivacy(th.Context, privateChannel, th.BasicUser)
	require.Nil(t, err, "Failed to update channel privacy.")
	assert.Equal(t, publicChannel.Id, privateChannel.Id)
	assert.Equal(t, publicChannel.Type, model.ChannelTypeOpen)
}

func TestGetOrCreateDirectChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team1 := th.CreateTeam()
	team2 := th.CreateTeam()

	user1 := th.CreateUser()
	th.LinkUserToTeam(user1, team1)

	user2 := th.CreateUser()
	th.LinkUserToTeam(user2, team2)

	bot1 := th.CreateBot()

	t.Run("Bot can create with restriction", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			setting := model.DirectMessageTeam
			cfg.TeamSettings.RestrictDirectMessage = &setting
		})

		// check with bot in first userid param
		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, bot1.UserId, user1.Id)
		require.NotNil(t, channel, "channel should be non-nil")
		require.Nil(t, appErr)

		// check with bot in second userid param
		channel, appErr = th.App.GetOrCreateDirectChannel(th.Context, user1.Id, bot1.UserId)
		require.NotNil(t, channel, "channel should be non-nil")
		require.Nil(t, appErr)
	})

	t.Run("User from other team cannot create with restriction", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			setting := model.DirectMessageTeam
			cfg.TeamSettings.RestrictDirectMessage = &setting
		})

		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, channel, "channel should be nil")
		require.NotNil(t, appErr)
	})
}

func TestCreateGroupChannelCreatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := th.CreateUser()
	user2 := th.CreateUser()

	groupUserIds := make([]string, 0)
	groupUserIds = append(groupUserIds, user1.Id)
	groupUserIds = append(groupUserIds, user2.Id)
	groupUserIds = append(groupUserIds, th.BasicUser.Id)

	channel, err := th.App.CreateGroupChannel(th.Context, groupUserIds, th.BasicUser.Id)

	require.Nil(t, err, "Failed to create group channel.")
	histories, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.NoError(t, nErr)
	assert.Len(t, histories, 3)

	channelMemberHistoryUserIds := make([]string, 0)
	for _, history := range histories {
		assert.Equal(t, channel.Id, history.ChannelId)
		channelMemberHistoryUserIds = append(channelMemberHistoryUserIds, history.UserId)
	}

	sort.Strings(groupUserIds)
	sort.Strings(channelMemberHistoryUserIds)
	assert.Equal(t, groupUserIds, channelMemberHistoryUserIds)
}

func TestCreateDirectChannelCreatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user1 := th.CreateUser()
	user2 := th.CreateUser()

	channel, err := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
	require.Nil(t, err, "Failed to create direct channel.")

	histories, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.NoError(t, nErr)
	assert.Len(t, histories, 2)

	historyId0 := histories[0].UserId
	historyId1 := histories[1].UserId
	switch historyId0 {
	case user1.Id:
		assert.Equal(t, user2.Id, historyId1)
	case user2.Id:
		assert.Equal(t, user1.Id, historyId1)
	default:
		require.Fail(t, "Unexpected user id in ChannelMemberHistory table", historyId0)
	}
}

func TestGetDirectChannelCreatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user1 := th.CreateUser()
	user2 := th.CreateUser()

	// this function call implicitly creates a direct channel between the two users if one doesn't already exist
	channel, err := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
	require.Nil(t, err, "Failed to create direct channel.")

	// there should be a ChannelMemberHistory record for both users
	histories, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.NoError(t, nErr)
	assert.Len(t, histories, 2)

	historyId0 := histories[0].UserId
	historyId1 := histories[1].UserId
	switch historyId0 {
	case user1.Id:
		assert.Equal(t, user2.Id, historyId1)
	case user2.Id:
		assert.Equal(t, user1.Id, historyId1)
	default:
		require.Fail(t, "Unexpected user id in ChannelMemberHistory table", historyId0)
	}
}

func TestAddUserToChannelCreatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t).InitBasic().DeleteBots()
	defer th.TearDown()

	// create a user and add it to a channel
	user := th.CreateUser()
	_, err := th.App.AddTeamMember(th.Context, th.BasicTeam.Id, user.Id)
	require.Nil(t, err, "Failed to add user to team.")

	groupUserIds := make([]string, 0)
	groupUserIds = append(groupUserIds, th.BasicUser.Id)
	groupUserIds = append(groupUserIds, user.Id)

	channel := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen)

	_, err = th.App.AddUserToChannel(th.Context, user, channel, false)
	require.Nil(t, err, "Failed to add user to channel.")

	// there should be a ChannelMemberHistory record for the user
	histories, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.NoError(t, nErr)
	assert.Len(t, histories, 2)
	channelMemberHistoryUserIds := make([]string, 0)
	for _, history := range histories {
		assert.Equal(t, channel.Id, history.ChannelId)
		channelMemberHistoryUserIds = append(channelMemberHistoryUserIds, history.UserId)
	}
	assert.Equal(t, groupUserIds, channelMemberHistoryUserIds)
}

func TestLeaveDefaultChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	guest := th.CreateGuest()
	th.LinkUserToTeam(guest, th.BasicTeam)

	townSquare, err := th.App.GetChannelByName(th.Context, "town-square", th.BasicTeam.Id, false)
	require.Nil(t, err)
	th.AddUserToChannel(guest, townSquare)
	th.AddUserToChannel(th.BasicUser, townSquare)

	t.Run("User tries to leave the default channel", func(t *testing.T) {
		err = th.App.LeaveChannel(th.Context, townSquare.Id, th.BasicUser.Id)
		assert.NotNil(t, err, "It should fail to remove a regular user from the default channel")
		assert.Equal(t, err.Id, "api.channel.remove.default.app_error")
		_, err = th.App.GetChannelMember(th.Context, townSquare.Id, th.BasicUser.Id)
		assert.Nil(t, err)
	})

	t.Run("Guest leaves the default channel", func(t *testing.T) {
		err = th.App.LeaveChannel(th.Context, townSquare.Id, guest.Id)
		assert.Nil(t, err, "It should allow to remove a guest user from the default channel")
		_, err = th.App.GetChannelMember(th.Context, townSquare.Id, guest.Id)
		assert.NotNil(t, err)
	})

	t.Run("Trying to leave the default channel should not delete thread memberships", func(t *testing.T) {
		post := &model.Post{
			ChannelId: townSquare.Id,
			Message:   "root post",
			UserId:    th.BasicUser.Id,
		}
		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, false, true)
		require.Nil(t, err)

		reply := &model.Post{
			ChannelId: townSquare.Id,
			Message:   "reply post",
			UserId:    th.BasicUser.Id,
			RootId:    rpost.Id,
		}
		_, err = th.App.CreatePost(th.Context, reply, th.BasicChannel, false, true)
		require.Nil(t, err)

		threads, err := th.App.GetThreadsForUser(th.BasicUser.Id, townSquare.TeamId, model.GetUserThreadsOpts{})
		require.Nil(t, err)
		require.Len(t, threads.Threads, 1)

		err = th.App.LeaveChannel(th.Context, townSquare.Id, th.BasicUser.Id)
		assert.NotNil(t, err, "It should fail to remove a regular user from the default channel")
		assert.Equal(t, err.Id, "api.channel.remove.default.app_error")

		threads, err = th.App.GetThreadsForUser(th.BasicUser.Id, townSquare.TeamId, model.GetUserThreadsOpts{})
		require.Nil(t, err)
		require.Len(t, threads.Threads, 1)
	})
}

func TestLeaveChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	createThread := func(channel *model.Channel) (rpost *model.Post) {
		t.Helper()
		post := &model.Post{
			ChannelId: channel.Id,
			Message:   "root post",
			UserId:    th.BasicUser.Id,
		}

		rpost, err := th.App.CreatePost(th.Context, post, th.BasicChannel, false, true)
		require.Nil(t, err)

		reply := &model.Post{
			ChannelId: channel.Id,
			Message:   "reply post",
			UserId:    th.BasicUser.Id,
			RootId:    rpost.Id,
		}
		_, err = th.App.CreatePost(th.Context, reply, th.BasicChannel, false, true)
		require.Nil(t, err)

		return rpost
	}

	t.Run("thread memberships are deleted", func(t *testing.T) {
		createThread(th.BasicChannel)
		channel2 := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen)
		createThread(channel2)

		threads, err := th.App.GetThreadsForUser(th.BasicUser.Id, th.BasicChannel.TeamId, model.GetUserThreadsOpts{})
		require.Nil(t, err)
		require.Len(t, threads.Threads, 2)

		err = th.App.LeaveChannel(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		_, err = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.NotNil(t, err, "It should remove channel membership")

		threads, err = th.App.GetThreadsForUser(th.BasicUser.Id, th.BasicChannel.TeamId, model.GetUserThreadsOpts{})
		require.Nil(t, err)
		require.Len(t, threads.Threads, 1)
	})
}

func TestLeaveLastChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	guest := th.CreateGuest()
	th.LinkUserToTeam(guest, th.BasicTeam)

	townSquare, err := th.App.GetChannelByName(th.Context, "town-square", th.BasicTeam.Id, false)
	require.Nil(t, err)
	th.AddUserToChannel(guest, townSquare)
	th.AddUserToChannel(guest, th.BasicChannel)

	t.Run("Guest leaves not last channel", func(t *testing.T) {
		err = th.App.LeaveChannel(th.Context, townSquare.Id, guest.Id)
		require.Nil(t, err)
		_, err = th.App.GetTeamMember(th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err, "It should maintain the team membership")
	})

	t.Run("Guest leaves last channel", func(t *testing.T) {
		err = th.App.LeaveChannel(th.Context, th.BasicChannel.Id, guest.Id)
		assert.Nil(t, err, "It should allow to remove a guest user from the default channel")
		_, err = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, guest.Id)
		assert.NotNil(t, err)
		_, err = th.App.GetTeamMember(th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err, "It should remove the team membership")
	})
}

func TestAddChannelMemberNoUserRequestor(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create a user and add it to a channel
	user := th.CreateUser()
	_, err := th.App.AddTeamMember(th.Context, th.BasicTeam.Id, user.Id)
	require.Nil(t, err)

	groupUserIds := make([]string, 0)
	groupUserIds = append(groupUserIds, th.BasicUser.Id)
	groupUserIds = append(groupUserIds, user.Id)

	channel := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen)

	_, err = th.App.AddChannelMember(th.Context, user.Id, channel, ChannelMemberOpts{})
	require.Nil(t, err, "Failed to add user to channel.")

	// there should be a ChannelMemberHistory record for the user
	histories, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.NoError(t, nErr)
	assert.Len(t, histories, 2)
	channelMemberHistoryUserIds := make([]string, 0)
	for _, history := range histories {
		assert.Equal(t, channel.Id, history.ChannelId)
		channelMemberHistoryUserIds = append(channelMemberHistoryUserIds, history.UserId)
	}
	assert.Equal(t, groupUserIds, channelMemberHistoryUserIds)

	postList, nErr := th.App.Srv().Store().Post().GetPosts(model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 1}, false, map[string]bool{})
	require.NoError(t, nErr)

	if assert.Len(t, postList.Order, 1) {
		post := postList.Posts[postList.Order[0]]

		assert.Equal(t, model.PostTypeJoinChannel, post.Type)
		assert.Equal(t, user.Id, post.UserId)
		assert.Equal(t, user.Username, post.GetProp("username"))
	}
}

func TestAppUpdateChannelScheme(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	mockID := model.NewString("x")
	channel.SchemeId = mockID

	updatedChannel, err := th.App.UpdateChannelScheme(th.Context, channel)
	require.Nil(t, err)

	if updatedChannel.SchemeId != mockID {
		require.Fail(t, "Wrong Channel SchemeId")
	}
}

func TestSetChannelsMuted(t *testing.T) {
	t.Run("should mute and unmute the given channels", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		channel1 := th.BasicChannel

		channel2 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel2)

		// Ensure that both channels start unmuted
		member1, err := th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.False(t, member1.IsChannelMuted())

		member2, err := th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.False(t, member2.IsChannelMuted())

		// Mute both channels
		updated, err := th.App.setChannelsMuted(th.Context, []string{channel1.Id, channel2.Id}, th.BasicUser.Id, true)
		require.Nil(t, err)
		assert.True(t, updated[0].IsChannelMuted())
		assert.True(t, updated[1].IsChannelMuted())

		// Verify that the channels are muted in the database
		member1, err = th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.True(t, member1.IsChannelMuted())

		member2, err = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.True(t, member2.IsChannelMuted())

		// Unm both channels
		updated, err = th.App.setChannelsMuted(th.Context, []string{channel1.Id, channel2.Id}, th.BasicUser.Id, false)
		require.Nil(t, err)
		assert.False(t, updated[0].IsChannelMuted())
		assert.False(t, updated[1].IsChannelMuted())

		// Verify that the channels are muted in the database
		member1, err = th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.False(t, member1.IsChannelMuted())

		member2, err = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.False(t, member2.IsChannelMuted())
	})
}

func TestFillInChannelProps(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channelPublic1, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "Public 1", Name: "public1", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(th.Context, channelPublic1)

	channelPublic2, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "Public 2", Name: "public2", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(th.Context, channelPublic2)

	channelPrivate, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "Private", Name: "private", Type: model.ChannelTypePrivate, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(th.Context, channelPrivate)

	otherTeamId := model.NewId()
	otherTeam := &model.Team{
		DisplayName: "dn_" + otherTeamId,
		Name:        "name" + otherTeamId,
		Email:       "success+" + otherTeamId + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}
	otherTeam, err = th.App.CreateTeam(th.Context, otherTeam)
	require.Nil(t, err)
	defer th.App.PermanentDeleteTeam(th.Context, otherTeam)

	channelOtherTeam, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "Other Team Channel", Name: "other-team", Type: model.ChannelTypeOpen, TeamId: otherTeam.Id}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(th.Context, channelOtherTeam)

	// Note that purpose is intentionally plaintext below.

	t.Run("single channels", func(t *testing.T) {
		testCases := []struct {
			Description          string
			Channel              *model.Channel
			ExpectedChannelProps map[string]any
		}{
			{
				"channel on basic team without references",
				&model.Channel{
					TeamId:  th.BasicTeam.Id,
					Header:  "No references",
					Purpose: "No references",
				},
				nil,
			},
			{
				"channel on basic team",
				&model.Channel{
					TeamId:  th.BasicTeam.Id,
					Header:  "~public1, ~private, ~other-team",
					Purpose: "~public2, ~private, ~other-team",
				},
				map[string]any{
					"channel_mentions": map[string]any{
						"public1": map[string]any{
							"display_name": "Public 1",
						},
					},
				},
			},
			{
				"channel on other team",
				&model.Channel{
					TeamId:  otherTeam.Id,
					Header:  "~public1, ~private, ~other-team",
					Purpose: "~public2, ~private, ~other-team",
				},
				map[string]any{
					"channel_mentions": map[string]any{
						"other-team": map[string]any{
							"display_name": "Other Team Channel",
						},
					},
				},
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				err = th.App.FillInChannelProps(th.Context, testCase.Channel)
				require.Nil(t, err)

				assert.Equal(t, testCase.ExpectedChannelProps, testCase.Channel.Props)
			})
		}
	})

	t.Run("multiple channels", func(t *testing.T) {
		testCases := []struct {
			Description          string
			Channels             model.ChannelList
			ExpectedChannelProps map[string]any
		}{
			{
				"single channel on basic team",
				model.ChannelList{
					{
						Name:    "test",
						TeamId:  th.BasicTeam.Id,
						Header:  "~public1, ~private, ~other-team",
						Purpose: "~public2, ~private, ~other-team",
					},
				},
				map[string]any{
					"test": map[string]any{
						"channel_mentions": map[string]any{
							"public1": map[string]any{
								"display_name": "Public 1",
							},
						},
					},
				},
			},
			{
				"multiple channels on basic team",
				model.ChannelList{
					{
						Name:    "test",
						TeamId:  th.BasicTeam.Id,
						Header:  "~public1, ~private, ~other-team",
						Purpose: "~public2, ~private, ~other-team",
					},
					{
						Name:    "test2",
						TeamId:  th.BasicTeam.Id,
						Header:  "~private, ~other-team",
						Purpose: "~public2, ~private, ~other-team",
					},
					{
						Name:    "test3",
						TeamId:  th.BasicTeam.Id,
						Header:  "No references",
						Purpose: "No references",
					},
				},
				map[string]any{
					"test": map[string]any{
						"channel_mentions": map[string]any{
							"public1": map[string]any{
								"display_name": "Public 1",
							},
						},
					},
					"test2": map[string]any(nil),
					"test3": map[string]any(nil),
				},
			},
			{
				"multiple channels across teams",
				model.ChannelList{
					{
						Name:    "test",
						TeamId:  th.BasicTeam.Id,
						Header:  "~public1, ~private, ~other-team",
						Purpose: "~public2, ~private, ~other-team",
					},
					{
						Name:    "test2",
						TeamId:  otherTeam.Id,
						Header:  "~private, ~other-team",
						Purpose: "~public2, ~private, ~other-team",
					},
					{
						Name:    "test3",
						TeamId:  th.BasicTeam.Id,
						Header:  "No references",
						Purpose: "No references",
					},
				},
				map[string]any{
					"test": map[string]any{
						"channel_mentions": map[string]any{
							"public1": map[string]any{
								"display_name": "Public 1",
							},
						},
					},
					"test2": map[string]any{
						"channel_mentions": map[string]any{
							"other-team": map[string]any{
								"display_name": "Other Team Channel",
							},
						},
					},
					"test3": map[string]any(nil),
				},
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				err = th.App.FillInChannelsProps(th.Context, testCase.Channels)
				require.Nil(t, err)

				for _, channel := range testCase.Channels {
					assert.Equal(t, testCase.ExpectedChannelProps[channel.Name], channel.Props)
				}
			})
		}
	})
}

func TestRenameChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testCases := []struct {
		Name                string
		Channel             *model.Channel
		ExpectError         bool
		ChannelName         string
		ExpectedName        string
		ExpectedDisplayName string
	}{
		{
			"Rename open channel",
			th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen),
			false,
			"newchannelname",
			"newchannelname",
			"New Display Name",
		},
		{
			"Fail on rename open channel with bad name",
			th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen),
			true,
			"6zii9a9g6pruzj451x3esok54h__wr4j4g8zqtnhmkw771pfpynqwo",
			"",
			"",
		},
		{
			"Success on rename open channel with consecutive underscores in name",
			th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen),
			false,
			"foo__bar",
			"foo__bar",
			"New Display Name",
		},
		{
			"Fail on rename direct message channel",
			th.CreateDmChannel(th.BasicUser2),
			true,
			"newchannelname",
			"",
			"",
		},
		{
			"Fail on rename group message channel",
			th.CreateGroupChannel(th.Context, th.BasicUser2, th.CreateUser()),
			true,
			"newchannelname",
			"",
			"",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			channel, err := th.App.RenameChannel(th.Context, tc.Channel, tc.ChannelName, "New Display Name")
			if tc.ExpectError {
				assert.NotNil(t, err)
			} else {
				assert.Equal(t, tc.ExpectedName, channel.Name)
				assert.Equal(t, tc.ExpectedDisplayName, channel.DisplayName)
			}
		})
	}
}

func TestGetChannelMembersTimezones(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, err := th.App.AddChannelMember(th.Context, th.BasicUser2.Id, th.BasicChannel, ChannelMemberOpts{})
	require.Nil(t, err, "Failed to add user to channel.")

	user := th.BasicUser
	user.Timezone["useAutomaticTimezone"] = "false"
	user.Timezone["manualTimezone"] = "XOXO/BLABLA"
	th.App.UpdateUser(th.Context, user, false)

	user2 := th.BasicUser2
	user2.Timezone["automaticTimezone"] = "NoWhere/Island"
	th.App.UpdateUser(th.Context, user2, false)

	user3 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(th.Context, &user3)
	th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)

	ruser.Timezone["automaticTimezone"] = "NoWhere/Island"
	th.App.UpdateUser(th.Context, ruser, false)

	user4 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ = th.App.CreateUser(th.Context, &user4)
	th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)

	timezones, err := th.App.GetChannelMembersTimezones(th.Context, th.BasicChannel.Id)
	require.Nil(t, err, "Failed to get the timezones for a channel.")

	assert.Equal(t, 2, len(timezones))
}

func TestGetChannelsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	channel := &model.Channel{
		DisplayName: "Public",
		Name:        "public",
		Type:        model.ChannelTypeOpen,
		CreatorId:   th.BasicUser.Id,
		TeamId:      th.BasicTeam.Id,
	}
	th.App.CreateChannel(th.Context, channel, true)
	defer th.App.PermanentDeleteChannel(th.Context, channel)
	defer th.TearDown()

	channelList, err := th.App.GetChannelsForTeamForUser(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.ChannelSearchOpts{
		IncludeDeleted: false,
		LastDeleteAt:   0,
	})
	require.Nil(t, err)
	require.Len(t, channelList, 4)

	th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)

	// Now we get all the non-archived channels for the user
	channelList, err = th.App.GetChannelsForTeamForUser(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.ChannelSearchOpts{
		IncludeDeleted: false,
		LastDeleteAt:   0,
	})
	require.Nil(t, err)
	require.Len(t, channelList, 3)

	// Now we get all the channels, even though are archived, for the user
	channelList, err = th.App.GetChannelsForTeamForUser(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.ChannelSearchOpts{
		IncludeDeleted: true,
		LastDeleteAt:   0,
	})
	require.Nil(t, err)
	require.Len(t, channelList, 4)
}

func TestGetPublicChannelsForTeam(t *testing.T) {
	th := Setup(t)
	team := th.CreateTeam()
	defer th.TearDown()

	var expectedChannels []*model.Channel

	townSquare, err := th.App.GetChannelByName(th.Context, "town-square", team.Id, false)
	require.Nil(t, err)
	require.NotNil(t, townSquare)
	expectedChannels = append(expectedChannels, townSquare)

	offTopic, err := th.App.GetChannelByName(th.Context, "off-topic", team.Id, false)
	require.Nil(t, err)
	require.NotNil(t, offTopic)
	expectedChannels = append(expectedChannels, offTopic)

	for i := 0; i < 8; i++ {
		channel := model.Channel{
			DisplayName: fmt.Sprintf("Public %v", i),
			Name:        fmt.Sprintf("public_%v", i),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		var rchannel *model.Channel
		rchannel, err = th.App.CreateChannel(th.Context, &channel, false)
		require.Nil(t, err)
		require.NotNil(t, rchannel)
		defer th.App.PermanentDeleteChannel(th.Context, rchannel)

		// Store the user ids for comparison later
		expectedChannels = append(expectedChannels, rchannel)
	}

	// Fetch public channels multiple times
	channelList, err := th.App.GetPublicChannelsForTeam(th.Context, team.Id, 0, 5)
	require.Nil(t, err)
	channelList2, err := th.App.GetPublicChannelsForTeam(th.Context, team.Id, 5, 5)
	require.Nil(t, err)

	channels := append(channelList, channelList2...)
	assert.ElementsMatch(t, expectedChannels, channels)
}

func TestGetPrivateChannelsForTeam(t *testing.T) {
	th := Setup(t)
	team := th.CreateTeam()
	defer th.TearDown()

	var expectedChannels []*model.Channel
	for i := 0; i < 8; i++ {
		channel := model.Channel{
			DisplayName: fmt.Sprintf("Private %v", i),
			Name:        fmt.Sprintf("private_%v", i),
			Type:        model.ChannelTypePrivate,
			TeamId:      team.Id,
		}
		var rchannel *model.Channel
		rchannel, err := th.App.CreateChannel(th.Context, &channel, false)
		require.Nil(t, err)
		require.NotNil(t, rchannel)
		defer th.App.PermanentDeleteChannel(th.Context, rchannel)

		// Store the user ids for comparison later
		expectedChannels = append(expectedChannels, rchannel)
	}

	// Fetch private channels multiple times
	channelList, err := th.App.GetPrivateChannelsForTeam(th.Context, team.Id, 0, 5)
	require.Nil(t, err)
	channelList2, err := th.App.GetPrivateChannelsForTeam(th.Context, team.Id, 5, 5)
	require.Nil(t, err)

	channels := append(channelList, channelList2...)
	assert.ElementsMatch(t, expectedChannels, channels)
}

func TestUpdateChannelMemberRolesChangingGuest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("from guest to user", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_user")
		require.NotNil(t, err, "Should fail when try to modify the guest role")
	})

	t.Run("from user to guest", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_guest")
		require.NotNil(t, err, "Should fail when try to modify the guest role")
	})

	t.Run("from user to admin", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_user channel_admin")
		require.Nil(t, err, "Should work when you not modify guest role")
	})

	t.Run("from guest to guest plus custom", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, err)

		_, err = th.App.CreateRole(&model.Role{Name: "custom", DisplayName: "custom", Description: "custom"})
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_guest custom")
		require.Nil(t, err, "Should work when you not modify guest role")
	})

	t.Run("a guest cant have user role", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_guest channel_user")
		require.NotNil(t, err, "Should work when you not modify guest role")
	})
}

func TestDefaultChannelNames(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	actual := th.App.DefaultChannelNames(th.Context)
	expect := []string{"town-square", "off-topic"}
	require.ElementsMatch(t, expect, actual)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.TeamSettings.ExperimentalDefaultChannels = []string{"foo", "bar"}
	})

	actual = th.App.DefaultChannelNames(th.Context)
	expect = []string{"town-square", "foo", "bar"}
	require.ElementsMatch(t, expect, actual)
}

func TestSearchChannelsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	c1, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "test-dev-1", Name: "test-dev-1", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)

	c2, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "test-dev-2", Name: "test-dev-2", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)

	c3, err := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "dev-3", Name: "dev-3", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)

	defer func() {
		th.App.PermanentDeleteChannel(th.Context, c1)
		th.App.PermanentDeleteChannel(th.Context, c2)
		th.App.PermanentDeleteChannel(th.Context, c3)
	}()

	// add user to test-dev-1 and dev3
	_, err = th.App.AddUserToChannel(th.Context, th.BasicUser, c1, false)
	require.Nil(t, err)
	_, err = th.App.AddUserToChannel(th.Context, th.BasicUser, c3, false)
	require.Nil(t, err)

	searchAndCheck := func(t *testing.T, term string, expectedDisplayNames []string) {
		res, searchErr := th.App.SearchChannelsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id, term)
		require.Nil(t, searchErr)
		require.Len(t, res, len(expectedDisplayNames))

		resultDisplayNames := []string{}
		for _, c := range res {
			resultDisplayNames = append(resultDisplayNames, c.Name)
		}
		require.ElementsMatch(t, expectedDisplayNames, resultDisplayNames)
	}

	t.Run("Search for test, only test-dev-1 should be returned", func(t *testing.T) {
		searchAndCheck(t, "test", []string{"test-dev-1"})
	})

	t.Run("Search for dev, both test-dev-1 and dev-3 should be returned", func(t *testing.T) {
		searchAndCheck(t, "dev", []string{"test-dev-1", "dev-3"})
	})

	t.Run("After adding user to test-dev-2, search for dev, the three channels should be returned", func(t *testing.T) {
		_, err = th.App.AddUserToChannel(th.Context, th.BasicUser, c2, false)
		require.Nil(t, err)

		searchAndCheck(t, "dev", []string{"test-dev-1", "test-dev-2", "dev-3"})
	})
}

func TestMarkChannelAsUnreadFromPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	u1 := th.BasicUser
	u2 := th.BasicUser2
	c1 := th.BasicChannel
	pc1 := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(u2, c1)
	th.AddUserToChannel(u1, pc1)
	th.AddUserToChannel(u2, pc1)

	p1 := th.CreatePost(c1)
	p2 := th.CreatePost(c1)
	p3 := th.CreatePost(c1)

	pp1 := th.CreatePost(pc1)
	require.NotNil(t, pp1)
	pp2 := th.CreatePost(pc1)

	unread, err := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
	require.Nil(t, err)
	require.Equal(t, int64(4), unread.MsgCount)
	unread, err = th.App.GetChannelUnread(th.Context, c1.Id, u2.Id)
	require.Nil(t, err)
	require.Equal(t, int64(4), unread.MsgCount)
	_, err = th.App.MarkChannelsAsViewed(th.Context, []string{c1.Id, pc1.Id}, u1.Id, "", false, false)
	require.Nil(t, err)
	_, err = th.App.MarkChannelsAsViewed(th.Context, []string{c1.Id, pc1.Id}, u2.Id, "", false, false)
	require.Nil(t, err)
	unread, err = th.App.GetChannelUnread(th.Context, c1.Id, u2.Id)
	require.Nil(t, err)
	require.Equal(t, int64(0), unread.MsgCount)

	t.Run("Unread but last one", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(th.Context, p2.Id, u1.Id, true)
		require.Nil(t, err)
		require.NotNil(t, response)
		assert.Equal(t, int64(2), response.MsgCount)
		unread, err := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(2), unread.MsgCount)
		assert.Equal(t, p2.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread last one", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(th.Context, p3.Id, u1.Id, true)
		require.Nil(t, err)
		require.NotNil(t, response)
		assert.Equal(t, int64(3), response.MsgCount)
		unread, err := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(1), unread.MsgCount)
		assert.Equal(t, p3.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread first one", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(th.Context, p1.Id, u1.Id, true)
		require.Nil(t, err)
		require.NotNil(t, response)
		assert.Equal(t, int64(1), response.MsgCount)
		unread, err := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(3), unread.MsgCount)
		assert.Equal(t, p1.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Other users are unaffected", func(t *testing.T) {
		unread, err := th.App.GetChannelUnread(th.Context, c1.Id, u2.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(0), unread.MsgCount)
	})

	t.Run("Unread on a private channel", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(th.Context, pp1.Id, u1.Id, true)
		require.Nil(t, err)
		require.NotNil(t, response)
		assert.Equal(t, int64(0), response.MsgCount)
		unread, err := th.App.GetChannelUnread(th.Context, pc1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(2), unread.MsgCount)
		assert.Equal(t, pp1.CreateAt-1, response.LastViewedAt)

		response, err = th.App.MarkChannelAsUnreadFromPost(th.Context, pp2.Id, u1.Id, true)
		assert.Nil(t, err)
		assert.Equal(t, int64(1), response.MsgCount)
		unread, err = th.App.GetChannelUnread(th.Context, pc1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(1), unread.MsgCount)
		assert.Equal(t, pp2.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread with mentions", func(t *testing.T) {
		c2 := th.CreateChannel(th.Context, th.BasicTeam)
		_, err := th.App.AddUserToChannel(th.Context, u2, c2, false)
		require.Nil(t, err)

		p4, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    u2.Id,
			ChannelId: c2.Id,
			Message:   "@" + u1.Username,
		}, c2, false, true)
		require.Nil(t, err)
		th.CreatePost(c2)

		th.App.CreatePost(th.Context, &model.Post{
			UserId:    u2.Id,
			ChannelId: c2.Id,
			RootId:    p4.Id,
			Message:   "@" + u1.Username,
		}, c2, false, true)

		response, err := th.App.MarkChannelAsUnreadFromPost(th.Context, p4.Id, u1.Id, true)
		assert.Nil(t, err)
		assert.Equal(t, int64(1), response.MsgCount)
		assert.Equal(t, int64(2), response.MentionCount)
		assert.Equal(t, int64(1), response.MentionCountRoot)

		unread, err := th.App.GetChannelUnread(th.Context, c2.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(2), unread.MsgCount)
		assert.Equal(t, int64(2), unread.MentionCount)
		assert.Equal(t, int64(1), unread.MentionCountRoot)
	})

	t.Run("Unread on a DM channel", func(t *testing.T) {
		dc := th.CreateDmChannel(u2)

		dm1 := th.CreatePost(dc)
		th.CreatePost(dc)
		th.CreatePost(dc)

		_, err := th.App.CreatePost(th.Context, &model.Post{ChannelId: dc.Id, UserId: th.BasicUser.Id, Message: "testReply", RootId: dm1.Id}, dc, false, false)
		assert.Nil(t, err)

		response, err := th.App.MarkChannelAsUnreadFromPost(th.Context, dm1.Id, u2.Id, true)
		assert.Nil(t, err)
		assert.Equal(t, int64(0), response.MsgCount)
		assert.Equal(t, int64(4), response.MentionCount)
		assert.Equal(t, int64(3), response.MentionCountRoot)

		unread, err := th.App.GetChannelUnread(th.Context, dc.Id, u2.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(4), unread.MsgCount)
		assert.Equal(t, int64(4), unread.MentionCount)
		assert.Equal(t, int64(3), unread.MentionCountRoot)
	})

	t.Run("Can't unread an imaginary post", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(th.Context, "invalid4ofngungryquinj976y", u1.Id, true)
		assert.NotNil(t, err)
		assert.Nil(t, response)
	})
}

func TestAddUserToChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser1, _ := th.App.CreateUser(th.Context, &user1)
	defer th.App.PermanentDeleteUser(th.Context, &user1)
	bot := th.CreateBot()
	botUser, _ := th.App.GetUser(bot.UserId)
	defer th.App.PermanentDeleteBot(botUser.Id)

	th.App.AddTeamMember(th.Context, th.BasicTeam.Id, ruser1.Id)
	th.App.AddTeamMember(th.Context, th.BasicTeam.Id, bot.UserId)

	group := th.CreateGroup()

	_, err := th.App.UpsertGroupMember(group.Id, user1.Id)
	require.Nil(t, err)

	gs, err := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  th.BasicChannel.Id,
		Type:        model.GroupSyncableTypeChannel,
		GroupId:     group.Id,
		SchemeAdmin: false,
	})
	require.Nil(t, err)

	err = th.App.JoinChannel(th.Context, th.BasicChannel, ruser1.Id)
	require.Nil(t, err)

	// verify user was added as a non-admin
	cm1, err := th.App.GetChannelMember(th.Context, th.BasicChannel.Id, ruser1.Id)
	require.Nil(t, err)
	require.False(t, cm1.SchemeAdmin)

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser2, _ := th.App.CreateUser(th.Context, &user2)
	defer th.App.PermanentDeleteUser(th.Context, &user2)
	th.App.AddTeamMember(th.Context, th.BasicTeam.Id, ruser2.Id)

	_, err = th.App.UpsertGroupMember(group.Id, user2.Id)
	require.Nil(t, err)

	gs.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(gs)
	require.Nil(t, err)

	err = th.App.JoinChannel(th.Context, th.BasicChannel, ruser2.Id)
	require.Nil(t, err)

	// Should allow a bot to be added to a public group synced channel
	_, err = th.App.AddUserToChannel(th.Context, botUser, th.BasicChannel, false)
	require.Nil(t, err)

	// verify user was added as an admin
	cm2, err := th.App.GetChannelMember(th.Context, th.BasicChannel.Id, ruser2.Id)
	require.Nil(t, err)
	require.True(t, cm2.SchemeAdmin)

	privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	privateChannel.GroupConstrained = model.NewBool(true)
	_, err = th.App.UpdateChannel(th.Context, privateChannel)
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group.Id,
		SyncableId: privateChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.Nil(t, err)

	// Should allow a group synced user to be added to a group synced private channel
	_, err = th.App.AddUserToChannel(th.Context, ruser1, privateChannel, false)
	require.Nil(t, err)

	// Should allow a bot to be added to a private group synced channel
	_, err = th.App.AddUserToChannel(th.Context, botUser, privateChannel, false)
	require.Nil(t, err)
}

func TestRemoveUserFromChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(th.Context, &user)
	defer th.App.PermanentDeleteUser(th.Context, ruser)

	bot := th.CreateBot()
	botUser, _ := th.App.GetUser(bot.UserId)
	defer th.App.PermanentDeleteBot(botUser.Id)

	th.App.AddTeamMember(th.Context, th.BasicTeam.Id, ruser.Id)
	th.App.AddTeamMember(th.Context, th.BasicTeam.Id, bot.UserId)

	privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

	_, err := th.App.AddUserToChannel(th.Context, ruser, privateChannel, false)
	require.Nil(t, err)
	_, err = th.App.AddUserToChannel(th.Context, botUser, privateChannel, false)
	require.Nil(t, err)

	group := th.CreateGroup()
	_, err = th.App.UpsertGroupMember(group.Id, ruser.Id)
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group.Id,
		SyncableId: privateChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.Nil(t, err)

	privateChannel.GroupConstrained = model.NewBool(true)
	_, err = th.App.UpdateChannel(th.Context, privateChannel)
	require.Nil(t, err)

	// Should not allow a group synced user to be removed from channel
	err = th.App.RemoveUserFromChannel(th.Context, ruser.Id, th.SystemAdminUser.Id, privateChannel)
	assert.Equal(t, err.Id, "api.channel.remove_members.denied")

	// Should allow a user to remove themselves from group synced channel
	err = th.App.RemoveUserFromChannel(th.Context, ruser.Id, ruser.Id, privateChannel)
	require.Nil(t, err)

	// Should allow a bot to be removed from a group synced channel
	err = th.App.RemoveUserFromChannel(th.Context, botUser.Id, th.SystemAdminUser.Id, privateChannel)
	require.Nil(t, err)
}

func TestPatchChannelModerationsForChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.SetPhase2PermissionsMigrationStatus(true)
	channel := th.BasicChannel

	user := th.BasicUser
	th.AddUserToChannel(user, channel)

	createPosts := model.ChannelModeratedPermissions[0]
	createReactions := model.ChannelModeratedPermissions[1]
	manageMembers := model.ChannelModeratedPermissions[2]
	channelMentions := model.ChannelModeratedPermissions[3]

	nonChannelModeratedPermission := model.PermissionCreateBot.Id

	testCases := []struct {
		Name                          string
		ChannelModerationsPatch       []*model.ChannelModerationPatch
		PermissionsModeratedByPatch   map[string]*model.ChannelModeratedRoles
		RevertChannelModerationsPatch []*model.ChannelModerationPatch
		HigherScopedMemberPermissions []string
		HigherScopedGuestPermissions  []string
		ShouldError                   bool
		ShouldHaveNoChannelScheme     bool
	}{
		{
			Name: "Removing create posts from members role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewBool(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				createPosts: {
					Members: &model.ChannelModeratedRole{Value: false, Enabled: true},
				},
			},
			RevertChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewBool(true)},
				},
			},
		},
		{
			Name: "Removing create reactions from members role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewBool(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				createReactions: {
					Members: &model.ChannelModeratedRole{Value: false, Enabled: true},
				},
			},
			RevertChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewBool(true)},
				},
			},
		},
		{
			Name: "Removing channel mentions from members role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &channelMentions,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewBool(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				channelMentions: {
					Members: &model.ChannelModeratedRole{Value: false, Enabled: true},
				},
			},
			RevertChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &channelMentions,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewBool(true)},
				},
			},
		},
		{
			Name: "Removing manage members from members role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &manageMembers,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewBool(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				manageMembers: {
					Members: &model.ChannelModeratedRole{Value: false, Enabled: true},
				},
			},
			RevertChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &manageMembers,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewBool(true)},
				},
			},
		},
		{
			Name: "Removing create posts from guests role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewBool(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				createPosts: {
					Guests: &model.ChannelModeratedRole{Value: false, Enabled: true},
				},
			},
			RevertChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewBool(true)},
				},
			},
		},
		{
			Name: "Removing create reactions from guests role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewBool(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				createReactions: {
					Guests: &model.ChannelModeratedRole{Value: false, Enabled: true},
				},
			},
			RevertChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewBool(true)},
				},
			},
		},
		{
			Name: "Removing channel mentions from guests role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &channelMentions,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewBool(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				channelMentions: {
					Guests: &model.ChannelModeratedRole{Value: false, Enabled: true},
				},
			},
			RevertChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &channelMentions,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewBool(true)},
				},
			},
		},
		{
			Name: "Removing manage members from guests role should not error",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &manageMembers,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewBool(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{},
			ShouldError:                 false,
			ShouldHaveNoChannelScheme:   true,
		},
		{
			Name: "Removing a permission that is not channel moderated should not error",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name: &nonChannelModeratedPermission,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewBool(false),
						Guests:  model.NewBool(false),
					},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{},
			ShouldError:                 false,
			ShouldHaveNoChannelScheme:   true,
		},
		{
			Name: "Error when adding a permission that is disabled in the parent member role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name: &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewBool(true),
						Guests:  model.NewBool(false),
					},
				},
			},
			PermissionsModeratedByPatch:   map[string]*model.ChannelModeratedRoles{},
			HigherScopedMemberPermissions: []string{},
			ShouldError:                   true,
		},
		{
			Name: "Error when adding a permission that is disabled in the parent guest role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name: &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewBool(false),
						Guests:  model.NewBool(true),
					},
				},
			},
			PermissionsModeratedByPatch:  map[string]*model.ChannelModeratedRoles{},
			HigherScopedGuestPermissions: []string{},
			ShouldError:                  true,
		},
		{
			Name: "Removing a permission from the member role that is disabled in the parent guest role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name: &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewBool(false),
					},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				createPosts: {
					Members: &model.ChannelModeratedRole{Value: false, Enabled: true},
					Guests:  &model.ChannelModeratedRole{Value: false, Enabled: false},
				},
				createReactions: {
					Guests: &model.ChannelModeratedRole{Value: false, Enabled: false},
				},
				channelMentions: {
					Guests: &model.ChannelModeratedRole{Value: false, Enabled: false},
				},
			},
			HigherScopedGuestPermissions: []string{},
			ShouldError:                  false,
		},
		{
			Name: "Channel should have no scheme when all moderated permissions are equivalent to higher scoped role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name: &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewBool(true),
						Guests:  model.NewBool(true),
					},
				},
				{
					Name: &createReactions,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewBool(true),
						Guests:  model.NewBool(true),
					},
				},
				{
					Name: &channelMentions,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewBool(true),
						Guests:  model.NewBool(true),
					},
				},
				{
					Name: &manageMembers,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewBool(true),
					},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{},
			ShouldHaveNoChannelScheme:   true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			higherScopedPermissionsOverridden := tc.HigherScopedMemberPermissions != nil || tc.HigherScopedGuestPermissions != nil
			// If the test case restricts higher scoped permissions.
			if higherScopedPermissionsOverridden {
				higherScopedGuestRoleName, higherScopedMemberRoleName, _, _ := th.App.GetTeamSchemeChannelRoles(th.Context, channel.TeamId)
				if tc.HigherScopedMemberPermissions != nil {
					higherScopedMemberRole, err := th.App.GetRoleByName(context.Background(), higherScopedMemberRoleName)
					require.Nil(t, err)
					originalPermissions := higherScopedMemberRole.Permissions

					th.App.PatchRole(higherScopedMemberRole, &model.RolePatch{Permissions: &tc.HigherScopedMemberPermissions})
					defer th.App.PatchRole(higherScopedMemberRole, &model.RolePatch{Permissions: &originalPermissions})
				}

				if tc.HigherScopedGuestPermissions != nil {
					higherScopedGuestRole, err := th.App.GetRoleByName(context.Background(), higherScopedGuestRoleName)
					require.Nil(t, err)
					originalPermissions := higherScopedGuestRole.Permissions

					th.App.PatchRole(higherScopedGuestRole, &model.RolePatch{Permissions: &tc.HigherScopedGuestPermissions})
					defer th.App.PatchRole(higherScopedGuestRole, &model.RolePatch{Permissions: &originalPermissions})
				}
			}

			moderations, appErr := th.App.PatchChannelModerationsForChannel(th.Context, channel, tc.ChannelModerationsPatch)
			if tc.ShouldError {
				require.NotNil(t, appErr)
				return
			}
			require.Nil(t, appErr)

			updatedChannel, _ := th.App.GetChannel(th.Context, channel.Id)
			if tc.ShouldHaveNoChannelScheme {
				require.Nil(t, updatedChannel.SchemeId)
			} else {
				require.NotNil(t, updatedChannel.SchemeId)
			}

			for _, moderation := range moderations {
				// If the permission is not found in the expected modified permissions table then require it to be true
				if permission, found := tc.PermissionsModeratedByPatch[moderation.Name]; found && permission.Members != nil {
					require.Equal(t, moderation.Roles.Members.Value, permission.Members.Value)
					require.Equal(t, moderation.Roles.Members.Enabled, permission.Members.Enabled)
				} else {
					require.Equal(t, moderation.Roles.Members.Value, true)
					require.Equal(t, moderation.Roles.Members.Enabled, true)
				}

				if permission, found := tc.PermissionsModeratedByPatch[moderation.Name]; found && permission.Guests != nil {
					require.Equal(t, moderation.Roles.Guests.Value, permission.Guests.Value)
					require.Equal(t, moderation.Roles.Guests.Enabled, permission.Guests.Enabled)
				} else if moderation.Name == manageMembers {
					require.Empty(t, moderation.Roles.Guests)
				} else {
					require.Equal(t, moderation.Roles.Guests.Value, true)
					require.Equal(t, moderation.Roles.Guests.Enabled, true)
				}
			}

			if tc.RevertChannelModerationsPatch != nil {
				th.App.PatchChannelModerationsForChannel(th.Context, channel, tc.RevertChannelModerationsPatch)
			}
		})
	}

	t.Run("Handles concurrent patch requests gracefully", func(t *testing.T) {
		addCreatePosts := []*model.ChannelModerationPatch{
			{
				Name: &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{
					Members: model.NewBool(false),
					Guests:  model.NewBool(false),
				},
			},
		}
		removeCreatePosts := []*model.ChannelModerationPatch{
			{
				Name: &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{
					Members: model.NewBool(false),
					Guests:  model.NewBool(false),
				},
			},
		}

		wg := sync.WaitGroup{}
		wg.Add(20)
		for i := 0; i < 10; i++ {
			go func() {
				th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), addCreatePosts)
				th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), removeCreatePosts)
				wg.Done()
			}()
		}
		for i := 0; i < 10; i++ {
			go func() {
				th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), addCreatePosts)
				th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), removeCreatePosts)
				wg.Done()
			}()
		}
		wg.Wait()

		higherScopedGuestRoleName, higherScopedMemberRoleName, _, _ := th.App.GetTeamSchemeChannelRoles(th.Context, channel.TeamId)
		higherScopedMemberRole, _ := th.App.GetRoleByName(context.Background(), higherScopedMemberRoleName)
		higherScopedGuestRole, _ := th.App.GetRoleByName(context.Background(), higherScopedGuestRoleName)
		assert.Contains(t, higherScopedMemberRole.Permissions, createPosts)
		assert.Contains(t, higherScopedGuestRole.Permissions, createPosts)
	})

	t.Run("Updates the authorization to create post", func(t *testing.T) {
		addCreatePosts := []*model.ChannelModerationPatch{
			{
				Name: &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{
					Members: model.NewBool(true),
				},
			},
		}
		removeCreatePosts := []*model.ChannelModerationPatch{
			{
				Name: &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{
					Members: model.NewBool(false),
				},
			},
		}

		mockSession := model.Session{UserId: user.Id}

		_, err := th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), addCreatePosts)
		require.Nil(t, err)
		require.True(t, th.App.SessionHasPermissionToChannel(th.Context, mockSession, channel.Id, model.PermissionCreatePost))

		_, err = th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), removeCreatePosts)
		require.Nil(t, err)
		require.False(t, th.App.SessionHasPermissionToChannel(th.Context, mockSession, channel.Id, model.PermissionCreatePost))
	})
}

// TestMarkChannelsAsViewedPanic verifies that returning an error from a.GetUser
// does not cause a panic.
func TestMarkChannelsAsViewedPanic(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Get", context.Background(), "userID").Return(nil, model.NewAppError("SqlUserStore.Get", "app.user.get.app_error", nil, "user_id=userID", http.StatusInternalServerError))
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("Get", "channelID", true).Return(&model.Channel{}, nil)
	mockChannelStore.On("GetMember", context.Background(), "channelID", "userID").Return(&model.ChannelMember{
		NotifyProps: model.StringMap{
			model.PushNotifyProp: model.ChannelNotifyDefault,
		}}, nil)
	times := map[string]int64{
		"userID": 1,
	}
	mockChannelStore.On("UpdateLastViewedAt", []string{"channelID"}, "userID").Return(times, nil)
	mockSessionStore := mocks.SessionStore{}
	mockOAuthStore := mocks.OAuthStore{}
	var err error
	th.App.ch.srv.userService, err = users.New(users.ServiceConfig{
		UserStore:    &mockUserStore,
		SessionStore: &mockSessionStore,
		OAuthStore:   &mockOAuthStore,
		ConfigFn:     th.App.ch.srv.platform.Config,
		LicenseFn:    th.App.ch.srv.License,
	})
	require.NoError(t, err)
	mockPreferenceStore := mocks.PreferenceStore{}
	mockPreferenceStore.On("Get", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&model.Preference{Value: "test"}, nil)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("Preference").Return(&mockPreferenceStore)
	mockThreadStore := mocks.ThreadStore{}
	mockThreadStore.On("MarkAllAsReadByChannels", "userID", []string{"channelID"}).Return(nil)
	mockStore.On("Thread").Return(&mockThreadStore)

	_, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{"channelID"}, "userID", th.Context.Session().Id, false, false)
	require.Nil(t, appErr)
}

func TestClearChannelMembersCache(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockChannelStore := mocks.ChannelStore{}
	cms := model.ChannelMembers{}
	for i := 0; i < 200; i++ {
		cms = append(cms, model.ChannelMember{
			ChannelId: "1",
		})
	}
	mockChannelStore.On("GetMembers", "channelID", 0, 100).Return(cms, nil)
	mockChannelStore.On("GetMembers", "channelID", 100, 100).Return(model.ChannelMembers{
		model.ChannelMember{
			ChannelId: "1",
		}}, nil)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	require.NoError(t, th.App.ClearChannelMembersCache(th.Context, "channelID"))
}

func TestGetMemberCountsByGroup(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockChannelStore := mocks.ChannelStore{}
	cmc := []*model.ChannelMemberCountByGroup{}
	for i := 0; i < 5; i++ {
		cmc = append(cmc, &model.ChannelMemberCountByGroup{
			GroupId:                     model.NewId(),
			ChannelMemberCount:          int64(i),
			ChannelMemberTimezonesCount: int64(i),
		})
	}
	mockChannelStore.On("GetMemberCountsByGroup", context.Background(), "channelID", true).Return(cmc, nil)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)
	resp, err := th.App.GetMemberCountsByGroup(context.Background(), "channelID", true)
	require.Nil(t, err)
	require.ElementsMatch(t, cmc, resp)
}

func TestGetChannelsMemberCount(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockChannelStore := mocks.ChannelStore{}
	channelsMemberCount := map[string]int64{
		"channel1": int64(10),
		"channel2": int64(20),
	}
	mockChannelStore.On("GetChannelsMemberCount", []string{"channel1", "channel2"}).Return(channelsMemberCount, nil)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)
	resp, err := th.App.GetChannelsMemberCount(th.Context, []string{"channel1", "channel2"})
	require.Nil(t, err)
	require.Equal(t, channelsMemberCount, resp)
}

func TestViewChannelCollapsedThreadsTurnedOff(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	u1 := th.BasicUser
	u2 := th.BasicUser2
	c1 := th.BasicChannel
	th.AddUserToChannel(u2, c1)

	// Enable CRT

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	// Turn off CRT for user
	preference := model.Preference{
		UserId:   u1.Id,
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameCollapsedThreadsEnabled,
		Value:    "off",
	}
	var preferences model.Preferences
	preferences = append(preferences, preference)
	err := th.App.Srv().Store().Preference().Save(preferences)
	require.NoError(t, err)

	// mention the user in a root post
	post1 := &model.Post{
		ChannelId: c1.Id,
		Message:   "root post @" + u1.Username,
		UserId:    u2.Id,
	}
	rpost1, appErr := th.App.CreatePost(th.Context, post1, c1, false, true)
	require.Nil(t, appErr)

	// mention the user in a reply post
	post2 := &model.Post{
		ChannelId: c1.Id,
		Message:   "reply post @" + u1.Username,
		UserId:    u2.Id,
		RootId:    rpost1.Id,
	}
	_, appErr = th.App.CreatePost(th.Context, post2, c1, false, true)
	require.Nil(t, appErr)

	// Check we have unread mention in the thread
	threads, appErr := th.App.GetThreadsForUser(u1.Id, c1.TeamId, model.GetUserThreadsOpts{})
	require.Nil(t, appErr)
	found := false
	for _, thread := range threads.Threads {
		if thread.PostId == rpost1.Id {
			require.EqualValues(t, int64(1), thread.UnreadMentions)
			found = true
			break
		}
	}
	require.Truef(t, found, "did not find created thread in user's threads")

	// Mark channel as read from a client that supports CRT
	_, appErr = th.App.MarkChannelsAsViewed(th.Context, []string{c1.Id}, u1.Id, th.Context.Session().Id, true, th.App.IsCRTEnabledForUser(th.Context, u1.Id))
	require.Nil(t, appErr)

	// Thread should be marked as read because CRT has been turned off by user
	threads, appErr = th.App.GetThreadsForUser(u1.Id, c1.TeamId, model.GetUserThreadsOpts{})
	require.Nil(t, appErr)
	found = false
	for _, thread := range threads.Threads {
		if thread.PostId == rpost1.Id {
			require.Zero(t, thread.UnreadMentions)
			found = true
			break
		}
	}
	require.Truef(t, found, "did not find created thread in user's threads")
}

func TestMarkChannelAsUnreadFromPostCollapsedThreadsTurnedOff(t *testing.T) {
	// Enable CRT

	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	th.AddUserToChannel(th.BasicUser2, th.BasicChannel)

	// Turn off CRT for user
	preference := model.Preference{
		UserId:   th.BasicUser.Id,
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameCollapsedThreadsEnabled,
		Value:    "off",
	}
	var preferences model.Preferences
	preferences = append(preferences, preference)
	err := th.App.Srv().Store().Preference().Save(preferences)
	require.NoError(t, err)

	// user2: first root mention @user1
	//   - user1: hello
	//   - user2: mention @u1
	//   - user1: another reply
	//   - user2: another mention @u1
	// user1: a root post
	// user2: Another root mention @u1
	user1Mention := " @" + th.BasicUser.Username
	rootPost1, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "first root mention" + user1Mention}, th.BasicChannel, false, false)
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "hello"}, th.BasicChannel, false, false)
	require.Nil(t, appErr)
	replyPost1, appErr := th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "mention" + user1Mention}, th.BasicChannel, false, false)
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another reply"}, th.BasicChannel, false, false)
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another mention" + user1Mention}, th.BasicChannel, false, false)
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "a root post"}, th.BasicChannel, false, false)
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another root mention" + user1Mention}, th.BasicChannel, false, false)
	require.Nil(t, appErr)

	t.Run("Mark reply post as unread", func(t *testing.T) {
		_, err := th.App.MarkChannelAsUnreadFromPost(th.Context, replyPost1.Id, th.BasicUser.Id, true)
		require.Nil(t, err)
		// Get channel unreads
		// Easier to reason with ChannelUnread now, than channelUnreadAt from the previous call
		channelUnread, err := th.App.GetChannelUnread(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		require.Equal(t, int64(3), channelUnread.MentionCount)
		//  MentionCountRoot should be zero for a user that has CRT turned off
		require.Equal(t, int64(0), channelUnread.MentionCountRoot)

		require.Equal(t, int64(5), channelUnread.MsgCount)
		//  MentionCountRoot should be zero for a user that has CRT turned off
		require.Equal(t, channelUnread.MsgCountRoot, int64(0))

		threadMembership, err := th.App.GetThreadMembershipForUser(th.BasicUser.Id, rootPost1.Id)
		require.Nil(t, err)
		thread, err := th.App.GetThreadForUser(threadMembership, false)
		require.Nil(t, err)
		require.Equal(t, int64(2), thread.UnreadMentions)
		require.Equal(t, int64(3), thread.UnreadReplies)
	})

	t.Run("Mark root post as unread", func(t *testing.T) {
		_, err := th.App.MarkChannelAsUnreadFromPost(th.Context, rootPost1.Id, th.BasicUser.Id, true)
		require.Nil(t, err)
		// Get channel unreads
		// Easier to reason with ChannelUnread now, than channelUnreadAt from the previous call
		channelUnread, err := th.App.GetChannelUnread(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		require.Equal(t, int64(4), channelUnread.MentionCount)
		require.Equal(t, int64(2), channelUnread.MentionCountRoot)

		require.Equal(t, int64(7), channelUnread.MsgCount)
		require.Equal(t, int64(3), channelUnread.MsgCountRoot)
	})
}

func TestMarkUnreadCRTOffUpdatesThreads(t *testing.T) {

	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOff
	})

	t.Run("Mentions counted correctly if post is edited", func(t *testing.T) {
		user3 := th.CreateUser()
		defer th.App.PermanentDeleteUser(th.Context, user3)
		rootPost, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "root post"}, th.BasicChannel, false, false)
		require.Nil(t, appErr)
		r1, appErr := th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "reply 1"}, th.BasicChannel, false, false)
		require.Nil(t, appErr)
		_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "reply 2 @" + user3.Username}, th.BasicChannel, false, false)
		require.Nil(t, appErr)
		_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "reply 3"}, th.BasicChannel, false, false)
		require.Nil(t, appErr)
		editedPost := r1.Clone()
		editedPost.Message += " edited"
		_, appErr = th.App.UpdatePost(th.Context, editedPost, false)
		require.Nil(t, appErr)

		th.LinkUserToTeam(user3, th.BasicTeam)
		th.AddUserToChannel(user3, th.BasicChannel)

		_, appErr = th.App.MarkChannelAsUnreadFromPost(th.Context, editedPost.Id, user3.Id, false)
		require.Nil(t, appErr)
		threadMembership, appErr := th.App.GetThreadMembershipForUser(user3.Id, rootPost.Id)
		require.Nil(t, appErr)
		require.NotNil(t, threadMembership)
		require.True(t, threadMembership.Following)
		assert.Equal(t, int64(1), threadMembership.UnreadMentions)
	})
}

func TestIsCRTEnabledForUser(t *testing.T) {
	type preference struct {
		val string
		err error
	}

	testCases := []struct {
		desc     string
		appCRT   string
		pref     preference
		expected bool
	}{
		{
			desc:     "Returns false when system config is disabled",
			appCRT:   model.CollapsedThreadsDisabled,
			expected: false,
		},
		{
			desc:     "Returns true when system config is always_on",
			appCRT:   model.CollapsedThreadsAlwaysOn,
			expected: true,
		},
		{
			desc:     "Returns true when system config is default_on and user has no preference",
			appCRT:   model.CollapsedThreadsDefaultOn,
			pref:     preference{"test", errors.New("err")},
			expected: true,
		},
		{
			desc:     "Returns false when system config is default_off and user has no preference",
			appCRT:   model.CollapsedThreadsDefaultOff,
			pref:     preference{"qwe", errors.New("err")},
			expected: false,
		},
		{
			desc:     "Returns true when system config is default_on and user has on preference",
			appCRT:   model.CollapsedThreadsDefaultOn,
			pref:     preference{"on", nil},
			expected: true,
		},
		{
			desc:     "Returns false when system config is default_on and user has off preference",
			appCRT:   model.CollapsedThreadsDefaultOn,
			pref:     preference{"off", nil},
			expected: false,
		},
		{
			desc:     "Returns true when system config is default_off and user has on preference",
			appCRT:   model.CollapsedThreadsDefaultOff,
			pref:     preference{"on", nil},
			expected: true,
		},
		{
			desc:     "Returns false when system config is default_off and user has off preference",
			appCRT:   model.CollapsedThreadsDefaultOff,
			pref:     preference{"off", nil},
			expected: false,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.desc, func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			th.App.Config().ServiceSettings.CollapsedThreads = &tc.appCRT

			mockStore := th.App.Srv().Store().(*mocks.Store)
			mockPreferenceStore := mocks.PreferenceStore{}
			mockPreferenceStore.On("Get", mock.Anything, model.PreferenceCategoryDisplaySettings, model.PreferenceNameCollapsedThreadsEnabled).Return(&model.Preference{Value: tc.pref.val}, tc.pref.err)
			mockStore.On("Preference").Return(&mockPreferenceStore)

			res := th.App.IsCRTEnabledForUser(th.Context, mock.Anything)

			assert.Equal(t, tc.expected, res)
		})
	}
}

func TestGetTopChannelsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })

	channel2 := th.CreateChannel(th.Context, th.BasicTeam)

	// add a bot post to ensure it's not counted
	_, err := th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a bot",
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_bot": true,
		},
	})
	require.NoError(t, err)

	channel3 := th.CreatePrivateChannel(th.Context, th.BasicTeam)

	// add a webhook post to ensure it's not counted
	_, err = th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a webhook",
		ChannelId: channel3.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_webhook": true,
		},
	})
	require.NoError(t, err)

	// add an oauth app post to ensure it's not counted
	_, err = th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from an ouath app",
		ChannelId: channel3.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_oauth_app": true,
		},
	})
	require.NoError(t, err)

	// add a plugin post to ensure it's not counted
	_, err = th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a plugin",
		ChannelId: channel3.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_plugin": true,
		},
	})
	require.NoError(t, err)

	// add a system post to ensure it's not counted
	_, err = th.Server.Store().Post().Save(&model.Post{
		Message:   "system message",
		Type:      "system_join_channel",
		ChannelId: channel3.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_oauth_app": true,
		},
	})
	require.NoError(t, err)

	channel4 := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	channel5 := th.CreateChannel(th.Context, th.BasicTeam)
	channel6 := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(th.BasicUser, channel2)
	th.AddUserToChannel(th.BasicUser, channel3)
	th.AddUserToChannel(th.BasicUser, channel4)
	th.AddUserToChannel(th.BasicUser, channel5)
	th.AddUserToChannel(th.BasicUser, channel6)

	channels := [6]*model.Channel{th.BasicChannel, channel2, channel3, channel4, channel5, channel6}

	i := len(channels)
	for _, channel := range channels {
		for j := i; j > 0; j-- {
			th.CreatePost(channel)
		}
		i--
	}

	expectedTopChannels := []struct {
		ID           string
		MessageCount int64
	}{
		{ID: th.BasicChannel.Id, MessageCount: 7},
		{ID: channel2.Id, MessageCount: 5},
		{ID: channel3.Id, MessageCount: 4},
		{ID: channel4.Id, MessageCount: 3},
		{ID: channel5.Id, MessageCount: 2},
	}

	timeRange, _ := model.GetStartOfDayForTimeRange(model.TimeRangeToday, time.Now().Location())

	t.Run("get-top-channels-for-team-since", func(t *testing.T) {
		topChannels, err := th.App.GetTopChannelsForTeamSince(th.Context, th.BasicChannel.TeamId, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 5})
		require.Nil(t, err)

		for i, channel := range topChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
			assert.Equal(t, expectedTopChannels[i].MessageCount, channel.MessageCount)
		}

		topChannels, err = th.App.GetTopChannelsForTeamSince(th.Context, th.BasicChannel.TeamId, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 1, PerPage: 5})
		require.Nil(t, err)
		assert.Equal(t, channel6.Id, topChannels.Items[0].ID)
		assert.Equal(t, int64(1), topChannels.Items[0].MessageCount)
	})
}

func TestGetTopChannelsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })

	channel2 := th.CreateChannel(th.Context, th.BasicTeam)

	// add a bot post to ensure it's not counted
	_, err := th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a bot",
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_bot": true,
		},
	})
	require.NoError(t, err)

	channel3 := th.CreatePrivateChannel(th.Context, th.BasicTeam)

	// add a webhook post to ensure it's not counted
	_, err = th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a webhook",
		ChannelId: channel3.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_webhook": true,
		},
	})
	require.NoError(t, err)

	channel4 := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	channel5 := th.CreateChannel(th.Context, th.BasicTeam)
	channel6 := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(th.BasicUser, channel2)
	th.AddUserToChannel(th.BasicUser, channel3)
	th.AddUserToChannel(th.BasicUser, channel4)
	th.AddUserToChannel(th.BasicUser, channel5)
	th.AddUserToChannel(th.BasicUser, channel6)

	channels := [6]*model.Channel{th.BasicChannel, channel2, channel3, channel4, channel5, channel6}

	i := len(channels)
	for _, channel := range channels {
		for j := i; j > 0; j-- {
			th.CreatePost(channel)
		}
		i--
	}

	expectedTopChannels := []struct {
		ID           string
		MessageCount int64
	}{
		{ID: th.BasicChannel.Id, MessageCount: 7},
		{ID: channel2.Id, MessageCount: 5},
		{ID: channel3.Id, MessageCount: 4},
		{ID: channel4.Id, MessageCount: 3},
		{ID: channel5.Id, MessageCount: 2},
	}

	timeRange, _ := model.GetStartOfDayForTimeRange(model.TimeRangeToday, time.Now().Location())

	t.Run("get-top-channels-for-user-since", func(t *testing.T) {
		topChannels, err := th.App.GetTopChannelsForUserSince(th.Context, th.BasicUser.Id, "", &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 5})
		require.Nil(t, err)

		for i, channel := range topChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
			assert.Equal(t, expectedTopChannels[i].MessageCount, channel.MessageCount)
		}

		topChannels, err = th.App.GetTopChannelsForUserSince(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 1, PerPage: 5})
		require.Nil(t, err)
		assert.Equal(t, channel6.Id, topChannels.Items[0].ID)
		assert.Equal(t, int64(1), topChannels.Items[0].MessageCount)
	})
}

func TestPostCountsByDuration(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })

	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	channel3 := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	channel4 := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	channel5 := th.CreateChannel(th.Context, th.BasicTeam)
	channel6 := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	defer func() {
		th.App.PermanentDeleteChannel(th.Context, channel2)
		th.App.PermanentDeleteChannel(th.Context, channel3)
		th.App.PermanentDeleteChannel(th.Context, channel4)
		th.App.PermanentDeleteChannel(th.Context, channel5)
		th.App.PermanentDeleteChannel(th.Context, channel6)
	}()
	th.AddUserToChannel(th.BasicUser, channel2)
	th.AddUserToChannel(th.BasicUser, channel3)
	th.AddUserToChannel(th.BasicUser, channel4)
	th.AddUserToChannel(th.BasicUser, channel5)
	th.AddUserToChannel(th.BasicUser, channel6)

	channels := [6]*model.Channel{th.BasicChannel, channel2, channel3, channel4, channel5, channel6}
	channelIDs := []string{th.BasicChannel.Id, channel2.Id, channel3.Id, channel4.Id, channel5.Id, channel6.Id}

	i := len(channels)
	for ci, channel := range channels {
		for j := i; j > 0; j-- {
			d1 := time.Date(2009, time.November, 10, 23, 0, 0, 0, time.UTC).AddDate(0, 0, ci)
			d2 := time.Date(2009, time.November, 10, 9, 0, 0, 0, time.UTC).AddDate(0, 0, ci)
			_, err := th.App.CreatePost(th.Context, &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: channel.Id,
				CreateAt:  d1.Unix() * 1000,
			}, channel, false, false)
			require.Nil(t, err)
			_, err = th.App.CreatePost(th.Context, &model.Post{
				UserId:    th.BasicUser2.Id,
				ChannelId: channel.Id,
				CreateAt:  d2.Unix() * 1000,
			}, channel, false, false)
			require.Nil(t, err)
		}
		i--
	}

	expectedDayGrouping := map[string]map[string]int{
		"2009-11-10": {
			th.BasicChannel.Id: 6,
		},
		"2009-11-11": {
			channel2.Id: 5,
		},
		"2009-11-12": {
			channel3.Id: 4,
		},
		"2009-11-13": {
			channel4.Id: 3,
		},
		"2009-11-14": {
			channel5.Id: 2,
		},
		"2009-11-15": {
			channel6.Id: 1,
		},
	}

	expectedHourGrouping := map[string]map[string]int{
		"2009-11-15T09": {
			channel6.Id: 1,
		},
		"2009-11-15T23": {
			channel6.Id: 1,
		},
	}

	sinceUnixMillis := time.Date(2009, time.November, 9, 23, 0, 0, 0, time.UTC).UnixMilli()

	t.Run("get-post-counts-by-day scoped by user, grouped by day", func(t *testing.T) {
		dailyPostCount, err := th.App.PostCountsByDuration(th.Context, channelIDs, sinceUnixMillis, &th.BasicUser.Id, model.PostsByDay, time.Now().UTC().Location())
		require.Nil(t, err)
		require.GreaterOrEqual(t, len(dailyPostCount), 6)

		for _, item := range dailyPostCount {
			if strings.HasPrefix(item.Duration, "2009") {
				expectedCount := expectedDayGrouping[item.Duration][item.ChannelID]
				assert.Equal(t, expectedCount, item.PostCount)
			}
		}
	})

	t.Run("get-post-counts-by-day all users, grouped by day", func(t *testing.T) {
		dailyPostCount, err := th.App.PostCountsByDuration(th.Context, channelIDs, sinceUnixMillis, nil, model.PostsByDay, time.Now().UTC().Location())
		require.Nil(t, err)
		require.GreaterOrEqual(t, len(dailyPostCount), 6)

		for _, item := range dailyPostCount {
			if strings.HasPrefix(item.Duration, "2009") {
				expectedCount := expectedDayGrouping[item.Duration][item.ChannelID]
				assert.Equal(t, expectedCount*2, item.PostCount)
			}
		}
	})

	t.Run("get-post-counts-by-day all users, grouped by hour", func(t *testing.T) {
		oneDaySince := time.Date(2009, time.November, 14, 23, 0, 0, 0, time.UTC).UnixMilli()
		dailyPostCount, err := th.App.PostCountsByDuration(th.Context, channelIDs, oneDaySince, nil, model.PostsByHour, time.Now().UTC().Location())
		require.Nil(t, err)
		require.GreaterOrEqual(t, len(dailyPostCount), 1)

		for _, item := range dailyPostCount {
			if strings.HasPrefix(item.Duration, "2009") {
				expectedCount := expectedHourGrouping[item.Duration][item.ChannelID]
				assert.Equal(t, expectedCount, item.PostCount)
			}
		}
	})
}

//  Top inactive channels

func TestGetTopInactiveChannelsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })

	channel2 := th.CreateChannel(th.Context, th.BasicTeam, WithCreateAt(1))
	channel3 := th.CreateChannel(th.Context, th.BasicTeam, WithCreateAt(1))
	channel4 := th.CreatePrivateChannel(th.Context, th.BasicTeam, WithCreateAt(1))
	channel5 := th.CreateChannel(th.Context, th.BasicTeam, WithCreateAt(1))
	channel6 := th.CreatePrivateChannel(th.Context, th.BasicTeam, WithCreateAt(1))
	th.AddUserToChannel(th.BasicUser, channel2)
	th.AddUserToChannel(th.BasicUser, channel3)
	th.AddUserToChannel(th.BasicUser, channel4)
	th.AddUserToChannel(th.BasicUser, channel5)
	th.AddUserToChannel(th.BasicUser, channel6)

	// delete offtopic, town square, basicChannel channel - which interferes with 'least' active channel results
	offTopicChannel, appErr := th.App.GetChannelByName(th.Context, "off-topic", th.BasicTeam.Id, false)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, offTopicChannel)
	require.Nil(t, appErr)
	townSquareChannel, appErr := th.App.GetChannelByName(th.Context, "town-square", th.BasicTeam.Id, false)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, townSquareChannel)
	require.Nil(t, appErr)
	basicChannel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, basicChannel)
	require.Nil(t, appErr)

	// add a bot post to ensure it's counted
	_, err := th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a bot",
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_bot": true,
		},
	})
	require.NoError(t, err)

	// add a webhook post to ensure it's counted
	_, err = th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a webhook",
		ChannelId: channel3.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_webhook": true,
		},
	})
	require.NoError(t, err)

	channels := [5]*model.Channel{channel2, channel3, channel4, channel5, channel6}

	i := len(channels)
	for _, channel := range channels {
		for j := i; j > 0; j-- {
			th.CreatePost(channel)
		}
		i--
	}

	expectedTopChannels := []struct {
		ID           string
		MessageCount int64
	}{
		{ID: channel6.Id, MessageCount: 1},
		{ID: channel5.Id, MessageCount: 2},
		{ID: channel4.Id, MessageCount: 3},
		{ID: channel3.Id, MessageCount: 5},
		{ID: channel2.Id, MessageCount: 6},
	}

	timeRange, _ := model.GetStartOfDayForTimeRange(model.TimeRangeToday, time.Now().Location())

	t.Run("get-top-channels-for-team-since", func(t *testing.T) {
		topChannels, err := th.App.GetTopInactiveChannelsForTeamSince(th.Context, th.BasicChannel.TeamId, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 5})
		require.Nil(t, err)

		for i, channel := range topChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
			assert.Equal(t, expectedTopChannels[i].MessageCount, channel.MessageCount)
		}

		topChannels, err = th.App.GetTopInactiveChannelsForTeamSince(th.Context, th.BasicChannel.TeamId, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 1, PerPage: 4})
		require.Nil(t, err)
		assert.Equal(t, channel2.Id, topChannels.Items[0].ID)
		assert.Equal(t, int64(6), topChannels.Items[0].MessageCount)

		// it simulates channel being created recently
		_ = th.CreatePrivateChannel(th.Context, th.BasicTeam)
		topChannels, err = th.App.GetTopInactiveChannelsForTeamSince(th.Context, th.BasicChannel.TeamId, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 6})
		require.Nil(t, err)
		assert.Equal(t, 5, len(topChannels.Items))
	})
}

func TestGetTopInactiveChannelsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })

	// delete offtopic, town-square, th.basicchannel channels - which interferes with 'least' active channel results
	offTopicChannel, appErr := th.App.GetChannelByName(th.Context, "off-topic", th.BasicTeam.Id, false)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, offTopicChannel)
	require.Nil(t, appErr)
	townSquareChannel, appErr := th.App.GetChannelByName(th.Context, "town-square", th.BasicTeam.Id, false)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, townSquareChannel)
	require.Nil(t, appErr)
	basicChannel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, basicChannel)
	require.Nil(t, appErr)

	channel2 := th.CreateChannel(th.Context, th.BasicTeam, WithCreateAt(1))

	// add a bot post to ensure it's counted
	_, err := th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a bot",
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_bot": true,
		},
	})
	require.NoError(t, err)

	channel3 := th.CreatePrivateChannel(th.Context, th.BasicTeam, WithCreateAt(1))

	// add a webhook post to ensure it's counted
	_, err = th.Server.Store().Post().Save(&model.Post{
		Message:   "hello from a webhook",
		ChannelId: channel3.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			"from_webhook": true,
		},
	})
	require.NoError(t, err)

	channel4 := th.CreatePrivateChannel(th.Context, th.BasicTeam, WithCreateAt(1))
	channel5 := th.CreateChannel(th.Context, th.BasicTeam, WithCreateAt(1))
	channel6 := th.CreatePrivateChannel(th.Context, th.BasicTeam, WithCreateAt(1))
	th.AddUserToChannel(th.BasicUser, channel2)
	th.AddUserToChannel(th.BasicUser, channel3)
	th.AddUserToChannel(th.BasicUser, channel4)
	th.AddUserToChannel(th.BasicUser, channel5)
	th.AddUserToChannel(th.BasicUser, channel6)

	channels := [5]*model.Channel{channel2, channel3, channel4, channel5, channel6}

	i := len(channels)
	for _, channel := range channels {
		for j := i; j > 0; j-- {
			th.CreatePost(channel)
		}
		i--
	}

	expectedTopChannels := []struct {
		ID           string
		MessageCount int64
	}{
		{ID: channel6.Id, MessageCount: 1},
		{ID: channel5.Id, MessageCount: 2},
		{ID: channel4.Id, MessageCount: 3},
		{ID: channel3.Id, MessageCount: 5},
		{ID: channel2.Id, MessageCount: 6},
	}

	timeRange, _ := model.GetStartOfDayForTimeRange(model.TimeRangeToday, time.Now().Location())

	t.Run("get-top-channels-for-user-since", func(t *testing.T) {
		topChannels, err := th.App.GetTopInactiveChannelsForUserSince(th.Context, th.BasicChannel.TeamId, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 4})
		require.Nil(t, err)
		require.Equal(t, len(topChannels.Items), 4)
		for i, channel := range topChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
			assert.Equal(t, expectedTopChannels[i].MessageCount, channel.MessageCount)
		}

		topChannels, err = th.App.GetTopInactiveChannelsForUserSince(th.Context, th.BasicChannel.TeamId, th.BasicUser.Id, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 1, PerPage: 4})
		require.Nil(t, err)
		require.Equal(t, len(topChannels.Items), 1)
		assert.Equal(t, channel2.Id, topChannels.Items[0].ID)
		assert.Equal(t, int64(6), topChannels.Items[0].MessageCount)
	})
}
