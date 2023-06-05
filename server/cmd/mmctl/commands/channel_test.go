// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/web"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

const (
	userID             = "userID"
	userEmail          = "user@example.com"
	teamID             = "teamID"
	teamName           = "teamName"
	teamDisplayName    = "teamDisplayName"
	channelID          = "channelID"
	channelName        = "channelName"
	channelDisplayName = "channelDisplayName"
)

func (s *MmctlUnitTestSuite) TestSearchChannelCmdF() {
	s.Run("Search for an existing channel on an existing team", func() {
		printer.Clean()
		mockTeam := model.Team{Id: teamID}
		mockChannel := model.Channel{Name: channelName}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamID, "")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByName(context.Background(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := searchChannelCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(&mockChannel, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Search for an existing channel without specifying team", func() {
		printer.Clean()
		otherTeamID := "example-team-id-2"
		mockTeams := []*model.Team{
			{Id: otherTeamID},
			{Id: teamID},
		}
		mockChannel := model.Channel{Name: channelName}

		s.client.
			EXPECT().
			GetAllTeams(context.Background(), "", 0, 9999).
			Return(mockTeams, &model.Response{}, nil).
			Times(1)

		// first call is for the other team, that doesn't have the channel
		s.client.
			EXPECT().
			GetChannelByName(context.Background(), channelName, otherTeamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		// second call is for the team that contains the channel
		s.client.
			EXPECT().
			GetChannelByName(context.Background(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := searchChannelCmdF(s.client, &cobra.Command{}, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(&mockChannel, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Search for a nonexistent channel", func() {
		printer.Clean()
		mockTeam := model.Team{Id: teamID}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamID, "")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByName(context.Background(), channelName, teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := searchChannelCmdF(s.client, cmd, []string{channelName})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "channel "+channelName+" was not found in team "+teamID)
	})

	s.Run("Search for a channel in a nonexistent team", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamID, "")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := searchChannelCmdF(s.client, cmd, []string{channelName})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "team "+teamID+" was not found")
	})
}

func (s *MmctlUnitTestSuite) TestModifyChannelCmdF() {
	s.Run("Both public and private the same value (false)", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", false, "")
		cmd.Flags().Bool("private", false, "")

		err := modifyChannelCmdF(s.client, cmd, []string{})
		s.Require().EqualError(err, "you must specify only one of --public or --private")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Both public and private the same value (true)", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", true, "")

		err := modifyChannelCmdF(s.client, cmd, []string{})
		s.Require().EqualError(err, "you must specify only one of --public or --private")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify non-existing channel", func() {
		printer.Clean()
		args := []string{channelID}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), args[0], "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel %q", args[0]))
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify a channel from a non-existing team", func() {
		printer.Clean()
		team := "mockTeam"
		channel := channelID
		args := []string{team + ":" + channel}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetTeam(context.Background(), team, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), team, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel %q", args[0]))
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify direct channel", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypeDirect,
		}
		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), args[0], "").
			Return(channel, &model.Response{}, nil).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "you can only change the type of public/private channels")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify group channel", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypeGroup,
		}
		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), args[0], "").
			Return(channel, &model.Response{}, nil).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "you can only change the type of public/private channels")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify channel privacy and get error", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypePrivate,
		}
		mockError := errors.New("mock error")

		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), args[0], "").
			Return(channel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelPrivacy(context.Background(), channel.Id, model.ChannelTypeOpen).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("failed to update channel (%q) privacy: %s", channel.Id, mockError.Error()))
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Modify channel privacy to public", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypePrivate,
		}
		returnedChannel := &model.Channel{
			Id:   channel.Id,
			Type: model.ChannelTypeOpen,
		}
		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), args[0], "").
			Return(channel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelPrivacy(context.Background(), channel.Id, model.ChannelTypeOpen).
			Return(returnedChannel, &model.Response{}, nil).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().NoError(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Modify channel privacy to private", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypeOpen,
		}
		returnedChannel := &model.Channel{
			Id:   channel.Id,
			Type: model.ChannelTypePrivate,
		}
		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", false, "")
		cmd.Flags().Bool("private", true, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), args[0], "").
			Return(channel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelPrivacy(context.Background(), channel.Id, model.ChannelTypePrivate).
			Return(returnedChannel, &model.Response{}, nil).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().NoError(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestArchiveChannelCmdF() {
	s.Run("Archive channel without args returns an error", func() {
		printer.Clean()

		err := archiveChannelsCmdF(s.client, &cobra.Command{}, []string{})
		mockErr := errors.New("enter at least one channel to archive")

		expected := mockErr.Error()
		actual := err.Error()

		s.Require().Equal(expected, actual)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Archive an existing channel on an existing team", func() {
		printer.Clean()

		mockTeam := model.Team{Id: teamID}
		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := teamID + ":" + channelName

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteChannel(context.Background(), channelID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, []string{args})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Archive an existing channel specified by channel id", func() {
		printer.Clean()

		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := []string{channelName}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteChannel(context.Background(), channelID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Archive several channels specified by channel id", func() {
		printer.Clean()

		channelArg1 := "some-channel"
		channelID1 := "some-channel-id"
		mockChannel1 := model.Channel{Id: channelID1, Name: channelArg1}

		channelArg2 := "some-other-channel"
		channelID2 := "some-other-channel-id"
		mockChannel2 := model.Channel{Id: channelID2, Name: channelArg2}

		cmd := &cobra.Command{}
		args := []string{channelArg1, channelArg2}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg1, "").
			Return(&mockChannel1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg2, "").
			Return(&mockChannel2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteChannel(context.Background(), channelID1).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteChannel(context.Background(), channelID2).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Fail to archive a channel on a non-existent team", func() {
		printer.Clean()

		teamArg := "some-non-existent-team-id"
		channelArg := "some-channel"

		cmd := &cobra.Command{}
		args := []string{teamArg + ":" + channelArg}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to archive a non-existing channel on an existent team", func() {
		printer.Clean()

		teamArg := "some-non-existing-team-id"
		mockTeam := model.Team{Id: teamArg}
		channelArg := "some-non-existing-channel"

		cmd := &cobra.Command{}
		args := []string{teamArg + ":" + channelArg}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelArg, teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to archive a non-existing channel", func() {
		printer.Clean()

		channelArg := "some-non-existing-channel"
		cmd := &cobra.Command{}
		args := []string{channelArg}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to archive an existing channel when client throws error", func() {
		printer.Clean()

		channelArg := "some-channel"
		channelID := "some-channel-id"
		mockChannel := model.Channel{Id: channelID, Name: channelArg}

		cmd := &cobra.Command{}
		args := []string{channelArg}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		mockErr := errors.New("mock error")
		s.client.
			EXPECT().
			DeleteChannel(context.Background(), channelID).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockErr).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to archive channel '%s' error: %s", channelArg, mockErr.Error())
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to archive when team and channel not provided", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		args := []string{":"}

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Avoid path traversal with a valid team name", func() {
		printer.Clean()
		arg := "team:/../hello/channel-test"

		err := archiveChannelsCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().Error(err)
		s.Require().Equal("Unable to find channel 'team:/../hello/channel-test'", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestListChannelsCmd() {
	emptyChannels := []*model.Channel{}

	s.Run("Team is not found", func() {
		printer.Clean()
		args := []string{""}
		args[0] = teamID
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, "unable to find team \""+teamID+"\"")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("unable to find team \""+teamID+"\"", printer.GetErrorLines()[0])
	})

	s.Run("Team has no channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		// Empty channels of a team
		publicChannels := []*model.Channel{}
		archivedChannels := []*model.Channel{}
		privateChannels := []*model.Channel{}
		userChannels := []*model.Channel{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Team with public channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		publicChannelName1 := "ChannelName1"
		publicChannel1 := &model.Channel{Name: publicChannelName1}

		publicChannelName2 := "ChannelName2"
		publicChannel2 := &model.Channel{Name: publicChannelName2}

		publicChannels := []*model.Channel{publicChannel1, publicChannel2}
		archivedChannels := []*model.Channel{} // Empty archived channels
		privateChannels := []*model.Channel{}  // Empty private channels
		userChannels := []*model.Channel{}     // Empty user channels

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
	})

	s.Run("Team with archived channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		archivedChannelName1 := "ChannelName1"
		archivedChannel1 := &model.Channel{Name: archivedChannelName1}

		archivedChannelName2 := "ChannelName2"
		archivedChannel2 := &model.Channel{Name: archivedChannelName2}

		publicChannels := []*model.Channel{} // Empty public channels
		archivedChannels := []*model.Channel{archivedChannel1, archivedChannel2}
		privateChannels := []*model.Channel{} // Empty private channels
		userChannels := []*model.Channel{}    // Empty user channels

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], archivedChannel1)
		s.Require().Equal(printer.GetLines()[1], archivedChannel2)
	})

	s.Run("Team with public, archived and private channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		archivedChannel2 := &model.Channel{Name: "archivedChannelName2"}
		archivedChannels := []*model.Channel{archivedChannel1, archivedChannel2}

		publicChannel1 := &model.Channel{Name: "publicChannelName1"}
		publicChannel2 := &model.Channel{Name: "publicChannelName2"}
		publicChannels := []*model.Channel{publicChannel1, publicChannel2}

		privateChannel1 := &model.Channel{Name: "archivedChannelName1"}
		privateChannel2 := &model.Channel{Name: "archivedChannelName2"}
		privateChannels := []*model.Channel{privateChannel1, privateChannel2}
		userChannels := []*model.Channel{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 6)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
		s.Require().Equal(printer.GetLines()[2], archivedChannel1)
		s.Require().Equal(printer.GetLines()[3], archivedChannel2)
		s.Require().Equal(printer.GetLines()[4], privateChannel1)
		s.Require().Equal(printer.GetLines()[5], privateChannel2)
	})

	s.Run("User does not have permissions to get all private channels in team", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		team := &model.Team{
			Id: teamID,
		}
		cmd.PersistentFlags().Bool("local", false, "allows communicating with the server through a unix socket")
		_ = viper.BindPFlag("local", cmd.PersistentFlags().Lookup("local"))

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		publicChannel1 := &model.Channel{Name: "publicChannelName1"}

		privateChannel1 := &model.Channel{Name: "archivedChannelName1", Type: model.ChannelTypePrivate}
		privateChannel2 := &model.Channel{Name: "archivedChannelName2", Type: model.ChannelTypePrivate}
		userChannels := []*model.Channel{archivedChannel1, publicChannel1, privateChannel1, privateChannel2}

		mockError := errors.New("user does not have permissions to list all private channels in team")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)
		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], privateChannel1)
		s.Require().Equal(printer.GetLines()[1], privateChannel2)
	})

	s.Run("API fails to get team's public channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list public channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("API fails to get team's archived channels list", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list archived channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("API fails to get team's private channels list", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(emptyChannels, &model.Response{}, mockError).
			Times(1) // falls through to GetChannelsForTeamForUser in non-local mode

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list private channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("API fails to get team's private channels list in local mode", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		cmd.PersistentFlags().Bool("local", true, "allows communicating with the server through a unix socket")
		_ = viper.BindPFlag("local", cmd.PersistentFlags().Lookup("local"))
		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(emptyChannels, &model.Response{}, mockError).
			Times(0) // does not fall through to GetChannelsForTeamForUser in local mode

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list private channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("API fails to get team's public, archived and private channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		cmd.PersistentFlags().Bool("local", false, "allows communicating with the server through a unix socket")
		_ = viper.BindPFlag("local", cmd.PersistentFlags().Lookup("local"))

		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID, "me", false, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 3)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list public channels for %q: %s", args[0], mockError.Error()))
		s.Require().Equal(printer.GetErrorLines()[1], fmt.Sprintf("unable to list archived channels for %q: %s", args[0], mockError.Error()))
		s.Require().Equal(printer.GetErrorLines()[2], fmt.Sprintf("unable to list private channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("Two teams, one is found and other is not found", func() {
		printer.Clean()

		teamID1 := "teamID1"
		teamID2 := "teamID2"
		args := []string{teamID1, teamID2}
		cmd := &cobra.Command{}

		team1 := &model.Team{Id: teamID1}

		publicChannel1 := &model.Channel{Name: "publicChannelName1"}
		publicChannel2 := &model.Channel{Name: "publicChannelName2"}
		publicChannels := []*model.Channel{publicChannel1, publicChannel2}

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		archivedChannels := []*model.Channel{archivedChannel1}

		privateChannel1 := &model.Channel{Name: "privateChannelName1"}
		privateChannels := []*model.Channel{privateChannel1}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID1, "").
			Return(team1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID2, "").
			Return(nil, &model.Response{}, nil). // Team 2 not found
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamID2, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID1, "me", false, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, "unable to find team \""+teamID2+"\"")
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("unable to find team \""+teamID2+"\"", printer.GetErrorLines()[0])
		s.Len(printer.GetLines(), 4)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
		s.Require().Equal(printer.GetLines()[2], archivedChannel1)
		s.Require().Equal(printer.GetLines()[3], privateChannel1)
	})

	s.Run("Two teams, one is found and other has API errors", func() {
		printer.Clean()

		teamID1 := "teamID1"
		teamID2 := "teamID2"
		args := []string{teamID1, teamID2}
		cmd := &cobra.Command{}

		team1 := &model.Team{Id: teamID1}
		team2 := &model.Team{Id: teamID2}

		publicChannel1 := &model.Channel{Name: "publicChannelName1"}
		publicChannel2 := &model.Channel{Name: "publicChannelName2"}
		publicChannels := []*model.Channel{publicChannel1, publicChannel2}

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		archivedChannels := []*model.Channel{archivedChannel1}

		privateChannel1 := &model.Channel{Name: "privateChannelName1"}
		privateChannels := []*model.Channel{privateChannel1}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID1, "").
			Return(team1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID1, "me", false, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(0)

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID2, "").
			Return(team2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID2, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID2, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID2, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, mockError).
			Times(1)
		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID2, "me", false, "").
			Return(privateChannels, &model.Response{}, mockError).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetErrorLines(), 3)
		s.Len(printer.GetLines(), 4)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
		s.Require().Equal(printer.GetLines()[2], archivedChannel1)
		s.Require().Equal(printer.GetLines()[3], privateChannel1)
	})

	s.Run("Two teams, both are not found", func() {
		printer.Clean()

		team1ID := "team1ID"
		team2ID := "team2ID"
		args := []string{team1ID, team2ID}
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), team1ID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetTeam(context.Background(), team2ID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), team1ID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.Background(), team2ID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, "unable to find team \""+team1ID+"\"")
		s.Require().ErrorContains(err, "unable to find team \""+team2ID+"\"")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 2)
		s.Require().Equal("unable to find team \""+team1ID+"\"", printer.GetErrorLines()[0])
		s.Require().Equal("unable to find team \""+team2ID+"\"", printer.GetErrorLines()[1])
	})

	s.Run("Two teams, both have channels", func() {
		printer.Clean()

		teamID1 := "teamID1"
		teamID2 := "teamID2"
		args := []string{teamID1, teamID2}
		cmd := &cobra.Command{}

		team1 := &model.Team{Id: teamID1}
		team2 := &model.Team{Id: teamID2}

		// Using same channel name for both teams since there can be common channels
		publicChannel1 := &model.Channel{Name: "publicChannelName1"}
		publicChannel2 := &model.Channel{Name: "publicChannelName2"}
		publicChannels := []*model.Channel{publicChannel1, publicChannel2}

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		archivedChannels := []*model.Channel{archivedChannel1}

		privateChannel1 := &model.Channel{Name: "privateChannelName1"}
		privateChannels := []*model.Channel{privateChannel1}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID1, "").
			Return(team1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID1, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID1, "me", false, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(0)

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID2, "").
			Return(team2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID2, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.Background(), teamID2, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID2, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.Background(), teamID2, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID2, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.Background(), teamID2, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.Background(), teamID2, "me", false, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 8)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
		s.Require().Equal(printer.GetLines()[2], archivedChannel1)
		s.Require().Equal(printer.GetLines()[3], privateChannel1)
		s.Require().Equal(printer.GetLines()[4], publicChannel1)
		s.Require().Equal(printer.GetLines()[5], publicChannel2)
		s.Require().Equal(printer.GetLines()[6], archivedChannel1)
		s.Require().Equal(printer.GetLines()[7], privateChannel1)
	})

	s.Run("Avoid path traversal", func() {
		printer.Clean()
		arg := "\"test/../hello?\"channel-test"

		err := listChannelsCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().ErrorContains(err, "unable to find team \"\\\"test/../hello?\\\"channel-test\"")
		s.Require().Equal("unable to find team \"\\\"test/../hello?\\\"channel-test\"", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestUnarchiveChannelCmdF() {
	s.Run("Unarchive channel without args returns an error", func() {
		printer.Clean()

		err := unarchiveChannelsCmdF(s.client, &cobra.Command{}, []string{})
		mockErr := errors.New("enter at least one channel")

		expected := mockErr.Error()
		actual := err.Error()
		s.Require().Equal(expected, actual)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Unarchive an existing channel on an existing team", func() {
		printer.Clean()

		mockTeam := model.Team{Id: teamID}
		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := teamID + ":" + channelName

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreChannel(context.Background(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, []string{args})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Unarchive an existing channel specified by channel id", func() {
		printer.Clean()

		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := []string{channelName}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreChannel(context.Background(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Unarchive several channels specified by channel id", func() {
		printer.Clean()

		channelArg1 := "some-channel"
		channelID1 := "some-channel-id"
		mockChannel1 := model.Channel{Id: channelID1, Name: channelArg1}

		channelArg2 := "some-other-channel"
		channelID2 := "some-other-channel-id"
		mockChannel2 := model.Channel{Id: channelID2, Name: channelArg2}

		cmd := &cobra.Command{}
		args := []string{channelArg1, channelArg2}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg1, "").
			Return(&mockChannel1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg2, "").
			Return(&mockChannel2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreChannel(context.Background(), channelID1).
			Return(&mockChannel1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreChannel(context.Background(), channelID2).
			Return(&mockChannel2, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Fail to unarchive a channel on a non-existent team", func() {
		printer.Clean()

		teamArg := "some-non-existent-team-id"

		cmd := &cobra.Command{}
		args := []string{teamArg + ":" + channelName}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		actual := printer.GetErrorLines()[0]
		expected := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to unarchive a non-existing channel on an existent team", func() {
		printer.Clean()

		teamArg := "some-non-existing-team-id"
		mockTeam := model.Team{Id: teamArg}
		channelArg := "some-non-existing-channel"

		cmd := &cobra.Command{}
		args := []string{teamArg + ":" + channelArg}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelArg, teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		actual := printer.GetErrorLines()[0]
		expected := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to unarchive a non-existing channel", func() {
		printer.Clean()

		channelArg := "some-non-existing-channel"
		cmd := &cobra.Command{}
		args := []string{channelArg}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		actual := printer.GetErrorLines()[0]
		expected := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to unarchive an existing channel when client throws error", func() {
		printer.Clean()

		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := []string{channelName}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		mockErr := errors.New("mock error")
		s.client.
			EXPECT().
			RestoreChannel(context.Background(), channelID).
			Return(nil, &model.Response{}, mockErr).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		actual := printer.GetErrorLines()[0]
		expected := fmt.Sprintf("Unable to unarchive channel '%s'. Error: %s", channelName, mockErr.Error())
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to unarchive when team and channel not provided", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		args := []string{":"}

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		actual := printer.GetErrorLines()[0]
		expected := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})
}

func (s *MmctlUnitTestSuite) TestRenameChannelCmd() {
	s.Run("It should fail when no name and display name is supplied", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		args := []string{""}
		args[0] = "teamName:channelName"

		cmd.Flags().String("name", "", "Channel Name")
		cmd.Flags().String("display-name", "", channelDisplayName)
		cmd.Flags().String("display_name", "", "")

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "require at least one flag to rename channel, either 'name' or 'display-name'")
	})

	s.Run("It should fail when empty team and channel name are supplied", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := ""
		channelName := ""
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail when empty channel is supplied", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		channelName := ""
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}
		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail with empty team and non existing channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := ""
		channelName := "nonExistingChannelName"
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail when team is not found", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "nonExistingteamName"
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail when channel is not found", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		channelName := "nonExistingChannelName"
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail when api fails to rename", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			DisplayName: &newChannelDisplayName,
			Name:        &newChannelName,
		}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		mockError := model.NewAppError("at-random-location.go", "mock error", nil, "mocking a random error", 0)
		s.client.
			EXPECT().
			PatchChannel(context.Background(), foundChannel.Id, channelPatch).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("cannot rename channel %q, error: %s", foundChannel.Name, mockError.Error()))
	})

	s.Run("It should work as expected", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			DisplayName: &newChannelDisplayName,
			Name:        &newChannelName,
		}

		updatedChannel := &model.Channel{
			Id:          channelID,
			Name:        newChannelName,
			DisplayName: newChannelDisplayName,
		}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchChannel(context.Background(), foundChannel.Id, channelPatch).
			Return(updatedChannel, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], updatedChannel)
	})

	s.Run("It should work with empty team and existing channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := ""
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			DisplayName: &newChannelDisplayName,
			Name:        &newChannelName,
		}

		updatedChannel := &model.Channel{
			Id:          channelID,
			Name:        newChannelName,
			DisplayName: newChannelDisplayName,
		}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchChannel(context.Background(), foundChannel.Id, channelPatch).
			Return(updatedChannel, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], updatedChannel)
	})

	s.Run("It should work even if only name flag is passed", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := ""
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)
		cmd.Flags().String("display_name", "", "")

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			Name: &newChannelName,
		}

		updatedChannel := &model.Channel{
			Id:          channelID,
			Name:        newChannelName,
			DisplayName: newChannelDisplayName,
		}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchChannel(context.Background(), foundChannel.Id, channelPatch).
			Return(updatedChannel, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], updatedChannel)
	})

	s.Run("It should work even if only display name flag is passed", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := ""
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			DisplayName: &newChannelDisplayName,
		}

		updatedChannel := &model.Channel{
			Id:          channelID,
			Name:        newChannelName,
			DisplayName: newChannelDisplayName,
		}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchChannel(context.Background(), foundChannel.Id, channelPatch).
			Return(updatedChannel, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], updatedChannel)
	})
}

func (s *MmctlUnitTestSuite) TestMoveChannelCmdF() {
	s.Run("Move a channel to another team by using names", func() {
		printer.Clean()

		dstTeamName := "destination-team-name"
		dstTeamID := "destination-team-id"
		mockTeam1 := model.Team{
			Name: dstTeamName,
			Id:   dstTeamID,
		}

		srcTeamName := "source-team-name"
		srcTeamID := "source-team-id"
		mockTeam2 := model.Team{
			Name: srcTeamName,
			Id:   srcTeamID,
		}

		channelName := "channel-name"
		channelID := "channel-id"
		mockChannel := model.Channel{
			Name:   channelName,
			TeamId: mockTeam2.Id,
			Id:     channelID,
		}

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), dstTeamName, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), dstTeamName, "").
			Return(&mockTeam1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeam(context.Background(), srcTeamName, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), srcTeamName, "").
			Return(&mockTeam2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, mockTeam2.Id, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			MoveChannel(context.Background(), mockChannel.Id, mockTeam1.Id, false).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamName, srcTeamName + ":" + channelName})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(&mockChannel, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should fail for not being able to find the destination team", func() {
		printer.Clean()

		dstTeamName := "destination-team-name"

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), dstTeamName, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), dstTeamName, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamName, "team:channel"})

		s.Require().EqualError(err, fmt.Sprintf("unable to find destination team %q", dstTeamName))
	})

	s.Run("Should fail for not being able to find the channel", func() {
		printer.Clean()

		dstTeamName := "destination-team-name"
		dstTeamID := "destination-team-id"
		mockTeam1 := model.Team{
			Name: dstTeamName,
			Id:   dstTeamID,
		}

		channelID := "channel-id"

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), dstTeamID, "").
			Return(&mockTeam1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelID, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		var expected error
		expected = multierror.Append(expected, fmt.Errorf("unable to find channel %q", channelID))

		s.Require().EqualError(err, expected.Error())
	})

	s.Run("Fail on client.MoveChannel to another team by using Ids", func() {
		printer.Clean()

		dstTeamID := "destination-team-id"
		mockTeam1 := model.Team{
			Id: dstTeamID,
		}

		channelID := "channel-id"

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), dstTeamID, "").
			Return(&mockTeam1, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelID, "").
			Return(&model.Channel{Id: channelID, Name: "some-name"}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			MoveChannel(context.Background(), channelID, mockTeam1.Id, false).
			Return(nil, &model.Response{}, errors.New("some-error")).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		var expected error
		expected = multierror.Append(expected, fmt.Errorf("unable to move channel %q: some-error", "some-name"))

		s.Require().EqualError(err, expected.Error())
	})
}

func (s *MmctlUnitTestSuite) TestCreateChannelCmd() {
	s.Run("should not create channel without display name", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		args := []string{teamName + ":" + channelName}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "display Name is required")
	})

	s.Run("should not create channel without name", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := teamName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "name is required")
	})

	s.Run("should not create channel without team", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "team is required")
	})

	s.Run("should fail when team does not exist", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := teamName + ":" + channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find team: %s", teamName))
	})

	s.Run("should create public channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := teamName + ":" + channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")

		foundTeam := &model.Team{
			Id:          "teamId",
			Name:        teamName,
			DisplayName: "teamDisplayName",
		}

		foundChannel := &model.Channel{
			TeamId:      "teamId",
			Name:        channelName,
			DisplayName: channelDisplayName,
			Type:        model.ChannelTypeOpen,
		}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateChannel(context.Background(), foundChannel).
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], foundChannel)
	})

	s.Run("should create private channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := teamName + ":" + channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")
		cmd.Flags().Bool("private", true, "Create a private channel")

		foundTeam := &model.Team{
			Id:          "teamId",
			Name:        teamName,
			DisplayName: "teamDisplayName",
		}

		foundChannel := &model.Channel{
			TeamId:      "teamId",
			Name:        channelName,
			DisplayName: channelDisplayName,
			Type:        model.ChannelTypePrivate,
		}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateChannel(context.Background(), foundChannel).
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], foundChannel)
	})

	s.Run("should create channel with header and purpose", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		header := "someHeader"
		purpose := "somePurpose"
		argsTeamChannel := teamName + ":" + channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")
		cmd.Flags().String("header", header, "Channel header")
		cmd.Flags().String("purpose", purpose, "Channel purpose")
		cmd.Flags().Bool("private", true, "Create a private channel")

		foundTeam := &model.Team{
			Id:          "teamId",
			Name:        teamName,
			DisplayName: "teamDisplayName",
		}

		foundChannel := &model.Channel{
			TeamId:      "teamId",
			Name:        channelName,
			DisplayName: channelDisplayName,
			Header:      header,
			Purpose:     purpose,
			Type:        model.ChannelTypePrivate,
		}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateChannel(context.Background(), foundChannel).
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], foundChannel)
	})
}

func (s *MmctlUnitTestSuite) TestDeleteChannelsCmd() {
	teamName := "team1"
	teamID := "teamId"
	mockTeam := model.Team{
		Name: teamName,
		Id:   teamID,
	}

	channelName := "channel1"
	channelID := "channel1Id"
	mockChannel := model.Channel{
		Name: channelName,
		Id:   channelID,
	}

	s.Run("Delete channels without confirm flag returns an error", func() {
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		err := deleteChannelsCmdF(s.client, cmd, []string{"some"})
		s.Require().NotNil(err)
		s.Require().Equal("could not proceed, either enable --confirm flag or use an interactive shell to complete operation: this is not an interactive shell", err.Error())
	})

	s.Run("Delete channel that does not exist in db returns an error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		arg := teamID + ":" + channelName
		err := deleteChannelsCmdF(s.client, cmd, []string{arg})
		var expected error
		expected = multierror.Append(expected, errors.New("unable to find channel '"+arg+"'"))
		s.Require().EqualError(err, expected.Error())
	})

	s.Run("Delete channel from team that does not exist in db returns an error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		arg := teamName + ":" + channelName
		err := deleteChannelsCmdF(s.client, cmd, []string{arg})

		var expected error
		expected = multierror.Append(expected, errors.New("unable to find channel '"+arg+"'"))
		s.Require().EqualError(err, expected.Error())
	})

	s.Run("Delete channel should delete channel", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(&mockTeam, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, teamID, "").
			Return(&mockChannel, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			PermanentDeleteChannel(context.Background(), channelID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		arg := teamID + ":" + channelName
		err := deleteChannelsCmdF(s.client, cmd, []string{arg})
		s.Require().Nil(err)
		s.Require().Equal(&mockChannel, printer.GetLines()[0])
	})

	s.Run("Delete two channels, first one does not exist", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(&mockTeam, nil, nil).
			Times(2)

		channelNameDoesNotExist := "this channel does not exist"
		mockError := errors.New("channel does not exist error")

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelNameDoesNotExist, teamID, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelNameDoesNotExist, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, teamID, "").
			Return(&mockChannel, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			PermanentDeleteChannel(context.Background(), channelID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		arg1 := teamID + ":" + channelNameDoesNotExist
		arg2 := teamID + ":" + channelName
		err := deleteChannelsCmdF(s.client, cmd, []string{arg1, arg2})

		var expected error
		expected = multierror.Append(expected, fmt.Errorf("unable to find channel '%s'", arg1))
		s.Require().EqualError(err, expected.Error())
		s.Require().Equal(&mockChannel, printer.GetLines()[0])
	})
}
