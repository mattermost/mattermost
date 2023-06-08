// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestChannelUsersAddCmdF() {
	channelArg := teamID + ":" + channelName
	mockTeam := model.Team{Id: teamID}
	mockChannel := model.Channel{Id: channelID, Name: channelName}
	mockUser := model.User{Id: userID, Email: userEmail}

	s.Run("Not enough command line parameters", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		// One argument provided.
		err := channelUsersAddCmdF(s.client, cmd, []string{channelArg})
		s.EqualError(err, "not enough arguments")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)

		// No arguments provided.
		err = channelUsersAddCmdF(s.client, cmd, []string{})
		s.EqualError(err, "not enough arguments")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})
	s.Run("Add existing user to existing channel", func() {
		printer.Clean()
		cmd := &cobra.Command{}

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
			GetUserByEmail(context.Background(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			AddChannelMember(context.Background(), channelID, userID).
			Return(&model.ChannelMember{}, &model.Response{}, nil).
			Times(1)
		err := channelUsersAddCmdF(s.client, cmd, []string{channelArg, userEmail})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})
	s.Run("Add existing user to nonexistent channel", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		// No channel is returned by client.
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

		err := channelUsersAddCmdF(s.client, cmd, []string{channelArg, userEmail})
		s.EqualError(err, fmt.Sprintf("unable to find channel %q", channelArg))
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})
	s.Run("Add existing user to channel owned by nonexistent team", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		// No team is returned by client.
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

		err := channelUsersAddCmdF(s.client, cmd, []string{channelArg, userEmail})
		s.EqualError(err, fmt.Sprintf("unable to find channel %q", channelArg))
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})
	s.Run("Add multiple users, some nonexistent to existing channel", func() {
		printer.Clean()
		nilUserArg := "nonexistent-user"
		cmd := &cobra.Command{}

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
			GetUserByEmail(context.Background(), nilUserArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByUsername(context.Background(), nilUserArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUser(context.Background(), nilUserArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			AddChannelMember(context.Background(), channelID, userID).
			Return(&model.ChannelMember{}, &model.Response{}, nil).
			Times(1)
		err := channelUsersAddCmdF(s.client, cmd, []string{channelArg, nilUserArg, userEmail})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Can't find user '"+nilUserArg+"'", printer.GetErrorLines()[0])
	})
	s.Run("Error adding existing user to existing channel", func() {
		printer.Clean()
		cmd := &cobra.Command{}

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
			GetUserByEmail(context.Background(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			AddChannelMember(context.Background(), channelID, userID).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)
		err := channelUsersAddCmdF(s.client, cmd, []string{channelArg, userEmail})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Unable to add '"+userEmail+"' to "+channelName+". Error: mock error",
			printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestChannelUsersRemoveCmd() {
	mockUser := model.User{Id: userID, Email: userEmail}
	mockUser2 := model.User{Id: userID + "2", Email: userID + "2@example.com"}
	mockUser3 := model.User{Id: userID + "3", Email: userID + "3@example.com"}
	argsTeamChannel := teamName + ":" + channelName

	s.Run("should remove user from channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		args := []string{argsTeamChannel, userEmail}

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

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.Background(), foundChannel.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := channelUsersRemoveCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("should throw error if both --all-users flag and user email are passed", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("all-users", true, "Remove all users from the indicated channel.")
		args := []string{argsTeamChannel, userEmail}

		err := channelUsersRemoveCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "individual users must not be specified in conjunction with the --all-users flag")
	})

	s.Run("should remove all users from channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("all-users", true, "Remove all users from the indicated channel.")
		args := []string{argsTeamChannel}

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

		mockMember1 := model.ChannelMember{ChannelId: channelID, UserId: mockUser.Id}
		mockMember2 := model.ChannelMember{ChannelId: channelID, UserId: mockUser2.Id}
		mockMember3 := model.ChannelMember{ChannelId: channelID, UserId: mockUser3.Id}
		mockChannelMembers := model.ChannelMembers{mockMember1, mockMember2, mockMember3}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.Background(), foundChannel.Id, 0, 10000, "").
			Return(mockChannelMembers, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.Background(), foundChannel.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.Background(), foundChannel.Id, mockUser2.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.Background(), foundChannel.Id, mockUser3.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := channelUsersRemoveCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("should remove multiple users from channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		args := []string{argsTeamChannel, userEmail, mockUser2.Email}

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

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), mockUser2.Email, "").
			Return(&mockUser2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.Background(), foundChannel.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.Background(), foundChannel.Id, mockUser2.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := channelUsersRemoveCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("should remove all users from channel throws error", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("all-users", true, "Remove all users from the indicated channel.")
		args := []string{argsTeamChannel}

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

		mockMember1 := model.ChannelMember{ChannelId: channelID, UserId: mockUser.Id}
		mockChannelMembers := model.ChannelMembers{mockMember1}

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.Background(), foundChannel.Id, 0, 10000, "").
			Return(mockChannelMembers, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.Background(), foundChannel.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusNotFound}, errors.New("mock error")).
			Times(1)

		err := channelUsersRemoveCmdF(s.client, cmd, args)
		s.Require().ErrorContains(err, "unable to remove")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})
}
