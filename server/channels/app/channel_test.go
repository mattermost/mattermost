// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/channels/store"

	"github.com/mattermost/mattermost/server/v8/channels/app/teams"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestPermanentDeleteChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableIncomingWebhooks = true
		*cfg.ServiceSettings.EnableOutgoingWebhooks = true
	})

	channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "deletion-test", Name: "deletion-test", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.NotNil(t, channel, "Channel shouldn't be nil")
	require.Nil(t, appErr)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channel)
		require.Nil(t, appErr)
	}()

	incoming, appErr := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, channel, &model.IncomingWebhook{ChannelId: channel.Id})
	require.NotNil(t, incoming, "incoming webhook should not be nil")
	require.Nil(t, appErr, "Unable to create Incoming Webhook for Channel")
	defer func(hookID string) {
		appErr = th.App.DeleteIncomingWebhook(hookID)
		require.Nil(t, appErr)
	}(incoming.Id)

	incoming, appErr = th.App.GetIncomingWebhook(incoming.Id)
	require.NotNil(t, incoming, "incoming webhook should not be nil")
	require.Nil(t, appErr, "Unable to get new incoming webhook")

	outgoing, appErr := th.App.CreateOutgoingWebhook(&model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       channel.TeamId,
		CreatorId:    th.BasicUser.Id,
		CallbackURLs: []string{"https://foo"},
	})
	require.Nil(t, appErr)
	defer func(hookID string) {
		appErr = th.App.DeleteOutgoingWebhook(hookID)
		require.Nil(t, appErr)
	}(outgoing.Id)

	outgoing, appErr = th.App.GetOutgoingWebhook(outgoing.Id)
	require.NotNil(t, outgoing, "Outgoing webhook should not be nil")
	require.Nil(t, appErr, "Unable to get new outgoing webhook")

	appErr = th.App.PermanentDeleteChannel(th.Context, channel)
	require.Nil(t, appErr)

	incoming, appErr = th.App.GetIncomingWebhook(incoming.Id)
	require.Nil(t, incoming, "Incoming webhook should be nil")
	require.NotNil(t, appErr, "Incoming webhook wasn't deleted")

	outgoing, appErr = th.App.GetOutgoingWebhook(outgoing.Id)
	require.Nil(t, outgoing, "Outgoing webhook should be nil")
	require.NotNil(t, appErr, "Outgoing webhook wasn't deleted")
}

func TestRemoveAllDeactivatedMembersFromChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	var appErr *model.AppError

	team := th.CreateTeam()
	channel := th.CreateChannel(th.Context, team)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channel)
		require.Nil(t, appErr)
		appErr = th.App.PermanentDeleteTeam(th.Context, team)
		require.Nil(t, appErr)
	}()

	_, _, appErr = th.App.AddUserToTeam(th.Context, team.Id, th.BasicUser.Id, "")
	require.Nil(t, appErr)

	deactivatedUser := th.CreateUser()
	_, _, appErr = th.App.AddUserToTeam(th.Context, team.Id, deactivatedUser.Id, "")
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, deactivatedUser, channel, false)
	require.Nil(t, appErr)
	channelMembers, appErr := th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 10000000)
	require.Nil(t, appErr)
	require.Len(t, channelMembers, 2)
	_, appErr = th.App.UpdateActive(th.Context, deactivatedUser, false)
	require.Nil(t, appErr)

	appErr = th.App.RemoveAllDeactivatedMembersFromChannel(th.Context, channel)
	require.Nil(t, appErr)

	channelMembers, appErr = th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 10000000)
	require.Nil(t, appErr)
	require.Len(t, channelMembers, 1)
}

func TestMoveChannel(t *testing.T) {
	t.Run("should move channels between teams", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		var appErr *model.AppError

		sourceTeam := th.CreateTeam()
		targetTeam := th.CreateTeam()
		channel1 := th.CreateChannel(th.Context, sourceTeam)
		defer func() {
			appErr = th.App.PermanentDeleteChannel(th.Context, channel1)
			require.Nil(t, appErr)

			appErr = th.App.PermanentDeleteTeam(th.Context, sourceTeam)
			require.Nil(t, appErr)

			appErr = th.App.PermanentDeleteTeam(th.Context, targetTeam)
			require.Nil(t, appErr)
		}()

		_, _, appErr = th.App.AddUserToTeam(th.Context, sourceTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, appErr)

		_, _, appErr = th.App.AddUserToTeam(th.Context, sourceTeam.Id, th.BasicUser2.Id, "")
		require.Nil(t, appErr)

		_, _, appErr = th.App.AddUserToTeam(th.Context, targetTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, channel1, false)
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, channel1, false)
		require.Nil(t, appErr)

		appErr = th.App.MoveChannel(th.Context, targetTeam, channel1, th.BasicUser)
		require.NotNil(t, appErr, "Should have failed due to mismatched members.")

		_, _, appErr = th.App.AddUserToTeam(th.Context, targetTeam.Id, th.BasicUser2.Id, "")
		require.Nil(t, appErr)

		appErr = th.App.MoveChannel(th.Context, targetTeam, channel1, th.BasicUser)
		require.Nil(t, appErr)

		// Test moving a channel with a deactivated user who isn't in the destination team.
		// It should fail, unless removeDeactivatedMembers is true.
		deactivatedUser := th.CreateUser()
		channel2 := th.CreateChannel(th.Context, sourceTeam)
		defer func() {
			appErr = th.App.PermanentDeleteChannel(th.Context, channel2)
			require.Nil(t, appErr)
		}()

		_, _, appErr = th.App.AddUserToTeam(th.Context, sourceTeam.Id, deactivatedUser.Id, "")
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, channel2, false)
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, deactivatedUser, channel2, false)
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateActive(th.Context, deactivatedUser, false)
		require.Nil(t, appErr)

		appErr = th.App.MoveChannel(th.Context, targetTeam, channel2, th.BasicUser)
		require.NotNil(t, appErr, "Should have failed due to mismatched deactivated member.")

		// Test moving a channel with no members.
		channel3 := &model.Channel{
			DisplayName: "dn_" + model.NewId(),
			Name:        "name_" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      sourceTeam.Id,
			CreatorId:   th.BasicUser.Id,
		}

		channel3, appErr = th.App.CreateChannel(th.Context, channel3, false)
		require.Nil(t, appErr)
		defer func() {
			appErr = th.App.PermanentDeleteChannel(th.Context, channel3)
			require.Nil(t, appErr)
		}()

		appErr = th.App.MoveChannel(th.Context, targetTeam, channel3, th.BasicUser)
		assert.Nil(t, appErr)
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
		category, appErr := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, sourceTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "new category",
			},
			Channels: []string{channel.Id},
		})
		require.Nil(t, appErr)
		require.Equal(t, []string{channel.Id}, category.Channels)

		appErr = th.App.MoveChannel(th.Context, targetTeam, channel, th.BasicUser)
		require.Nil(t, appErr)

		moved, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.Equal(t, targetTeam.Id, moved.TeamId)

		// The channel should no longer be on the old team
		updatedCategory, appErr := th.App.GetSidebarCategory(th.Context, category.Id)
		require.Nil(t, appErr)
		assert.Equal(t, []string{}, updatedCategory.Channels)

		// And it should be on the new team instead
		categories, appErr := th.App.GetSidebarCategoriesForTeamForUser(th.Context, th.BasicUser.Id, targetTeam.Id)
		require.Nil(t, appErr)
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
		appErr := th.App.PermanentDeleteChannel(th.Context, channel1)
		require.Nil(t, appErr)

		appErr = th.App.PermanentDeleteTeam(th.Context, team)
		require.Nil(t, appErr)

		appErr = th.App.PermanentDeleteTeam(th.Context, team2)
		require.Nil(t, appErr)
	}()

	_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, th.BasicUser.Id, "")
	require.Nil(t, appErr)
	_, _, appErr = th.App.AddUserToTeam(th.Context, team2.Id, th.BasicUser.Id, "")
	require.Nil(t, appErr)
	_, _, appErr = th.App.AddUserToTeam(th.Context, team.Id, th.BasicUser2.Id, "")
	require.Nil(t, appErr)

	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, channel1, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, channel1, false)
	require.Nil(t, appErr)

	appErr = th.App.RemoveUsersFromChannelNotMemberOfTeam(th.Context, th.SystemAdminUser, channel1, team2)
	require.Nil(t, appErr)

	channelMembers, appErr := th.App.GetChannelMembersPage(th.Context, channel1.Id, 0, 10000000)
	require.Nil(t, appErr)
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
	townSquareChannelID := channel.Id
	users, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, townSquareChannelID)
	require.NoError(t, nErr)
	initialNumTownSquareUsers := len(users)

	// create a new user that joins the default channels
	user := th.CreateUser()
	appErr := th.App.JoinDefaultChannels(th.Context, th.BasicTeam.Id, user, false, "")
	require.Nil(t, appErr)

	// there should be a ChannelMemberHistory record for the user
	histories, nErr := th.App.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, townSquareChannelID)
	require.NoError(t, nErr)
	assert.Len(t, histories, initialNumTownSquareUsers+1)

	found := false
	for _, history := range histories {
		if user.Id == history.UserId && townSquareChannelID == history.ChannelId {
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
	appError := th.App.JoinDefaultChannels(th.Context, th.BasicTeam.Id, user, false, "")
	require.Nil(t, appError)

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
	defer func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, basicChannel2)
		require.Nil(t, appErr)
	}()
	defaultChannelList := []string{th.BasicChannel.Name, basicChannel2.Name, basicChannel2.Name}
	th.App.Config().TeamSettings.ExperimentalDefaultChannels = defaultChannelList

	user := th.CreateUser()
	appErr := th.App.JoinDefaultChannels(th.Context, th.BasicTeam.Id, user, false, "")
	require.Nil(t, appErr)

	for _, channelName := range defaultChannelList {
		channel, appErr := th.App.GetChannelByName(th.Context, channelName, th.BasicTeam.Id, false)
		require.Nil(t, appErr, "Expected nil, didn't receive nil")

		member, appErr := th.App.GetChannelMember(th.Context, channel.Id, user.Id)
		require.Nil(t, appErr, "Expected nil object, didn't receive nil")
		require.NotNil(t, member, "Expected member object, got nil")
	}
}

func TestJoinDefaultChannelsExperimentalDefaultChannelsMissing(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	basicChannel2 := th.CreateChannel(th.Context, th.BasicTeam)
	defer func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, basicChannel2)
		require.Nil(t, appErr)
	}()
	defaultChannelList := []string{th.BasicChannel.Name, basicChannel2.Name, "thischanneldoesnotexist", basicChannel2.Name}
	th.App.Config().TeamSettings.ExperimentalDefaultChannels = defaultChannelList

	user := th.CreateUser()
	require.Nil(t, th.App.JoinDefaultChannels(th.Context, th.BasicTeam.Id, user, false, ""))

	for _, channelName := range defaultChannelList {
		if channelName == "thischanneldoesnotexist" {
			continue // skip the non-existent channel
		}

		channel, appErr := th.App.GetChannelByName(th.Context, channelName, th.BasicTeam.Id, false)
		require.Nil(t, appErr, "Expected nil, didn't receive nil")

		member, appErr := th.App.GetChannelMember(th.Context, channel.Id, user.Id)

		require.NotNil(t, member, "Expected member object, got nil")
		require.Nil(t, appErr, "Expected nil object, didn't receive nil")
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

	channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "  Public 1  ", Name: "public1", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channel)
		require.Nil(t, appErr)
	}()
	require.Nil(t, appErr)
	require.Equal(t, channel.DisplayName, "Public 1")
}

func TestUpdateChannelPrivacy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	privateChannel := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypePrivate)
	privateChannel.Type = model.ChannelTypeOpen

	publicChannel, appErr := th.App.UpdateChannelPrivacy(th.Context, privateChannel, th.BasicUser)
	require.Nil(t, appErr, "Failed to update channel privacy.")
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

	t.Run("Cannot create with a remote user", func(t *testing.T) {
		user2.RemoteId = model.NewPointer(model.NewId())
		_, appErr := th.App.UpdateUser(th.Context, user2, false)
		require.Nil(t, appErr)

		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, dm)
		require.NotNil(t, appErr)
	})
}

func TestCreateGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := th.CreateUser()
	user2 := th.CreateUser()

	groupUserIds := make([]string, 0)
	groupUserIds = append(groupUserIds, user1.Id)
	groupUserIds = append(groupUserIds, user2.Id)
	groupUserIds = append(groupUserIds, th.BasicUser.Id)

	t.Run("Should not allow to create a group with a remote user", func(t *testing.T) {
		user2.RemoteId = model.NewPointer(model.NewId())
		_, appErr := th.App.UpdateUser(th.Context, user2, false)
		require.Nil(t, appErr)

		dm, appErr := th.App.CreateGroupChannel(th.Context, groupUserIds, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Nil(t, dm)
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

	channel, appErr := th.App.CreateGroupChannel(th.Context, groupUserIds, th.BasicUser.Id)

	require.Nil(t, appErr, "Failed to create group channel.")
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

	channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
	require.Nil(t, appErr, "Failed to create direct channel.")

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
	channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
	require.Nil(t, appErr, "Failed to create direct channel.")

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
	_, appErr := th.App.AddTeamMember(th.Context, th.BasicTeam.Id, user.Id)
	require.Nil(t, appErr, "Failed to add user to team.")

	groupUserIds := make([]string, 0)
	groupUserIds = append(groupUserIds, th.BasicUser.Id)
	groupUserIds = append(groupUserIds, user.Id)

	channel := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen)

	_, appErr = th.App.AddUserToChannel(th.Context, user, channel, false)
	require.Nil(t, appErr, "Failed to add user to channel.")

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

	townSquare, appErr := th.App.GetChannelByName(th.Context, "town-square", th.BasicTeam.Id, false)
	require.Nil(t, appErr)
	th.AddUserToChannel(guest, townSquare)
	th.AddUserToChannel(th.BasicUser, townSquare)

	t.Run("User tries to leave the default channel", func(t *testing.T) {
		appErr = th.App.LeaveChannel(th.Context, townSquare.Id, th.BasicUser.Id)
		assert.NotNil(t, appErr, "It should fail to remove a regular user from the default channel")
		assert.Equal(t, appErr.Id, "api.channel.remove.default.app_error")
		_, appErr = th.App.GetChannelMember(th.Context, townSquare.Id, th.BasicUser.Id)
		assert.Nil(t, appErr)
	})

	t.Run("Guest leaves the default channel", func(t *testing.T) {
		appErr = th.App.LeaveChannel(th.Context, townSquare.Id, guest.Id)
		assert.Nil(t, appErr, "It should allow to remove a guest user from the default channel")
		_, appErr = th.App.GetChannelMember(th.Context, townSquare.Id, guest.Id)
		assert.NotNil(t, appErr)
	})

	t.Run("Trying to leave the default channel should not delete thread memberships", func(t *testing.T) {
		post := &model.Post{
			ChannelId: townSquare.Id,
			Message:   "root post",
			UserId:    th.BasicUser.Id,
		}
		rpost, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		reply := &model.Post{
			ChannelId: townSquare.Id,
			Message:   "reply post",
			UserId:    th.BasicUser.Id,
			RootId:    rpost.Id,
		}
		_, appErr = th.App.CreatePost(th.Context, reply, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		threads, appErr := th.App.GetThreadsForUser(th.BasicUser.Id, townSquare.TeamId, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		require.Len(t, threads.Threads, 1)

		appErr = th.App.LeaveChannel(th.Context, townSquare.Id, th.BasicUser.Id)
		assert.NotNil(t, appErr, "It should fail to remove a regular user from the default channel")
		assert.Equal(t, appErr.Id, "api.channel.remove.default.app_error")

		threads, appErr = th.App.GetThreadsForUser(th.BasicUser.Id, townSquare.TeamId, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
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

		rpost, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		reply := &model.Post{
			ChannelId: channel.Id,
			Message:   "reply post",
			UserId:    th.BasicUser.Id,
			RootId:    rpost.Id,
		}
		_, appErr = th.App.CreatePost(th.Context, reply, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		return rpost
	}

	t.Run("thread memberships are deleted", func(t *testing.T) {
		createThread(th.BasicChannel)
		channel2 := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen)
		createThread(channel2)

		threads, appErr := th.App.GetThreadsForUser(th.BasicUser.Id, th.BasicChannel.TeamId, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		require.Len(t, threads.Threads, 2)

		appErr = th.App.LeaveChannel(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, appErr = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.NotNil(t, appErr, "It should remove channel membership")

		threads, appErr = th.App.GetThreadsForUser(th.BasicUser.Id, th.BasicChannel.TeamId, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		require.Len(t, threads.Threads, 1)
	})
}

func TestLeaveLastChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	guest := th.CreateGuest()
	th.LinkUserToTeam(guest, th.BasicTeam)

	townSquare, appErr := th.App.GetChannelByName(th.Context, "town-square", th.BasicTeam.Id, false)
	require.Nil(t, appErr)
	th.AddUserToChannel(guest, townSquare)
	th.AddUserToChannel(guest, th.BasicChannel)

	t.Run("Guest leaves not last channel", func(t *testing.T) {
		appErr = th.App.LeaveChannel(th.Context, townSquare.Id, guest.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		assert.Nil(t, appErr, "It should maintain the team membership")
	})

	t.Run("Guest leaves last channel", func(t *testing.T) {
		appErr = th.App.LeaveChannel(th.Context, th.BasicChannel.Id, guest.Id)
		assert.Nil(t, appErr, "It should allow to remove a guest user from the default channel")
		_, appErr = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, guest.Id)
		assert.NotNil(t, appErr)
		_, appErr = th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		assert.Nil(t, appErr, "It should remove the team membership")
	})
}

func TestAddChannelMemberNoUserRequestor(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create a user and add it to a channel
	user := th.CreateUser()
	_, appErr := th.App.AddTeamMember(th.Context, th.BasicTeam.Id, user.Id)
	require.Nil(t, appErr)

	groupUserIds := make([]string, 0)
	groupUserIds = append(groupUserIds, th.BasicUser.Id)
	groupUserIds = append(groupUserIds, user.Id)

	channel := th.createChannel(th.Context, th.BasicTeam, model.ChannelTypeOpen)

	_, appErr = th.App.AddChannelMember(th.Context, user.Id, channel, ChannelMemberOpts{})
	require.Nil(t, appErr, "Failed to add user to channel.")

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

func TestAddChannelMemberDeletedUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	_, appErr := th.App.AddTeamMember(th.Context, th.BasicTeam.Id, user.Id)
	require.Nil(t, appErr)

	deactivated, appErr := th.App.UpdateActive(th.Context, user, false)
	require.Greater(t, deactivated.DeleteAt, int64(0))

	require.Nil(t, appErr)
	_, appErr = th.App.AddChannelMember(th.Context, user.Id, th.BasicChannel, ChannelMemberOpts{})
	require.NotNil(t, appErr)
}

func TestAppUpdateChannelScheme(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	mockID := model.NewPointer("x")
	channel.SchemeId = mockID

	updatedChannel, appErr := th.App.UpdateChannelScheme(th.Context, channel)
	require.Nil(t, appErr)

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
		member1, appErr := th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.False(t, member1.IsChannelMuted())

		member2, appErr := th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.False(t, member2.IsChannelMuted())

		// Mute both channels
		updated, appErr := th.App.setChannelsMuted(th.Context, []string{channel1.Id, channel2.Id}, th.BasicUser.Id, true)
		require.Nil(t, appErr)
		assert.True(t, updated[0].IsChannelMuted())
		assert.True(t, updated[1].IsChannelMuted())

		// Verify that the channels are muted in the database
		member1, appErr = th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.True(t, member1.IsChannelMuted())

		member2, appErr = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.True(t, member2.IsChannelMuted())

		// Unm both channels
		updated, appErr = th.App.setChannelsMuted(th.Context, []string{channel1.Id, channel2.Id}, th.BasicUser.Id, false)
		require.Nil(t, appErr)
		assert.False(t, updated[0].IsChannelMuted())
		assert.False(t, updated[1].IsChannelMuted())

		// Verify that the channels are muted in the database
		member1, appErr = th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.False(t, member1.IsChannelMuted())

		member2, appErr = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.False(t, member2.IsChannelMuted())
	})
}

func TestFillInChannelProps(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channelPublic1, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "Public 1", Name: "public1", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, appErr)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channelPublic1)
		require.Nil(t, appErr)
	}()

	channelPublic2, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "Public 2", Name: "public2", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, appErr)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channelPublic2)
		require.Nil(t, appErr)
	}()

	channelPrivate, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "Private", Name: "private", Type: model.ChannelTypePrivate, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, appErr)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channelPrivate)
		require.Nil(t, appErr)
	}()

	otherTeamId := model.NewId()
	otherTeam := &model.Team{
		DisplayName: "dn_" + otherTeamId,
		Name:        "name" + otherTeamId,
		Email:       "success+" + otherTeamId + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}
	otherTeam, appErr = th.App.CreateTeam(th.Context, otherTeam)
	require.Nil(t, appErr)
	defer func() {
		appErr = th.App.PermanentDeleteTeam(th.Context, otherTeam)
		require.Nil(t, appErr)
	}()

	channelOtherTeam, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "Other Team Channel", Name: "other-team", Type: model.ChannelTypeOpen, TeamId: otherTeam.Id}, false)
	require.Nil(t, appErr)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channelOtherTeam)
		require.Nil(t, appErr)
	}()

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
				appErr = th.App.FillInChannelProps(th.Context, testCase.Channel)
				require.Nil(t, appErr)

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
				appErr = th.App.FillInChannelsProps(th.Context, testCase.Channels)
				require.Nil(t, appErr)

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

	_, appErr := th.App.AddChannelMember(th.Context, th.BasicUser2.Id, th.BasicChannel, ChannelMemberOpts{})
	require.Nil(t, appErr, "Failed to add user to channel.")

	user := th.BasicUser
	user.Timezone["useAutomaticTimezone"] = "false"
	user.Timezone["manualTimezone"] = "XOXO/BLABLA"
	_, appErr = th.App.UpdateUser(th.Context, user, false)
	require.Nil(t, appErr)

	user2 := th.BasicUser2
	user2.Timezone["automaticTimezone"] = "NoWhere/Island"
	_, appErr = th.App.UpdateUser(th.Context, user2, false)
	require.Nil(t, appErr)

	user3 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, appErr := th.App.CreateUser(th.Context, &user3)
	require.Nil(t, appErr)

	_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
	require.Nil(t, appErr)

	_, appErr = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
	require.Nil(t, appErr)

	ruser.Timezone["automaticTimezone"] = "NoWhere/Island"
	_, appErr = th.App.UpdateUser(th.Context, ruser, false)
	require.Nil(t, appErr)

	user4 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ = th.App.CreateUser(th.Context, &user4)
	_, appErr = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
	require.NotNil(t, appErr, "user should not be able to join the channel without being in the team.")

	timezones, appErr := th.App.GetChannelMembersTimezones(th.Context, th.BasicChannel.Id)
	require.Nil(t, appErr, "Failed to get the timezones for a channel.")

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
	_, appErr := th.App.CreateChannel(th.Context, channel, true)
	require.Nil(t, appErr)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channel)
		require.Nil(t, appErr)
	}()
	defer th.TearDown()

	channelList, appErr := th.App.GetChannelsForTeamForUser(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.ChannelSearchOpts{
		IncludeDeleted: false,
		LastDeleteAt:   0,
	})
	require.Nil(t, appErr)
	require.Len(t, channelList, 4)

	appErr = th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
	require.Nil(t, appErr)

	// Now we get all the non-archived channels for the user
	channelList, appErr = th.App.GetChannelsForTeamForUser(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.ChannelSearchOpts{
		IncludeDeleted: false,
		LastDeleteAt:   0,
	})
	require.Nil(t, appErr)
	require.Len(t, channelList, 3)

	// Now we get all the channels, even though are archived, for the user
	channelList, appErr = th.App.GetChannelsForTeamForUser(th.Context, th.BasicTeam.Id, th.BasicUser.Id, &model.ChannelSearchOpts{
		IncludeDeleted: true,
		LastDeleteAt:   0,
	})
	require.Nil(t, appErr)
	require.Len(t, channelList, 4)
}

func TestGetPublicChannelsForTeam(t *testing.T) {
	th := Setup(t)
	team := th.CreateTeam()
	defer th.TearDown()

	var expectedChannels []*model.Channel

	townSquare, appErr := th.App.GetChannelByName(th.Context, "town-square", team.Id, false)
	require.Nil(t, appErr)
	require.NotNil(t, townSquare)
	expectedChannels = append(expectedChannels, townSquare)

	offTopic, appErr := th.App.GetChannelByName(th.Context, "off-topic", team.Id, false)
	require.Nil(t, appErr)
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
		rchannel, appErr = th.App.CreateChannel(th.Context, &channel, false)
		require.Nil(t, appErr)
		require.NotNil(t, rchannel)
		defer func() {
			appErr = th.App.PermanentDeleteChannel(th.Context, rchannel)
			require.Nil(t, appErr)
		}()

		// Store the user ids for comparison later
		expectedChannels = append(expectedChannels, rchannel)
	}

	// Fetch public channels multiple times
	channelList, appErr := th.App.GetPublicChannelsForTeam(th.Context, team.Id, 0, 5)
	require.Nil(t, appErr)
	channelList2, appErr := th.App.GetPublicChannelsForTeam(th.Context, team.Id, 5, 5)
	require.Nil(t, appErr)

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
		rchannel, appErr := th.App.CreateChannel(th.Context, &channel, false)
		require.Nil(t, appErr)
		require.NotNil(t, rchannel)
		defer func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, rchannel)
			require.Nil(t, appErr)
		}()

		// Store the user ids for comparison later
		expectedChannels = append(expectedChannels, rchannel)
	}

	// Fetch private channels multiple times
	channelList, appErr := th.App.GetPrivateChannelsForTeam(th.Context, team.Id, 0, 5)
	require.Nil(t, appErr)
	channelList2, appErr := th.App.GetPrivateChannelsForTeam(th.Context, team.Id, 5, 5)
	require.Nil(t, appErr)

	channels := append(channelList, channelList2...)
	assert.ElementsMatch(t, expectedChannels, channels)
}

func TestUpdateChannelMemberRolesChangingGuest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("from guest to user", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_user")
		require.NotNil(t, appErr, "Should fail when try to modify the guest role")
	})

	t.Run("from user to guest", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_guest")
		require.NotNil(t, appErr, "Should fail when try to modify the guest role")
	})

	t.Run("from user to admin", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_user channel_admin")
		require.Nil(t, appErr, "Should work when you not modify guest role")
	})

	t.Run("from guest to guest plus custom", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, appErr)

		_, appErr = th.App.CreateRole(&model.Role{Name: "custom", DisplayName: "custom", Description: "custom"})
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_guest custom")
		require.Nil(t, appErr, "Should work when you not modify guest role")
	})

	t.Run("a guest cant have user role", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, ruser, th.BasicChannel, false)
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, ruser.Id, "channel_guest channel_user")
		require.NotNil(t, appErr, "Should work when you not modify guest role")
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

	c1, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "test-dev-1", Name: "test-dev-1", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, appErr)

	c2, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "test-dev-2", Name: "test-dev-2", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, appErr)

	c3, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "dev-3", Name: "dev-3", Type: model.ChannelTypeOpen, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, appErr)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, c1)
		require.Nil(t, appErr)

		appErr = th.App.PermanentDeleteChannel(th.Context, c2)
		require.Nil(t, appErr)

		appErr = th.App.PermanentDeleteChannel(th.Context, c3)
		require.Nil(t, appErr)
	}()

	// add user to test-dev-1 and dev3
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, c1, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, c3, false)
	require.Nil(t, appErr)

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
		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, c2, false)
		require.Nil(t, appErr)

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

	unread, appErr := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
	require.Nil(t, appErr)
	require.Equal(t, int64(4), unread.MsgCount)
	unread, appErr = th.App.GetChannelUnread(th.Context, c1.Id, u2.Id)
	require.Nil(t, appErr)
	require.Equal(t, int64(4), unread.MsgCount)
	_, appErr = th.App.MarkChannelsAsViewed(th.Context, []string{c1.Id, pc1.Id}, u1.Id, "", false, false)
	require.Nil(t, appErr)
	_, appErr = th.App.MarkChannelsAsViewed(th.Context, []string{c1.Id, pc1.Id}, u2.Id, "", false, false)
	require.Nil(t, appErr)
	unread, appErr = th.App.GetChannelUnread(th.Context, c1.Id, u2.Id)
	require.Nil(t, appErr)
	require.Equal(t, int64(0), unread.MsgCount)

	t.Run("Unread but last one", func(t *testing.T) {
		response, appErr := th.App.MarkChannelAsUnreadFromPost(th.Context, p2.Id, u1.Id, true)
		require.Nil(t, appErr)
		require.NotNil(t, response)
		assert.Equal(t, int64(2), response.MsgCount)
		unread, appErr := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(2), unread.MsgCount)
		assert.Equal(t, p2.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread last one", func(t *testing.T) {
		response, appErr := th.App.MarkChannelAsUnreadFromPost(th.Context, p3.Id, u1.Id, true)
		require.Nil(t, appErr)
		require.NotNil(t, response)
		assert.Equal(t, int64(3), response.MsgCount)
		unread, appErr := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(1), unread.MsgCount)
		assert.Equal(t, p3.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread first one", func(t *testing.T) {
		response, appErr := th.App.MarkChannelAsUnreadFromPost(th.Context, p1.Id, u1.Id, true)
		require.Nil(t, appErr)
		require.NotNil(t, response)
		assert.Equal(t, int64(1), response.MsgCount)
		unread, appErr := th.App.GetChannelUnread(th.Context, c1.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(3), unread.MsgCount)
		assert.Equal(t, p1.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Other users are unaffected", func(t *testing.T) {
		unread, appErr := th.App.GetChannelUnread(th.Context, c1.Id, u2.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(0), unread.MsgCount)
	})

	t.Run("Unread on a private channel", func(t *testing.T) {
		response, appErr := th.App.MarkChannelAsUnreadFromPost(th.Context, pp1.Id, u1.Id, true)
		require.Nil(t, appErr)
		require.NotNil(t, response)
		assert.Equal(t, int64(0), response.MsgCount)
		unread, appErr := th.App.GetChannelUnread(th.Context, pc1.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(2), unread.MsgCount)
		assert.Equal(t, pp1.CreateAt-1, response.LastViewedAt)

		response, appErr = th.App.MarkChannelAsUnreadFromPost(th.Context, pp2.Id, u1.Id, true)
		assert.Nil(t, appErr)
		assert.Equal(t, int64(1), response.MsgCount)
		unread, appErr = th.App.GetChannelUnread(th.Context, pc1.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(1), unread.MsgCount)
		assert.Equal(t, pp2.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread with mentions", func(t *testing.T) {
		c2 := th.CreateChannel(th.Context, th.BasicTeam)
		_, appErr := th.App.AddUserToChannel(th.Context, u2, c2, false)
		require.Nil(t, appErr)

		p4, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    u2.Id,
			ChannelId: c2.Id,
			Message:   "@" + u1.Username,
		}, c2, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
		th.CreatePost(c2)

		_, appErr = th.App.CreatePost(th.Context, &model.Post{
			UserId:    u2.Id,
			ChannelId: c2.Id,
			RootId:    p4.Id,
			Message:   "@" + u1.Username,
		}, c2, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		response, appErr := th.App.MarkChannelAsUnreadFromPost(th.Context, p4.Id, u1.Id, true)
		assert.Nil(t, appErr)
		assert.Equal(t, int64(1), response.MsgCount)
		assert.Equal(t, int64(2), response.MentionCount)
		assert.Equal(t, int64(1), response.MentionCountRoot)

		unread, appErr := th.App.GetChannelUnread(th.Context, c2.Id, u1.Id)
		require.Nil(t, appErr)
		assert.Equal(t, int64(2), unread.MsgCount)
		assert.Equal(t, int64(2), unread.MentionCount)
		assert.Equal(t, int64(1), unread.MentionCountRoot)
	})

	t.Run("Unread on a DM channel", func(t *testing.T) {
		dc := th.CreateDmChannel(u2)

		dm1 := th.CreatePost(dc)
		th.CreatePost(dc)
		th.CreatePost(dc)

		_, appErr := th.App.CreatePost(th.Context, &model.Post{ChannelId: dc.Id, UserId: th.BasicUser.Id, Message: "testReply", RootId: dm1.Id}, dc, model.CreatePostFlags{})
		assert.Nil(t, appErr)

		response, appErr := th.App.MarkChannelAsUnreadFromPost(th.Context, dm1.Id, u2.Id, true)
		assert.Nil(t, appErr)
		assert.Equal(t, int64(0), response.MsgCount)
		assert.Equal(t, int64(4), response.MentionCount)
		assert.Equal(t, int64(3), response.MentionCountRoot)

		unread, appErr := th.App.GetChannelUnread(th.Context, dc.Id, u2.Id)
		require.Nil(t, appErr)
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
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, &user1)
		require.Nil(t, appErr)
	}()
	bot := th.CreateBot()
	botUser, _ := th.App.GetUser(bot.UserId)
	defer func() {
		appErr := th.App.PermanentDeleteBot(th.Context, botUser.Id)
		require.Nil(t, appErr)
	}()

	_, appErr := th.App.AddTeamMember(th.Context, th.BasicTeam.Id, ruser1.Id)
	require.Nil(t, appErr)
	_, appErr = th.App.AddTeamMember(th.Context, th.BasicTeam.Id, bot.UserId)
	require.Nil(t, appErr)

	group := th.CreateGroup()

	_, appErr = th.App.UpsertGroupMember(group.Id, user1.Id)
	require.Nil(t, appErr)

	gs, appErr := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  th.BasicChannel.Id,
		Type:        model.GroupSyncableTypeChannel,
		GroupId:     group.Id,
		SchemeAdmin: false,
	})
	require.Nil(t, appErr)

	appErr = th.App.JoinChannel(th.Context, th.BasicChannel, ruser1.Id)
	require.Nil(t, appErr)

	// verify user was added as a non-admin
	cm1, appErr := th.App.GetChannelMember(th.Context, th.BasicChannel.Id, ruser1.Id)
	require.Nil(t, appErr)
	require.False(t, cm1.SchemeAdmin)

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser2, _ := th.App.CreateUser(th.Context, &user2)
	defer func() {
		appErr = th.App.PermanentDeleteUser(th.Context, &user2)
		require.Nil(t, appErr)
	}()

	_, appErr = th.App.AddTeamMember(th.Context, th.BasicTeam.Id, ruser2.Id)
	require.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupMember(group.Id, user2.Id)
	require.Nil(t, appErr)

	gs.SchemeAdmin = true
	_, appErr = th.App.UpdateGroupSyncable(gs)
	require.Nil(t, appErr)

	appErr = th.App.JoinChannel(th.Context, th.BasicChannel, ruser2.Id)
	require.Nil(t, appErr)

	// Should allow a bot to be added to a public group synced channel
	_, appErr = th.App.AddUserToChannel(th.Context, botUser, th.BasicChannel, false)
	require.Nil(t, appErr)

	// verify user was added as an admin
	cm2, appErr := th.App.GetChannelMember(th.Context, th.BasicChannel.Id, ruser2.Id)
	require.Nil(t, appErr)
	require.True(t, cm2.SchemeAdmin)

	privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	privateChannel.GroupConstrained = model.NewPointer(true)
	_, appErr = th.App.UpdateChannel(th.Context, privateChannel)
	require.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group.Id,
		SyncableId: privateChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.Nil(t, appErr)

	// Should allow a group synced user to be added to a group synced private channel
	_, appErr = th.App.AddUserToChannel(th.Context, ruser1, privateChannel, false)
	require.Nil(t, appErr)

	// Should allow a bot to be added to a private group synced channel
	_, appErr = th.App.AddUserToChannel(th.Context, botUser, privateChannel, false)
	require.Nil(t, appErr)
}

func TestRemoveUserFromChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(th.Context, &user)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, ruser)
		require.Nil(t, appErr)
	}()

	bot := th.CreateBot()
	botUser, _ := th.App.GetUser(bot.UserId)
	defer func() {
		appErr := th.App.PermanentDeleteBot(th.Context, botUser.Id)
		require.Nil(t, appErr)
	}()

	_, appErr := th.App.AddTeamMember(th.Context, th.BasicTeam.Id, ruser.Id)
	require.Nil(t, appErr)

	_, appErr = th.App.AddTeamMember(th.Context, th.BasicTeam.Id, bot.UserId)
	require.Nil(t, appErr)

	privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

	_, appErr = th.App.AddUserToChannel(th.Context, ruser, privateChannel, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, botUser, privateChannel, false)
	require.Nil(t, appErr)

	group := th.CreateGroup()
	_, appErr = th.App.UpsertGroupMember(group.Id, ruser.Id)
	require.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group.Id,
		SyncableId: privateChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.Nil(t, appErr)

	privateChannel.GroupConstrained = model.NewPointer(true)
	_, appErr = th.App.UpdateChannel(th.Context, privateChannel)
	require.Nil(t, appErr)

	// Should not allow a group synced user to be removed from channel
	appErr = th.App.RemoveUserFromChannel(th.Context, ruser.Id, th.SystemAdminUser.Id, privateChannel)
	assert.Equal(t, appErr.Id, "api.channel.remove_members.denied")

	// Should allow a user to remove themselves from group synced channel
	appErr = th.App.RemoveUserFromChannel(th.Context, ruser.Id, ruser.Id, privateChannel)
	require.Nil(t, appErr)

	// Should allow a bot to be removed from a group synced channel
	appErr = th.App.RemoveUserFromChannel(th.Context, botUser.Id, th.SystemAdminUser.Id, privateChannel)
	require.Nil(t, appErr)
}

func TestPatchChannelModerationsForChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)
	channel := th.BasicChannel

	user := th.BasicUser
	th.AddUserToChannel(user, channel)

	createPosts := model.ChannelModeratedPermissions[0]
	createReactions := model.ChannelModeratedPermissions[1]
	manageMembers := model.ChannelModeratedPermissions[2]
	channelMentions := model.ChannelModeratedPermissions[3]
	manageBookmarks := model.ChannelModeratedPermissions[4]

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
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(false)},
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
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(true)},
				},
			},
		},
		{
			Name: "Removing create reactions from members role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(false)},
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
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(true)},
				},
			},
		},
		{
			Name: "Removing channel mentions from members role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &channelMentions,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(false)},
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
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(true)},
				},
			},
		},
		{
			Name: "Removing manage members from members role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &manageMembers,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(false)},
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
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(true)},
				},
			},
		},
		{
			Name: "Removing manage bookmarks from members role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &manageBookmarks,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{
				manageBookmarks: {
					Members: &model.ChannelModeratedRole{Value: false, Enabled: true},
				},
			},
			RevertChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &manageBookmarks,
					Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(true)},
				},
			},
		},
		{
			Name: "Removing create posts from guests role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createPosts,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewPointer(false)},
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
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewPointer(true)},
				},
			},
		},
		{
			Name: "Removing create reactions from guests role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewPointer(false)},
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
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewPointer(true)},
				},
			},
		},
		{
			Name: "Removing channel mentions from guests role",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &channelMentions,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewPointer(false)},
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
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewPointer(true)},
				},
			},
		},
		{
			Name: "Removing manage members from guests role should not error",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &manageMembers,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewPointer(false)},
				},
			},
			PermissionsModeratedByPatch: map[string]*model.ChannelModeratedRoles{},
			ShouldError:                 false,
			ShouldHaveNoChannelScheme:   true,
		},
		{
			Name: "Removing manage bookmarks from guests role should not error",
			ChannelModerationsPatch: []*model.ChannelModerationPatch{
				{
					Name:  &manageBookmarks,
					Roles: &model.ChannelModeratedRolesPatch{Guests: model.NewPointer(false)},
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
						Members: model.NewPointer(false),
						Guests:  model.NewPointer(false),
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
						Members: model.NewPointer(true),
						Guests:  model.NewPointer(false),
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
						Members: model.NewPointer(false),
						Guests:  model.NewPointer(true),
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
						Members: model.NewPointer(false),
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
						Members: model.NewPointer(true),
						Guests:  model.NewPointer(true),
					},
				},
				{
					Name: &createReactions,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewPointer(true),
						Guests:  model.NewPointer(true),
					},
				},
				{
					Name: &channelMentions,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewPointer(true),
						Guests:  model.NewPointer(true),
					},
				},
				{
					Name: &manageMembers,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewPointer(true),
					},
				},
				{
					Name: &manageBookmarks,
					Roles: &model.ChannelModeratedRolesPatch{
						Members: model.NewPointer(true),
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
					higherScopedMemberRole, appErr := th.App.GetRoleByName(context.Background(), higherScopedMemberRoleName)
					require.Nil(t, appErr)
					originalPermissions := higherScopedMemberRole.Permissions

					_, appErr = th.App.PatchRole(higherScopedMemberRole, &model.RolePatch{Permissions: &tc.HigherScopedMemberPermissions})
					require.Nil(t, appErr)
					defer func() {
						_, appErr := th.App.PatchRole(higherScopedMemberRole, &model.RolePatch{Permissions: &originalPermissions})
						require.Nil(t, appErr)
					}()
				}

				if tc.HigherScopedGuestPermissions != nil {
					higherScopedGuestRole, appErr := th.App.GetRoleByName(context.Background(), higherScopedGuestRoleName)
					require.Nil(t, appErr)
					originalPermissions := higherScopedGuestRole.Permissions

					_, appErr = th.App.PatchRole(higherScopedGuestRole, &model.RolePatch{Permissions: &tc.HigherScopedGuestPermissions})
					require.Nil(t, appErr)
					defer func() {
						_, appErr := th.App.PatchRole(higherScopedGuestRole, &model.RolePatch{Permissions: &originalPermissions})
						require.Nil(t, appErr)
					}()
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
				} else if moderation.Name == manageMembers || moderation.Name == "manage_bookmarks" {
					require.Empty(t, moderation.Roles.Guests)
				} else {
					require.Equal(t, moderation.Roles.Guests.Value, true)
					require.Equal(t, moderation.Roles.Guests.Enabled, true)
				}
			}

			if tc.RevertChannelModerationsPatch != nil {
				_, appErr := th.App.PatchChannelModerationsForChannel(th.Context, channel, tc.RevertChannelModerationsPatch)
				require.Nil(t, appErr)
			}
		})
	}

	t.Run("Handles concurrent patch requests gracefully", func(t *testing.T) {
		addCreatePosts := []*model.ChannelModerationPatch{
			{
				Name: &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{
					Members: model.NewPointer(false),
					Guests:  model.NewPointer(false),
				},
			},
		}
		removeCreatePosts := []*model.ChannelModerationPatch{
			{
				Name: &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{
					Members: model.NewPointer(false),
					Guests:  model.NewPointer(false),
				},
			},
		}

		wg := sync.WaitGroup{}
		wg.Add(20)
		for i := 0; i < 10; i++ {
			go func() {
				_, appErr := th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), addCreatePosts)
				require.Nil(t, appErr)
				_, appErr = th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), removeCreatePosts)
				require.Nil(t, appErr)
				wg.Done()
			}()
		}
		for i := 0; i < 10; i++ {
			go func() {
				_, appErr := th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), addCreatePosts)
				require.Nil(t, appErr)
				_, appErr = th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), removeCreatePosts)
				require.Nil(t, appErr)
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
					Members: model.NewPointer(true),
				},
			},
		}
		removeCreatePosts := []*model.ChannelModerationPatch{
			{
				Name: &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{
					Members: model.NewPointer(false),
				},
			},
		}

		mockSession := model.Session{UserId: user.Id}

		_, appErr := th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), addCreatePosts)
		require.Nil(t, appErr)
		require.True(t, th.App.SessionHasPermissionToChannel(th.Context, mockSession, channel.Id, model.PermissionCreatePost))

		_, appErr = th.App.PatchChannelModerationsForChannel(th.Context, channel.DeepCopy(), removeCreatePosts)
		require.Nil(t, appErr)
		require.False(t, th.App.SessionHasPermissionToChannel(th.Context, mockSession, channel.Id, model.PermissionCreatePost))
	})
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
	resp, appErr := th.App.GetMemberCountsByGroup(th.Context, "channelID", true)
	require.Nil(t, appErr)
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
	resp, appErr := th.App.GetChannelsMemberCount(th.Context, []string{"channel1", "channel2"})
	require.Nil(t, appErr)
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
	rpost1, appErr := th.App.CreatePost(th.Context, post1, c1, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	// mention the user in a reply post
	post2 := &model.Post{
		ChannelId: c1.Id,
		Message:   "reply post @" + u1.Username,
		UserId:    u2.Id,
		RootId:    rpost1.Id,
	}
	_, appErr = th.App.CreatePost(th.Context, post2, c1, model.CreatePostFlags{SetOnline: true})
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
	rootPost1, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "first root mention" + user1Mention}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "hello"}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	replyPost1, appErr := th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "mention" + user1Mention}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another reply"}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost1.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another mention" + user1Mention}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "a root post"}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	_, appErr = th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "another root mention" + user1Mention}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	t.Run("Mark reply post as unread", func(t *testing.T) {
		_, appErr := th.App.MarkChannelAsUnreadFromPost(th.Context, replyPost1.Id, th.BasicUser.Id, true)
		require.Nil(t, appErr)
		// Get channel unreads
		// Easier to reason with ChannelUnread now, than channelUnreadAt from the previous call
		channelUnread, appErr := th.App.GetChannelUnread(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		require.Equal(t, int64(3), channelUnread.MentionCount)
		//  MentionCountRoot should be zero for a user that has CRT turned off
		require.Equal(t, int64(0), channelUnread.MentionCountRoot)

		require.Equal(t, int64(5), channelUnread.MsgCount)
		//  MentionCountRoot should be zero for a user that has CRT turned off
		require.Equal(t, channelUnread.MsgCountRoot, int64(0))

		threadMembership, appErr := th.App.GetThreadMembershipForUser(th.BasicUser.Id, rootPost1.Id)
		require.Nil(t, appErr)
		thread, appErr := th.App.GetThreadForUser(threadMembership, false)
		require.Nil(t, appErr)
		require.Equal(t, int64(2), thread.UnreadMentions)
		require.Equal(t, int64(3), thread.UnreadReplies)
	})

	t.Run("Mark root post as unread", func(t *testing.T) {
		_, appErr := th.App.MarkChannelAsUnreadFromPost(th.Context, rootPost1.Id, th.BasicUser.Id, true)
		require.Nil(t, appErr)
		// Get channel unreads
		// Easier to reason with ChannelUnread now, than channelUnreadAt from the previous call
		channelUnread, appErr := th.App.GetChannelUnread(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

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
		defer func() {
			appErr := th.App.PermanentDeleteUser(th.Context, user3)
			require.Nil(t, appErr)
		}()
		rootPost, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "root post"}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		r1, appErr := th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "reply 1"}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: th.BasicUser.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "reply 2 @" + user3.Username}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		_, appErr = th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "reply 3"}, th.BasicChannel, model.CreatePostFlags{})
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

func TestGetGroupMessageMembersCommonTeams(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)

	mockChannelStore := mocks.ChannelStore{}
	mockStore.On("Channel").Return(&mockChannelStore)
	mockChannelStore.On("Get", "gm_channel_id", true).Return(&model.Channel{Type: model.ChannelTypeGroup}, nil)

	mockTeamStore := mocks.TeamStore{}
	mockStore.On("Team").Return(&mockTeamStore)

	th.App.Srv().Store().Team()

	mockTeamStore.On("GetCommonTeamIDsForMultipleUsers", []string{"user_id_1", "user_id_2"}).Return([]string{"team_id_1", "team_id_2", "team_id_3"}, nil).Times(1)
	mockTeamStore.On("GetMany", []string{"team_id_1", "team_id_2", "team_id_3"}).Return(
		[]*model.Team{
			{DisplayName: "Team 1"},
			{DisplayName: "Team 2"},
			{DisplayName: "Team 3"},
		},
		nil,
	)

	mockUserStore := mocks.UserStore{}
	mockStore.On("User").Return(&mockUserStore)
	options := &model.UserGetOptions{
		PerPage:     model.ChannelGroupMaxUsers,
		Page:        0,
		InChannelId: "gm_channel_id",
		Inactive:    false,
		Active:      true,
	}
	mockUserStore.On("GetProfilesInChannel", options).Return([]*model.User{
		{
			Id: "user_id_1",
		},
		{
			Id: "user_id_2",
		},
	}, nil)

	var err error
	th.App.ch.srv.teamService, err = teams.New(teams.ServiceConfig{
		TeamStore:    &mockTeamStore,
		ChannelStore: &mockChannelStore,
		GroupStore:   &mocks.GroupStore{},
		Users:        th.App.ch.srv.userService,
		WebHub:       th.App.ch.srv.platform,
		ConfigFn:     th.App.ch.srv.platform.Config,
		LicenseFn:    th.App.ch.srv.License,
	})
	require.NoError(t, err)

	commonTeams, appErr := th.App.GetGroupMessageMembersCommonTeams(th.Context, "gm_channel_id")
	require.Nil(t, appErr)
	require.Equal(t, 3, len(commonTeams))

	// case of no common teams
	mockTeamStore.On("GetCommonTeamIDsForMultipleUsers", []string{"user_id_1", "user_id_2"}).Return([]string{}, nil)
	commonTeams, appErr = th.App.GetGroupMessageMembersCommonTeams(th.Context, "gm_channel_id")
	require.Nil(t, appErr)
	require.Equal(t, 0, len(commonTeams))
}

func TestConvertGroupMessageToChannel(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)

	mockChannelStore := mocks.ChannelStore{}
	mockStore.On("Channel").Return(&mockChannelStore)
	mockChannelStore.On("Get", "channelidchannelidchanneli", true).Return(&model.Channel{
		Id:       "channelidchannelidchanneli",
		CreateAt: time.Now().Unix(),
		UpdateAt: time.Now().Unix(),
		Type:     model.ChannelTypeGroup,
	}, nil)
	mockChannelStore.On("Update", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.Channel")).Return(&model.Channel{}, nil)
	mockChannelStore.On("InvalidateChannel", "channelidchannelidchanneli")
	mockChannelStore.On("InvalidateChannelByName", "team_id_1", "new_name").Times(1)
	mockChannelStore.On("InvalidateChannelByName", "dm", "")
	mockChannelStore.On("GetMember", sqlstore.WithMaster(context.Background()), "channelidchannelidchanneli", "user_id_1").Return(&model.ChannelMember{}, nil).Times(1)
	mockChannelStore.On("GetMember", context.Background(), "channelidchannelidchanneli", "user_id_1").Return(&model.ChannelMember{}, nil).Times(2)
	mockChannelStore.On("UpdateMember", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.ChannelMember")).Return(&model.ChannelMember{UserId: "user_id_1"}, nil)
	mockChannelStore.On("InvalidateAllChannelMembersForUser", "user_id_1").Return()
	mockChannelStore.On("InvalidatePinnedPostCount", "channelidchannelidchanneli")
	mockChannelStore.On("GetAllChannelMembersNotifyPropsForChannel", "channelidchannelidchanneli", true).Return(map[string]model.StringMap{}, nil)
	mockChannelStore.On("IncrementMentionCount", "", []string{}, true, false).Return(nil)
	mockChannelStore.On("DeleteAllSidebarChannelForChannel", "channelidchannelidchanneli").Return(nil)
	mockChannelStore.On("GetSidebarCategories", "user_id_1", &store.SidebarCategorySearchOpts{TeamID: "team_id_1", ExcludeTeam: false, Type: "channels"}).Return(
		&model.OrderedSidebarCategories{
			Categories: model.SidebarCategoriesWithChannels{
				{
					SidebarCategory: model.SidebarCategory{
						Type: model.SidebarCategoryChannels,
					},
				},
			},
		}, nil)
	mockChannelStore.On("GetSidebarCategories", "user_id_2", &store.SidebarCategorySearchOpts{TeamID: "team_id_1", ExcludeTeam: false, Type: "channels"}).Return(
		&model.OrderedSidebarCategories{
			Categories: model.SidebarCategoriesWithChannels{
				{
					SidebarCategory: model.SidebarCategory{
						Type: model.SidebarCategoryChannels,
					},
				},
			},
		}, nil)
	mockChannelStore.On("UpdateSidebarCategories", "user_id_1", "team_id_1", mock.Anything).Return(
		[]*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Type: model.SidebarCategoryChannels,
				},
			},
		},
		[]*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Type: model.SidebarCategoryChannels,
				},
			},
		},
		nil,
	)
	mockChannelStore.On("UpdateSidebarCategories", "user_id_2", "team_id_1", mock.Anything).Return(
		[]*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Type: model.SidebarCategoryChannels,
				},
			},
		},
		[]*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Type: model.SidebarCategoryChannels,
				},
			},
		},
		nil,
	)

	mockTeamStore := mocks.TeamStore{}
	mockStore.On("Team").Return(&mockTeamStore)
	mockTeamStore.On("GetMember", sqlstore.WithMaster(context.Background()), "team_id_1", "user_id_1").Return(&model.TeamMember{}, nil)
	mockTeamStore.On("GetCommonTeamIDsForMultipleUsers", []string{"user_id_1", "user_id_2"}).Return([]string{"team_id_1", "team_id_2", "team_id_3"}, nil).Times(1)
	mockTeamStore.On("GetMany", []string{"team_id_1", "team_id_2", "team_id_3"}).Return(
		[]*model.Team{
			{Id: "team_id_1", DisplayName: "Team 1"},
			{Id: "team_id_2", DisplayName: "Team 2"},
			{Id: "team_id_3", DisplayName: "Team 3"},
		},
		nil,
	)

	mockUserStore := mocks.UserStore{}
	mockStore.On("User").Return(&mockUserStore)
	mockUserStore.On("Get", context.Background(), "user_id_1").Return(&model.User{Username: "username_1"}, nil)
	mockUserStore.On("GetProfilesInChannel", mock.AnythingOfType("*model.UserGetOptions")).Return([]*model.User{
		{Id: "user_id_1", Username: "user_id_1"},
		{Id: "user_id_2", Username: "user_id_2"},
	}, nil)
	mockUserStore.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(map[string]*model.User{}, nil)
	mockUserStore.On("InvalidateProfilesInChannelCacheByUser", "user_id_1").Return()
	mockUserStore.On("InvalidateProfileCacheForUser", "user_id_1").Return()

	mockPostStore := mocks.PostStore{}
	mockStore.On("Post").Return(&mockPostStore)
	mockPostStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.Post")).Return(&model.Post{}, nil)
	mockPostStore.On("InvalidateLastPostTimeCache", "channelidchannelidchanneli")

	mockSystemStore := mocks.SystemStore{}
	mockStore.On("System").Return(&mockSystemStore)
	mockSystemStore.On("GetByName", model.MigrationKeyAdvancedPermissionsPhase2).Return(nil, nil)

	var err error

	th.App.ch.srv.userService, err = users.New(users.ServiceConfig{
		UserStore:    &mockUserStore,
		ConfigFn:     th.App.ch.srv.platform.Config,
		SessionStore: &mocks.SessionStore{},
		OAuthStore:   &mocks.OAuthStore{},
		LicenseFn:    th.App.ch.srv.License,
	})
	require.NoError(t, err)

	th.App.ch.srv.teamService, err = teams.New(teams.ServiceConfig{
		TeamStore:    &mockTeamStore,
		ChannelStore: &mockChannelStore,
		GroupStore:   &mocks.GroupStore{},
		Users:        th.App.ch.srv.userService,
		WebHub:       th.App.ch.srv.platform,
		ConfigFn:     th.App.ch.srv.platform.Config,
		LicenseFn:    th.App.ch.srv.License,
	})
	require.NoError(t, err)

	conversionRequest := &model.GroupMessageConversionRequestBody{
		ChannelID:   "channelidchannelidchanneli",
		TeamID:      "team_id_1",
		Name:        "new_name",
		DisplayName: "New Display Name",
	}

	convertedChannel, appErr := th.App.ConvertGroupMessageToChannel(th.Context, "user_id_1", conversionRequest)
	require.Nil(t, appErr)
	require.Equal(t, model.ChannelTypePrivate, convertedChannel.Type)
}

func TestPatchChannelMembersNotifyProps(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should update multiple users' notify props", func(t *testing.T) {
		user1 := th.CreateUser()
		user2 := th.CreateUser()

		channel1 := th.CreateChannel(th.Context, th.BasicTeam)
		channel2 := th.CreateChannel(th.Context, th.BasicTeam)

		th.LinkUserToTeam(user1, th.BasicTeam)
		th.LinkUserToTeam(user2, th.BasicTeam)
		th.AddUserToChannel(user1, channel1)
		th.AddUserToChannel(user1, channel2)
		th.AddUserToChannel(user2, channel1)
		th.AddUserToChannel(user2, channel2)

		result, appErr := th.App.PatchChannelMembersNotifyProps(th.Context, []*model.ChannelMemberIdentifier{
			{UserId: user1.Id, ChannelId: channel1.Id},
			{UserId: user1.Id, ChannelId: channel2.Id},
			{UserId: user2.Id, ChannelId: channel1.Id},
		}, map[string]string{
			model.DesktopNotifyProp: model.ChannelNotifyNone,
			"custom_key":            "custom_value",
		})

		require.Nil(t, appErr)

		// Confirm specified fields were updated
		assert.Equal(t, model.ChannelNotifyNone, result[0].NotifyProps[model.DesktopNotifyProp])
		assert.Equal(t, "custom_value", result[0].NotifyProps["custom_key"])
		assert.Equal(t, model.ChannelNotifyNone, result[1].NotifyProps[model.DesktopNotifyProp])
		assert.Equal(t, "custom_value", result[1].NotifyProps["custom_key"])
		assert.Equal(t, model.ChannelNotifyNone, result[2].NotifyProps[model.DesktopNotifyProp])
		assert.Equal(t, "custom_value", result[2].NotifyProps["custom_key"])

		// Confirm unspecified fields were unchanged
		assert.Equal(t, model.ChannelNotifyDefault, result[0].NotifyProps[model.PushNotifyProp])
		assert.Equal(t, model.ChannelNotifyDefault, result[1].NotifyProps[model.PushNotifyProp])
		assert.Equal(t, model.ChannelNotifyDefault, result[2].NotifyProps[model.PushNotifyProp])

		// Confirm other members were unchanged
		otherMember, appErr := th.App.GetChannelMember(th.Context, channel2.Id, user2.Id)

		require.Nil(t, appErr)

		assert.Equal(t, model.ChannelNotifyDefault, otherMember.NotifyProps[model.DesktopNotifyProp])
		assert.Equal(t, "", otherMember.NotifyProps["custom_key"])
		assert.Equal(t, model.ChannelNotifyDefault, otherMember.NotifyProps[model.PushNotifyProp])
	})

	t.Run("should send WS events for each user", func(t *testing.T) {
		user1 := th.CreateUser()
		user2 := th.CreateUser()

		channel1 := th.CreateChannel(th.Context, th.BasicTeam)
		channel2 := th.CreateChannel(th.Context, th.BasicTeam)

		th.LinkUserToTeam(user1, th.BasicTeam)
		th.LinkUserToTeam(user2, th.BasicTeam)
		th.AddUserToChannel(user1, channel1)
		th.AddUserToChannel(user1, channel2)
		th.AddUserToChannel(user2, channel1)

		eventTypesFilter := []model.WebsocketEventType{model.WebsocketEventChannelMemberUpdated}

		messages1, closeWS1 := connectFakeWebSocket(t, th, user1.Id, "", eventTypesFilter)
		defer closeWS1()
		messages2, closeWS2 := connectFakeWebSocket(t, th, user2.Id, "", eventTypesFilter)
		defer closeWS2()

		_, appErr := th.App.PatchChannelMembersNotifyProps(th.Context, []*model.ChannelMemberIdentifier{
			{UserId: user1.Id, ChannelId: channel1.Id},
			{UserId: user1.Id, ChannelId: channel2.Id},
			{UserId: user2.Id, ChannelId: channel1.Id},
		}, map[string]string{
			model.DesktopNotifyProp: model.ChannelNotifyNone,
			"custom_key":            "custom_value",
		})

		require.Nil(t, appErr)

		// User1, Channel1
		received := <-messages1
		assert.Equal(t, model.WebsocketEventChannelMemberUpdated, received.EventType())

		member := decodeJSON(received.GetData()["channelMember"], &model.ChannelMember{})
		assert.Equal(t, user1.Id, member.UserId)
		assert.Contains(t, []string{channel1.Id, channel2.Id}, member.ChannelId)
		assert.Equal(t, model.ChannelNotifyNone, member.NotifyProps[model.DesktopNotifyProp])
		assert.Equal(t, "custom_value", member.NotifyProps["custom_key"])
		assert.Equal(t, model.ChannelNotifyDefault, member.NotifyProps[model.PushNotifyProp])

		// User1, Channel2
		received = <-messages1
		assert.Equal(t, model.WebsocketEventChannelMemberUpdated, received.EventType())

		member = decodeJSON(received.GetData()["channelMember"], &model.ChannelMember{})
		assert.Equal(t, user1.Id, member.UserId)
		assert.Contains(t, []string{channel1.Id, channel2.Id}, member.ChannelId)
		assert.Equal(t, model.ChannelNotifyNone, member.NotifyProps[model.DesktopNotifyProp])
		assert.Equal(t, "custom_value", member.NotifyProps["custom_key"])
		assert.Equal(t, model.ChannelNotifyDefault, member.NotifyProps[model.PushNotifyProp])

		// User2, Channel1
		received = <-messages2
		assert.Equal(t, model.WebsocketEventChannelMemberUpdated, received.EventType())

		member = decodeJSON(received.GetData()["channelMember"], &model.ChannelMember{})
		assert.Equal(t, user2.Id, member.UserId)
		assert.Equal(t, channel1.Id, member.ChannelId)
		assert.Equal(t, model.ChannelNotifyNone, member.NotifyProps[model.DesktopNotifyProp])
		assert.Equal(t, "custom_value", member.NotifyProps["custom_key"])
		assert.Equal(t, model.ChannelNotifyDefault, member.NotifyProps[model.PushNotifyProp])
	})

	t.Run("should return an error when trying to update too many users at once", func(t *testing.T) {
		identifiers := make([]*model.ChannelMemberIdentifier, 201)
		for i := 0; i < len(identifiers); i++ {
			identifiers[i] = &model.ChannelMemberIdentifier{UserId: "fakeuser", ChannelId: "fakechannel"}
		}

		_, appErr := th.App.PatchChannelMembersNotifyProps(th.Context, identifiers, map[string]string{})

		assert.NotNil(t, appErr)
	})
}
