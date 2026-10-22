// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

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
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(3)

		s.client.
			EXPECT().
			AddChannelMember(context.TODO(), channelID, userID).
			Return(&model.ChannelMember{}, &model.Response{}, nil).
			Times(2)
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
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		// No channel is returned by client.
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
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
			GetTeam(context.TODO(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamID, "").
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
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), nilUserArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUser(context.TODO(), nilUserArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		err := channelUsersAddCmdF(s.client, cmd, []string{channelArg, nilUserArg, userEmail})
		s.Require().ErrorContains(err, "unable to find user")
		s.Require().ErrorContains(err, nilUserArg)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
	})
	s.Run("Error adding existing user to existing channel", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			AddChannelMember(context.TODO(), channelID, userID).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)
		err := channelUsersAddCmdF(s.client, cmd, []string{channelArg, userEmail})
		s.Require().ErrorContains(err, "unable to add")
		s.Require().ErrorContains(err, userEmail)
		s.Require().ErrorContains(err, channelName)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
	})
}

func channelUsersListTestCmd() *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().Int("page", 0, "")
	cmd.Flags().Int("per-page", DefaultPageSize, "")
	cmd.Flags().Bool("all", false, "")
	return cmd
}

func (s *MmctlUnitTestSuite) TestChannelUsersListCmd() {
	channelArg := teamID + ":" + channelName
	mockTeam := model.Team{Id: teamID}
	mockChannel := model.Channel{Id: channelID, Name: channelName}
	mockUser := model.User{Id: userID, Username: "user1", Email: userEmail}
	mockUser2 := model.User{Id: userID + "2", Username: "user2", Email: userID + "2@example.com"}
	mockUser3 := model.User{Id: userID + "3", Username: "user3", Email: userID + "3@example.com"}
	member1 := model.ChannelMember{ChannelId: channelID, UserId: mockUser.Id, Roles: "channel_user"}
	member2 := model.ChannelMember{ChannelId: channelID, UserId: mockUser2.Id, Roles: "channel_user channel_admin"}
	member3 := model.ChannelMember{ChannelId: channelID, UserId: mockUser3.Id, Roles: "channel_user"}

	s.Run("List users of a channel", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(model.ChannelMembers{member1, member2}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{mockUser.Id, mockUser2.Id}).
			Return([]*model.User{&mockUser, &mockUser2}, &model.Response{}, nil).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Len(printer.GetErrorLines(), 0)

		out1 := printer.GetLines()[0].(channelUserOut)
		s.Require().Equal(mockUser.Id, out1.Id)
		s.Require().Equal(mockUser.Username, out1.Username)
		s.Require().Equal(mockUser.Email, out1.Email)
		s.Require().Equal("channel_user", out1.Roles)

		out2 := printer.GetLines()[1].(channelUserOut)
		s.Require().Equal(mockUser2.Id, out2.Id)
		s.Require().Equal(mockUser2.Username, out2.Username)
		s.Require().Equal(mockUser2.Email, out2.Email)
		s.Require().Equal("channel_user channel_admin", out2.Roles)
	})

	s.Run("List all users of a channel with the --all flag", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()
		err := cmd.Flags().Set("all", "true")
		s.Require().NoError(err)

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		// The --all flag must keep paging until an empty page is returned,
		// accumulating members across every non-empty page.
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(model.ChannelMembers{member1, member2}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 1, DefaultPageSize, "").
			Return(model.ChannelMembers{member3}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 2, DefaultPageSize, "").
			Return(model.ChannelMembers{}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{mockUser.Id, mockUser2.Id, mockUser3.Id}).
			Return([]*model.User{&mockUser, &mockUser2, &mockUser3}, &model.Response{}, nil).
			Times(1)

		err = channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 3)
		s.Require().Len(printer.GetErrorLines(), 0)

		s.Require().Equal(mockUser.Id, printer.GetLines()[0].(channelUserOut).Id)
		s.Require().Equal(mockUser2.Id, printer.GetLines()[1].(channelUserOut).Id)
		s.Require().Equal(mockUser3.Id, printer.GetLines()[2].(channelUserOut).Id)
	})

	s.Run("List users with custom --page and --per-page", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()
		s.Require().NoError(cmd.Flags().Set("page", "2"))
		s.Require().NoError(cmd.Flags().Set("per-page", "50"))

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		// The --page and --per-page flags must be threaded through to the API call.
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 2, 50, "").
			Return(model.ChannelMembers{member1}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{mockUser.Id}).
			Return([]*model.User{&mockUser}, &model.Response{}, nil).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(mockUser.Id, printer.GetLines()[0].(channelUserOut).Id)
	})

	s.Run("List users renders id, username, email and roles in plain output", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		defer printer.SetFormat(printer.FormatJSON)
		cmd := channelUsersListTestCmd()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(model.ChannelMembers{member2}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{mockUser2.Id}).
			Return([]*model.User{&mockUser2}, &model.Response{}, nil).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		expected := fmt.Sprintf("%s: %s (%s) %s", mockUser2.Id, mockUser2.Username, mockUser2.Email, member2.Roles)
		s.Require().Equal(expected, printer.GetLines()[0])
	})

	s.Run("List users when a member's user details are missing", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(model.ChannelMembers{member1, member2}, &model.Response{}, nil).
			Times(1)
		// GetUsersByIds omits member2's user (e.g. deactivated/deleted).
		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{mockUser.Id, mockUser2.Id}).
			Return([]*model.User{&mockUser}, &model.Response{}, nil).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2)

		out1 := printer.GetLines()[0].(channelUserOut)
		s.Require().Equal(mockUser.Id, out1.Id)
		s.Require().Equal(mockUser.Username, out1.Username)
		s.Require().Equal(mockUser.Email, out1.Email)

		// The row for the missing user still lists its id and roles, with empty username/email.
		out2 := printer.GetLines()[1].(channelUserOut)
		s.Require().Equal(mockUser2.Id, out2.Id)
		s.Require().Equal("channel_user channel_admin", out2.Roles)
		s.Require().Empty(out2.Username)
		s.Require().Empty(out2.Email)
	})

	s.Run("List all users when fetching members fails", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()
		s.Require().NoError(cmd.Flags().Set("all", "true"))

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().ErrorContains(err, "unable to list users")
		s.Require().ErrorContains(err, channelName)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("List users of a nonexistent channel", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel %q", channelArg))
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("List users of an empty channel", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(model.ChannelMembers{}, &model.Response{}, nil).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("No users found", printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("List users when fetching members fails", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().ErrorContains(err, "unable to list users")
		s.Require().ErrorContains(err, channelName)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("List users when fetching user details fails", func() {
		printer.Clean()
		cmd := channelUsersListTestCmd()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(model.ChannelMembers{member1}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{mockUser.Id}).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := channelUsersListCmdF(s.client, cmd, []string{channelArg})
		s.Require().ErrorContains(err, "unable to retrieve user details")
		s.Require().ErrorContains(err, channelName)
		s.Require().Len(printer.GetLines(), 0)
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
			GetTeam(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.TODO(), foundChannel.Id, mockUser.Id).
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
			GetTeam(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), foundChannel.Id, 0, 10000, "").
			Return(mockChannelMembers, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.TODO(), foundChannel.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.TODO(), foundChannel.Id, mockUser2.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.TODO(), foundChannel.Id, mockUser3.Id).
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
			GetTeam(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userEmail, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), mockUser2.Email, "").
			Return(&mockUser2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.TODO(), foundChannel.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.TODO(), foundChannel.Id, mockUser2.Id).
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
			GetTeam(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), foundChannel.Id, 0, 10000, "").
			Return(mockChannelMembers, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.TODO(), foundChannel.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusNotFound}, errors.New("mock error")).
			Times(1)

		err := channelUsersRemoveCmdF(s.client, cmd, args)
		s.Require().ErrorContains(err, "unable to remove")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("should remove user from channel throws error", func() {
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
			GetTeam(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveUserFromChannel(context.TODO(), foundChannel.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusNotFound}, errors.New("mock error")).
			Times(1)

		err := channelUsersRemoveCmdF(s.client, cmd, args)
		s.Require().ErrorContains(err, "unable to remove")
		s.Require().ErrorContains(err, userEmail)
		s.Require().ErrorContains(err, channelName)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})
}
