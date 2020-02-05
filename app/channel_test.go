// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestPermanentDeleteChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableIncomingWebhooks = true
		*cfg.ServiceSettings.EnableOutgoingWebhooks = true
	})

	channel, err := th.App.CreateChannel(&model.Channel{DisplayName: "deletion-test", Name: "deletion-test", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	require.NotNil(t, channel, "Channel shouldn't be nil")
	require.Nil(t, err)
	defer func() {
		th.App.PermanentDeleteChannel(channel)
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

	err = th.App.PermanentDeleteChannel(channel)
	require.Nil(t, err)

	incoming, err = th.App.GetIncomingWebhook(incoming.Id)
	require.Nil(t, incoming, "Incoming webhook should be nil")
	require.NotNil(t, err, "Incoming webhook wasn't deleted")

	outgoing, err = th.App.GetOutgoingWebhook(outgoing.Id)
	require.Nil(t, outgoing, "Outgoing webhook should be nil")
	require.NotNil(t, err, "Outgoing webhook wasn't deleted")
}

func TestMoveChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	var err *model.AppError

	sourceTeam := th.CreateTeam()
	targetTeam := th.CreateTeam()
	channel1 := th.CreateChannel(sourceTeam)
	defer func() {
		th.App.PermanentDeleteChannel(channel1)
		th.App.PermanentDeleteTeam(sourceTeam)
		th.App.PermanentDeleteTeam(targetTeam)
	}()

	_, err = th.App.AddUserToTeam(sourceTeam.Id, th.BasicUser.Id, "")
	require.Nil(t, err)

	_, err = th.App.AddUserToTeam(sourceTeam.Id, th.BasicUser2.Id, "")
	require.Nil(t, err)

	_, err = th.App.AddUserToTeam(targetTeam.Id, th.BasicUser.Id, "")
	require.Nil(t, err)

	_, err = th.App.AddUserToChannel(th.BasicUser, channel1)
	require.Nil(t, err)

	_, err = th.App.AddUserToChannel(th.BasicUser2, channel1)
	require.Nil(t, err)

	err = th.App.MoveChannel(targetTeam, channel1, th.BasicUser, false)
	require.NotNil(t, err, "Should have failed due to mismatched members.")

	_, err = th.App.AddUserToTeam(targetTeam.Id, th.BasicUser2.Id, "")
	require.Nil(t, err)

	err = th.App.MoveChannel(targetTeam, channel1, th.BasicUser, false)
	require.Nil(t, err)

	// Test moving a channel with a deactivated user who isn't in the destination team.
	// It should fail, unless removeDeactivatedMembers is true.
	deacivatedUser := th.CreateUser()
	channel2 := th.CreateChannel(sourceTeam)

	_, err = th.App.AddUserToTeam(sourceTeam.Id, deacivatedUser.Id, "")
	require.Nil(t, err)
	_, err = th.App.AddUserToChannel(th.BasicUser, channel2)
	require.Nil(t, err)

	_, err = th.App.AddUserToChannel(deacivatedUser, channel2)
	require.Nil(t, err)

	_, err = th.App.UpdateActive(deacivatedUser, false)
	require.Nil(t, err)

	err = th.App.MoveChannel(targetTeam, channel2, th.BasicUser, false)
	require.NotNil(t, err, "Should have failed due to mismatched deacivated member.")

	err = th.App.MoveChannel(targetTeam, channel2, th.BasicUser, true)
	require.Nil(t, err)

	// Test moving a channel with no members.
	channel3 := &model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.CHANNEL_OPEN,
		TeamId:      sourceTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}

	channel3, err = th.App.CreateChannel(channel3, false)
	require.Nil(t, err)

	err = th.App.MoveChannel(targetTeam, channel3, th.BasicUser, false)
	assert.Nil(t, err)
}

func TestJoinDefaultChannelsCreatesChannelMemberHistoryRecordTownSquare(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// figure out the initial number of users in town square
	channel, err := th.App.Srv.Store.Channel().GetByName(th.BasicTeam.Id, "town-square", true)
	require.Nil(t, err)
	townSquareChannelId := channel.Id
	users, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, townSquareChannelId)
	require.Nil(t, err)
	initialNumTownSquareUsers := len(users)

	// create a new user that joins the default channels
	user := th.CreateUser()
	th.App.JoinDefaultChannels(th.BasicTeam.Id, user, false, "")

	// there should be a ChannelMemberHistory record for the user
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, townSquareChannelId)
	require.Nil(t, err)
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
	channel, err := th.App.Srv.Store.Channel().GetByName(th.BasicTeam.Id, "off-topic", true)
	require.Nil(t, err)
	offTopicChannelId := channel.Id
	users, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, offTopicChannelId)
	require.Nil(t, err)
	initialNumTownSquareUsers := len(users)

	// create a new user that joins the default channels
	user := th.CreateUser()
	th.App.JoinDefaultChannels(th.BasicTeam.Id, user, false, "")

	// there should be a ChannelMemberHistory record for the user
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, offTopicChannelId)
	require.Nil(t, err)
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

	basicChannel2 := th.CreateChannel(th.BasicTeam)
	defaultChannelList := []string{th.BasicChannel.Name, basicChannel2.Name, basicChannel2.Name}
	th.App.Config().TeamSettings.ExperimentalDefaultChannels = defaultChannelList

	user := th.CreateUser()
	th.App.JoinDefaultChannels(th.BasicTeam.Id, user, false, "")

	for _, channelName := range defaultChannelList {
		channel, err := th.App.GetChannelByName(channelName, th.BasicTeam.Id, false)
		require.Nil(t, err, "Expected nil, didn't receive nil")

		member, err := th.App.GetChannelMember(channel.Id, user.Id)

		require.NotNil(t, member, "Expected member object, got nil")
		require.Nil(t, err, "Expected nil object, didn't receive nil")
	}
}

func TestCreateChannelPublicCreatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// creates a public channel and adds basic user to it
	publicChannel := th.createChannel(th.BasicTeam, model.CHANNEL_OPEN)

	// there should be a ChannelMemberHistory record for the user
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, publicChannel.Id)
	require.Nil(t, err)
	assert.Len(t, histories, 1)
	assert.Equal(t, th.BasicUser.Id, histories[0].UserId)
	assert.Equal(t, publicChannel.Id, histories[0].ChannelId)
}

func TestCreateChannelPrivateCreatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// creates a private channel and adds basic user to it
	privateChannel := th.createChannel(th.BasicTeam, model.CHANNEL_PRIVATE)

	// there should be a ChannelMemberHistory record for the user
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, privateChannel.Id)
	require.Nil(t, err)
	assert.Len(t, histories, 1)
	assert.Equal(t, th.BasicUser.Id, histories[0].UserId)
	assert.Equal(t, privateChannel.Id, histories[0].ChannelId)
}
func TestCreateChannelDisplayNameTrimsWhitespace(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel, err := th.App.CreateChannel(&model.Channel{DisplayName: "  Public 1  ", Name: "public1", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)
	require.Equal(t, channel.DisplayName, "Public 1")
}

func TestUpdateChannelPrivacy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	privateChannel := th.createChannel(th.BasicTeam, model.CHANNEL_PRIVATE)
	privateChannel.Type = model.CHANNEL_OPEN

	publicChannel, err := th.App.UpdateChannelPrivacy(privateChannel, th.BasicUser)
	require.Nil(t, err, "Failed to update channel privacy.")
	assert.Equal(t, publicChannel.Id, privateChannel.Id)
	assert.Equal(t, publicChannel.Type, model.CHANNEL_OPEN)
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

	channel, err := th.App.CreateGroupChannel(groupUserIds, th.BasicUser.Id)

	require.Nil(t, err, "Failed to create group channel.")
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.Nil(t, err)
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := th.CreateUser()
	user2 := th.CreateUser()

	channel, err := th.App.GetOrCreateDirectChannel(user1.Id, user2.Id)
	require.Nil(t, err, "Failed to create direct channel.")

	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.Nil(t, err)
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := th.CreateUser()
	user2 := th.CreateUser()

	// this function call implicitly creates a direct channel between the two users if one doesn't already exist
	channel, err := th.App.GetOrCreateDirectChannel(user1.Id, user2.Id)
	require.Nil(t, err, "Failed to create direct channel.")

	// there should be a ChannelMemberHistory record for both users
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.Nil(t, err)
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create a user and add it to a channel
	user := th.CreateUser()
	_, err := th.App.AddTeamMember(th.BasicTeam.Id, user.Id)
	require.Nil(t, err, "Failed to add user to team.")

	groupUserIds := make([]string, 0)
	groupUserIds = append(groupUserIds, th.BasicUser.Id)
	groupUserIds = append(groupUserIds, user.Id)

	channel := th.createChannel(th.BasicTeam, model.CHANNEL_OPEN)

	_, err = th.App.AddUserToChannel(user, channel)
	require.Nil(t, err, "Failed to add user to channel.")

	// there should be a ChannelMemberHistory record for the user
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.Nil(t, err)
	assert.Len(t, histories, 2)
	channelMemberHistoryUserIds := make([]string, 0)
	for _, history := range histories {
		assert.Equal(t, channel.Id, history.ChannelId)
		channelMemberHistoryUserIds = append(channelMemberHistoryUserIds, history.UserId)
	}
	assert.Equal(t, groupUserIds, channelMemberHistoryUserIds)
}

/*func TestRemoveUserFromChannelUpdatesChannelMemberHistoryRecord(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// a user creates a channel
	publicChannel := th.createChannel(th.BasicTeam, model.CHANNEL_OPEN)
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, publicChannel.Id)
	require.Nil(t, err)
	assert.Len(t, histories, 1)
	assert.Equal(t, th.BasicUser.Id, histories[0].UserId)
	assert.Equal(t, publicChannel.Id, histories[0].ChannelId)
	assert.Nil(t, histories[0].LeaveTime)

	// the user leaves that channel
	if err := th.App.LeaveChannel(publicChannel.Id, th.BasicUser.Id); err != nil {
		t.Fatal("Failed to remove user from channel. Error: " + err.Message)
	}
	histories = store.Must(th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, publicChannel.Id)).([]*model.ChannelMemberHistoryResult)
	assert.Len(t, histories, 1)
	assert.Equal(t, th.BasicUser.Id, histories[0].UserId)
	assert.Equal(t, publicChannel.Id, histories[0].ChannelId)
	assert.NotNil(t, histories[0].LeaveTime)
}*/

func TestLeaveDefaultChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	guest := th.CreateGuest()
	th.LinkUserToTeam(guest, th.BasicTeam)

	townSquare, err := th.App.GetChannelByName("town-square", th.BasicTeam.Id, false)
	require.Nil(t, err)
	th.AddUserToChannel(guest, townSquare)
	th.AddUserToChannel(th.BasicUser, townSquare)

	t.Run("User tries to leave the default channel", func(t *testing.T) {
		err = th.App.LeaveChannel(townSquare.Id, th.BasicUser.Id)
		assert.NotNil(t, err, "It should fail to remove a regular user from the default channel")
		assert.Equal(t, err.Id, "api.channel.remove.default.app_error")
		_, err = th.App.GetChannelMember(townSquare.Id, th.BasicUser.Id)
		assert.Nil(t, err)
	})

	t.Run("Guest leaves the default channel", func(t *testing.T) {
		err = th.App.LeaveChannel(townSquare.Id, guest.Id)
		assert.Nil(t, err, "It should allow to remove a guest user from the default channel")
		_, err = th.App.GetChannelMember(townSquare.Id, guest.Id)
		assert.NotNil(t, err)
	})
}

func TestLeaveLastChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	guest := th.CreateGuest()
	th.LinkUserToTeam(guest, th.BasicTeam)

	townSquare, err := th.App.GetChannelByName("town-square", th.BasicTeam.Id, false)
	require.Nil(t, err)
	th.AddUserToChannel(guest, townSquare)
	th.AddUserToChannel(guest, th.BasicChannel)

	t.Run("Guest leaves not last channel", func(t *testing.T) {
		err = th.App.LeaveChannel(townSquare.Id, guest.Id)
		require.Nil(t, err)
		_, err = th.App.GetTeamMember(th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err, "It should maintain the team membership")
	})

	t.Run("Guest leaves last channel", func(t *testing.T) {
		err = th.App.LeaveChannel(th.BasicChannel.Id, guest.Id)
		assert.Nil(t, err, "It should allow to remove a guest user from the default channel")
		_, err = th.App.GetChannelMember(th.BasicChannel.Id, guest.Id)
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
	if _, err := th.App.AddTeamMember(th.BasicTeam.Id, user.Id); err != nil {
		t.Fatal("Failed to add user to team. Error: " + err.Message)
	}

	groupUserIds := make([]string, 0)
	groupUserIds = append(groupUserIds, th.BasicUser.Id)
	groupUserIds = append(groupUserIds, user.Id)

	channel := th.createChannel(th.BasicTeam, model.CHANNEL_OPEN)
	userRequestorId := ""
	postRootId := ""
	_, err := th.App.AddChannelMember(user.Id, channel, userRequestorId, postRootId)
	require.Nil(t, err, "Failed to add user to channel.")

	// there should be a ChannelMemberHistory record for the user
	histories, err := th.App.Srv.Store.ChannelMemberHistory().GetUsersInChannelDuring(model.GetMillis()-100, model.GetMillis()+100, channel.Id)
	require.Nil(t, err)
	assert.Len(t, histories, 2)
	channelMemberHistoryUserIds := make([]string, 0)
	for _, history := range histories {
		assert.Equal(t, channel.Id, history.ChannelId)
		channelMemberHistoryUserIds = append(channelMemberHistoryUserIds, history.UserId)
	}
	assert.Equal(t, groupUserIds, channelMemberHistoryUserIds)

	postList, err := th.App.Srv.Store.Post().GetPosts(model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 1}, false)
	require.Nil(t, err)

	if assert.Len(t, postList.Order, 1) {
		post := postList.Posts[postList.Order[0]]

		assert.Equal(t, model.POST_JOIN_CHANNEL, post.Type)
		assert.Equal(t, user.Id, post.UserId)
		assert.Equal(t, user.Username, post.Props["username"])
	}
}

func TestAppUpdateChannelScheme(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	mockID := model.NewString("x")
	channel.SchemeId = mockID

	updatedChannel, err := th.App.UpdateChannelScheme(channel)
	require.Nil(t, err)

	if updatedChannel.SchemeId != mockID {
		require.Fail(t, "Wrong Channel SchemeId")
	}
}

func TestFillInChannelProps(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channelPublic1, err := th.App.CreateChannel(&model.Channel{DisplayName: "Public 1", Name: "public1", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(channelPublic1)

	channelPublic2, err := th.App.CreateChannel(&model.Channel{DisplayName: "Public 2", Name: "public2", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(channelPublic2)

	channelPrivate, err := th.App.CreateChannel(&model.Channel{DisplayName: "Private", Name: "private", Type: model.CHANNEL_PRIVATE, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(channelPrivate)

	otherTeamId := model.NewId()
	otherTeam := &model.Team{
		DisplayName: "dn_" + otherTeamId,
		Name:        "name" + otherTeamId,
		Email:       "success+" + otherTeamId + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}
	otherTeam, err = th.App.CreateTeam(otherTeam)
	require.Nil(t, err)
	defer th.App.PermanentDeleteTeam(otherTeam)

	channelOtherTeam, err := th.App.CreateChannel(&model.Channel{DisplayName: "Other Team Channel", Name: "other-team", Type: model.CHANNEL_OPEN, TeamId: otherTeam.Id}, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteChannel(channelOtherTeam)

	// Note that purpose is intentionally plaintext below.

	t.Run("single channels", func(t *testing.T) {
		testCases := []struct {
			Description          string
			Channel              *model.Channel
			ExpectedChannelProps map[string]interface{}
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
				map[string]interface{}{
					"channel_mentions": map[string]interface{}{
						"public1": map[string]interface{}{
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
				map[string]interface{}{
					"channel_mentions": map[string]interface{}{
						"other-team": map[string]interface{}{
							"display_name": "Other Team Channel",
						},
					},
				},
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				err = th.App.FillInChannelProps(testCase.Channel)
				require.Nil(t, err)

				assert.Equal(t, testCase.ExpectedChannelProps, testCase.Channel.Props)
			})
		}
	})

	t.Run("multiple channels", func(t *testing.T) {
		testCases := []struct {
			Description          string
			Channels             *model.ChannelList
			ExpectedChannelProps map[string]interface{}
		}{
			{
				"single channel on basic team",
				&model.ChannelList{
					{
						Name:    "test",
						TeamId:  th.BasicTeam.Id,
						Header:  "~public1, ~private, ~other-team",
						Purpose: "~public2, ~private, ~other-team",
					},
				},
				map[string]interface{}{
					"test": map[string]interface{}{
						"channel_mentions": map[string]interface{}{
							"public1": map[string]interface{}{
								"display_name": "Public 1",
							},
						},
					},
				},
			},
			{
				"multiple channels on basic team",
				&model.ChannelList{
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
				map[string]interface{}{
					"test": map[string]interface{}{
						"channel_mentions": map[string]interface{}{
							"public1": map[string]interface{}{
								"display_name": "Public 1",
							},
						},
					},
					"test2": map[string]interface{}(nil),
					"test3": map[string]interface{}(nil),
				},
			},
			{
				"multiple channels across teams",
				&model.ChannelList{
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
				map[string]interface{}{
					"test": map[string]interface{}{
						"channel_mentions": map[string]interface{}{
							"public1": map[string]interface{}{
								"display_name": "Public 1",
							},
						},
					},
					"test2": map[string]interface{}{
						"channel_mentions": map[string]interface{}{
							"other-team": map[string]interface{}{
								"display_name": "Other Team Channel",
							},
						},
					},
					"test3": map[string]interface{}(nil),
				},
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				err = th.App.FillInChannelsProps(testCase.Channels)
				require.Nil(t, err)

				for _, channel := range *testCase.Channels {
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
			th.createChannel(th.BasicTeam, model.CHANNEL_OPEN),
			false,
			"newchannelname",
			"newchannelname",
			"New Display Name",
		},
		{
			"Fail on rename open channel with bad name",
			th.createChannel(th.BasicTeam, model.CHANNEL_OPEN),
			true,
			"6zii9a9g6pruzj451x3esok54h__wr4j4g8zqtnhmkw771pfpynqwo",
			"",
			"",
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
			th.CreateGroupChannel(th.BasicUser2, th.CreateUser()),
			true,
			"newchannelname",
			"",
			"",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			channel, err := th.App.RenameChannel(tc.Channel, tc.ChannelName, "New Display Name")
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

	userRequestorId := ""
	postRootId := ""
	_, err := th.App.AddChannelMember(th.BasicUser2.Id, th.BasicChannel, userRequestorId, postRootId)
	require.Nil(t, err, "Failed to add user to channel.")

	user := th.BasicUser
	user.Timezone["useAutomaticTimezone"] = "false"
	user.Timezone["manualTimezone"] = "XOXO/BLABLA"
	th.App.UpdateUser(user, false)

	user2 := th.BasicUser2
	user2.Timezone["automaticTimezone"] = "NoWhere/Island"
	th.App.UpdateUser(user2, false)

	user3 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user3)
	th.App.AddUserToChannel(ruser, th.BasicChannel)

	ruser.Timezone["automaticTimezone"] = "NoWhere/Island"
	th.App.UpdateUser(ruser, false)

	user4 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ = th.App.CreateUser(&user4)
	th.App.AddUserToChannel(ruser, th.BasicChannel)

	timezones, err := th.App.GetChannelMembersTimezones(th.BasicChannel.Id)
	require.Nil(t, err, "Failed to get the timezones for a channel.")

	assert.Equal(t, 2, len(timezones))
}

func TestGetPublicChannelsForTeam(t *testing.T) {
	th := Setup(t)
	team := th.CreateTeam()
	defer th.TearDown()

	var expectedChannels []*model.Channel

	townSquare, err := th.App.GetChannelByName("town-square", team.Id, false)
	require.Nil(t, err)
	require.NotNil(t, townSquare)
	expectedChannels = append(expectedChannels, townSquare)

	offTopic, err := th.App.GetChannelByName("off-topic", team.Id, false)
	require.Nil(t, err)
	require.NotNil(t, offTopic)
	expectedChannels = append(expectedChannels, offTopic)

	for i := 0; i < 8; i++ {
		channel := model.Channel{
			DisplayName: fmt.Sprintf("Public %v", i),
			Name:        fmt.Sprintf("public_%v", i),
			Type:        model.CHANNEL_OPEN,
			TeamId:      team.Id,
		}
		var rchannel *model.Channel
		rchannel, err = th.App.CreateChannel(&channel, false)
		require.Nil(t, err)
		require.NotNil(t, rchannel)
		defer th.App.PermanentDeleteChannel(rchannel)

		// Store the user ids for comparison later
		expectedChannels = append(expectedChannels, rchannel)
	}

	// Fetch public channels multipile times
	channelList, err := th.App.GetPublicChannelsForTeam(team.Id, 0, 5)
	require.Nil(t, err)
	channelList2, err := th.App.GetPublicChannelsForTeam(team.Id, 5, 5)
	require.Nil(t, err)

	channels := append(*channelList, *channelList2...)
	assert.ElementsMatch(t, expectedChannels, channels)
}

func TestUpdateChannelMemberRolesChangingGuest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("from guest to user", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(ruser, th.BasicChannel)
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.BasicChannel.Id, ruser.Id, "channel_user")
		require.NotNil(t, err, "Should fail when try to modify the guest role")
	})

	t.Run("from user to guest", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(ruser, th.BasicChannel)
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.BasicChannel.Id, ruser.Id, "channel_guest")
		require.NotNil(t, err, "Should fail when try to modify the guest role")
	})

	t.Run("from user to admin", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(ruser, th.BasicChannel)
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.BasicChannel.Id, ruser.Id, "channel_user channel_admin")
		require.Nil(t, err, "Should work when you not modify guest role")
	})

	t.Run("from guest to guest plus custom", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(ruser, th.BasicChannel)
		require.Nil(t, err)

		_, err = th.App.CreateRole(&model.Role{Name: "custom", DisplayName: "custom", Description: "custom"})
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.BasicChannel.Id, ruser.Id, "channel_guest custom")
		require.Nil(t, err, "Should work when you not modify guest role")
	})

	t.Run("a guest cant have user role", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(ruser, th.BasicChannel)
		require.Nil(t, err)

		_, err = th.App.UpdateChannelMemberRoles(th.BasicChannel.Id, ruser.Id, "channel_guest channel_user")
		require.NotNil(t, err, "Should work when you not modify guest role")
	})
}

func TestDefaultChannelNames(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	actual := th.App.DefaultChannelNames()
	expect := []string{"town-square", "off-topic"}
	require.ElementsMatch(t, expect, actual)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.TeamSettings.ExperimentalDefaultChannels = []string{"foo", "bar"}
	})

	actual = th.App.DefaultChannelNames()
	expect = []string{"town-square", "foo", "bar"}
	require.ElementsMatch(t, expect, actual)
}

func TestSearchChannelsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	c1, err := th.App.CreateChannel(&model.Channel{DisplayName: "test-dev-1", Name: "test-dev-1", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)

	c2, err := th.App.CreateChannel(&model.Channel{DisplayName: "test-dev-2", Name: "test-dev-2", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)

	c3, err := th.App.CreateChannel(&model.Channel{DisplayName: "dev-3", Name: "dev-3", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	require.Nil(t, err)

	defer func() {
		th.App.PermanentDeleteChannel(c1)
		th.App.PermanentDeleteChannel(c2)
		th.App.PermanentDeleteChannel(c3)
	}()

	// add user to test-dev-1 and dev3
	_, err = th.App.AddUserToChannel(th.BasicUser, c1)
	require.Nil(t, err)
	_, err = th.App.AddUserToChannel(th.BasicUser, c3)
	require.Nil(t, err)

	searchAndCheck := func(t *testing.T, term string, expectedDisplayNames []string) {
		res, searchErr := th.App.SearchChannelsForUser(th.BasicUser.Id, th.BasicTeam.Id, term)
		require.Nil(t, searchErr)
		require.Len(t, *res, len(expectedDisplayNames))

		resultDisplayNames := []string{}
		for _, c := range *res {
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
		_, err = th.App.AddUserToChannel(th.BasicUser, c2)
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
	pc1 := th.CreatePrivateChannel(th.BasicTeam)
	th.AddUserToChannel(u2, c1)
	th.AddUserToChannel(u1, pc1)
	th.AddUserToChannel(u2, pc1)

	p1 := th.CreatePost(c1)
	p2 := th.CreatePost(c1)
	p3 := th.CreatePost(c1)

	pp1 := th.CreatePost(pc1)
	require.NotNil(t, pp1)
	pp2 := th.CreatePost(pc1)

	unread, err := th.App.GetChannelUnread(c1.Id, u1.Id)
	require.Nil(t, err)
	require.Equal(t, int64(4), unread.MsgCount)
	unread, err = th.App.GetChannelUnread(c1.Id, u2.Id)
	require.Nil(t, err)
	require.Equal(t, int64(4), unread.MsgCount)
	err = th.App.UpdateChannelLastViewedAt([]string{c1.Id, pc1.Id}, u1.Id)
	require.Nil(t, err)
	err = th.App.UpdateChannelLastViewedAt([]string{c1.Id, pc1.Id}, u2.Id)
	require.Nil(t, err)
	unread, err = th.App.GetChannelUnread(c1.Id, u2.Id)
	require.Nil(t, err)
	require.Equal(t, int64(0), unread.MsgCount)

	t.Run("Unread but last one", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(p2.Id, u1.Id)
		require.Nil(t, err)
		require.NotNil(t, response)
		assert.Equal(t, int64(2), response.MsgCount)
		unread, err := th.App.GetChannelUnread(c1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(2), unread.MsgCount)
		assert.Equal(t, p2.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread last one", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(p3.Id, u1.Id)
		require.Nil(t, err)
		require.NotNil(t, response)
		assert.Equal(t, int64(3), response.MsgCount)
		unread, err := th.App.GetChannelUnread(c1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(1), unread.MsgCount)
		assert.Equal(t, p3.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread first one", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(p1.Id, u1.Id)
		require.Nil(t, err)
		require.NotNil(t, response)
		assert.Equal(t, int64(1), response.MsgCount)
		unread, err := th.App.GetChannelUnread(c1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(3), unread.MsgCount)
		assert.Equal(t, p1.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Other users are unaffected", func(t *testing.T) {
		unread, err := th.App.GetChannelUnread(c1.Id, u2.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(0), unread.MsgCount)
	})

	t.Run("Unread on a private channel", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost(pp1.Id, u1.Id)
		require.Nil(t, err)
		require.NotNil(t, response)
		assert.Equal(t, int64(0), response.MsgCount)
		unread, err := th.App.GetChannelUnread(pc1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(2), unread.MsgCount)
		assert.Equal(t, pp1.CreateAt-1, response.LastViewedAt)

		response, err = th.App.MarkChannelAsUnreadFromPost(pp2.Id, u1.Id)
		assert.Nil(t, err)
		assert.Equal(t, int64(1), response.MsgCount)
		unread, err = th.App.GetChannelUnread(pc1.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(1), unread.MsgCount)
		assert.Equal(t, pp2.CreateAt-1, response.LastViewedAt)
	})

	t.Run("Unread with mentions", func(t *testing.T) {
		c2 := th.CreateChannel(th.BasicTeam)
		_, err := th.App.AddUserToChannel(u2, c2)
		require.Nil(t, err)

		p4, err := th.App.CreatePost(&model.Post{
			UserId:    u2.Id,
			ChannelId: c2.Id,
			Message:   "@" + u1.Username,
		}, c2, false)
		require.Nil(t, err)
		th.CreatePost(c2)

		response, err := th.App.MarkChannelAsUnreadFromPost(p4.Id, u1.Id)
		assert.Nil(t, err)
		assert.Equal(t, int64(1), response.MsgCount)
		assert.Equal(t, int64(1), response.MentionCount)

		unread, err := th.App.GetChannelUnread(c2.Id, u1.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(1), unread.MsgCount)
		assert.Equal(t, int64(1), unread.MentionCount)
	})

	t.Run("Unread on a DM channel", func(t *testing.T) {
		dc := th.CreateDmChannel(u2)

		dm1 := th.CreatePost(dc)
		th.CreatePost(dc)
		th.CreatePost(dc)

		response, err := th.App.MarkChannelAsUnreadFromPost(dm1.Id, u2.Id)
		assert.Nil(t, err)
		assert.Equal(t, int64(0), response.MsgCount)
		assert.Equal(t, int64(3), response.MentionCount)

		unread, err := th.App.GetChannelUnread(dc.Id, u2.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(3), unread.MsgCount)
		assert.Equal(t, int64(3), unread.MentionCount)
	})

	t.Run("Can't unread an imaginary post", func(t *testing.T) {
		response, err := th.App.MarkChannelAsUnreadFromPost("invalid4ofngungryquinj976y", u1.Id)
		assert.NotNil(t, err)
		assert.Nil(t, response)
	})
}

func TestAddUserToChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser1, _ := th.App.CreateUser(&user1)
	defer th.App.PermanentDeleteUser(&user1)
	bot := th.CreateBot()
	botUser, _ := th.App.GetUser(bot.UserId)
	defer th.App.PermanentDeleteBot(botUser.Id)

	th.App.AddTeamMember(th.BasicTeam.Id, ruser1.Id)
	th.App.AddTeamMember(th.BasicTeam.Id, bot.UserId)

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

	err = th.App.JoinChannel(th.BasicChannel, ruser1.Id)
	require.Nil(t, err)

	// verify user was added as a non-admin
	cm1, err := th.App.GetChannelMember(th.BasicChannel.Id, ruser1.Id)
	require.Nil(t, err)
	require.False(t, cm1.SchemeAdmin)

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser2, _ := th.App.CreateUser(&user2)
	defer th.App.PermanentDeleteUser(&user2)
	th.App.AddTeamMember(th.BasicTeam.Id, ruser2.Id)

	_, err = th.App.UpsertGroupMember(group.Id, user2.Id)
	require.Nil(t, err)

	gs.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(gs)
	require.Nil(t, err)

	err = th.App.JoinChannel(th.BasicChannel, ruser2.Id)
	require.Nil(t, err)

	// Should allow a bot to be added to a public group synced channel
	_, err = th.App.AddUserToChannel(botUser, th.BasicChannel)
	require.Nil(t, err)

	// verify user was added as an admin
	cm2, err := th.App.GetChannelMember(th.BasicChannel.Id, ruser2.Id)
	require.Nil(t, err)
	require.True(t, cm2.SchemeAdmin)

	privateChannel := th.CreatePrivateChannel(th.BasicTeam)
	privateChannel.GroupConstrained = model.NewBool(true)
	_, err = th.App.UpdateChannel(privateChannel)
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group.Id,
		SyncableId: privateChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.Nil(t, err)

	// Should allow a group synced user to be added to a group synced private channel
	_, err = th.App.AddUserToChannel(ruser1, privateChannel)
	require.Nil(t, err)

	// Should allow a bot to be added to a private group synced channel
	_, err = th.App.AddUserToChannel(botUser, privateChannel)
	require.Nil(t, err)
}

func TestRemoveUserFromChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user)
	defer th.App.PermanentDeleteUser(ruser)

	bot := th.CreateBot()
	botUser, _ := th.App.GetUser(bot.UserId)
	defer th.App.PermanentDeleteBot(botUser.Id)

	th.App.AddTeamMember(th.BasicTeam.Id, ruser.Id)
	th.App.AddTeamMember(th.BasicTeam.Id, bot.UserId)

	privateChannel := th.CreatePrivateChannel(th.BasicTeam)

	_, err := th.App.AddUserToChannel(ruser, privateChannel)
	require.Nil(t, err)
	_, err = th.App.AddUserToChannel(botUser, privateChannel)
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
	_, err = th.App.UpdateChannel(privateChannel)
	require.Nil(t, err)

	// Should not allow a group synced user to be removed from channel
	err = th.App.RemoveUserFromChannel(ruser.Id, th.SystemAdminUser.Id, privateChannel)
	assert.Equal(t, err.Id, "api.channel.remove_members.denied")

	// Should allow a user to remove themselves from group synced channel
	err = th.App.RemoveUserFromChannel(ruser.Id, ruser.Id, privateChannel)
	require.Nil(t, err)

	// Should allow a bot to be removed from a group synced channel
	err = th.App.RemoveUserFromChannel(botUser.Id, th.SystemAdminUser.Id, privateChannel)
	require.Nil(t, err)
}
