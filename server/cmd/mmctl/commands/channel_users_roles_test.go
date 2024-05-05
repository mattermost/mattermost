// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestChannelUsersRolesAddCmdF() {
	channelArg := teamName + ":" + channelName
	mockRole := "scheme_admin,scheme_user,scheme_guest"
	successMessage := "Successfully updated member roles"

	s.Run("Not enough command line parameters", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		err := channelUsersRolesAddCmdF(s.client, cmd, []string{channelArg})
		s.EqualError(err, "not enough arguments")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Channel doesn't exist", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		missingChannel := "missingchannel"
		channelDoesntExist := teamName + ":" + missingChannel

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), missingChannel, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), missingChannel, teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := channelUsersRolesAddCmdF(s.client, cmd, []string{channelDoesntExist, userEmail, mockRole})
		s.EqualError(err, "unable to find channel "+channelDoesntExist)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Role doesnt exist", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		missingRole := "missing_role"

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
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		err := channelUsersRolesAddCmdF(s.client, cmd, []string{channelArg, userEmail, missingRole})
		s.EqualError(err, "role doesn't exist: "+missingRole)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("User doesn't exist", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		userDoesntExist := "doesntexist@email.com"

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
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userDoesntExist, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := channelUsersRolesAddCmdF(s.client, cmd, []string{channelArg, userDoesntExist, mockRole})
		s.EqualError(err, "1 error occurred:\n\t* user doesn't exist: "+userDoesntExist+"\n\n")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Two users one doesn't exist", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		userDoesntExist := "doesntexist@email.com"

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

		foundUser := &model.User{
			Id:    userID,
			Email: userEmail,
		}

		foundChannelMember := &model.ChannelMember{
			ChannelId:   channelID,
			UserId:      userID,
			SchemeGuest: false,
			SchemeUser:  false,
			SchemeAdmin: false,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userEmail, "").
			Return(foundUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMember(context.TODO(), channelID, userID, "").
			Return(foundChannelMember, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userDoesntExist, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := channelUsersRolesAddCmdF(s.client, cmd, []string{channelArg, userEmail + "," + userDoesntExist, mockRole})
		s.EqualError(err, "1 error occurred:\n\t* user doesn't exist: "+userDoesntExist+"\n\n")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("User isn't member of channel", func() {
		printer.Clean()
		cmd := &cobra.Command{}

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

		foundUser := &model.User{
			Id:    userID,
			Email: userEmail,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userEmail, "").
			Return(foundUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMember(context.TODO(), channelID, userID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := channelUsersRolesAddCmdF(s.client, cmd, []string{channelArg, userEmail, mockRole})
		s.EqualError(err, "1 error occurred:\n\t* user is not member of channel: "+userEmail+"\n\n")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Successful update with one user", func() {
		printer.Clean()
		cmd := &cobra.Command{}

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

		foundUser := &model.User{
			Id:    userID,
			Email: userEmail,
		}

		foundChannelMember := &model.ChannelMember{
			ChannelId:   channelID,
			UserId:      userID,
			SchemeGuest: false,
			SchemeUser:  false,
			SchemeAdmin: false,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userEmail, "").
			Return(foundUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMember(context.TODO(), channelID, userID, "").
			Return(foundChannelMember, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelMemberSchemeRoles(context.TODO(), channelID, userID, &model.SchemeRoles{
				SchemeAdmin: true,
				SchemeUser:  true,
				SchemeGuest: true,
			}).
			Return(&model.Response{}, nil).
			Times(1)

		err := channelUsersRolesAddCmdF(s.client, cmd, []string{channelArg, userEmail, mockRole})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], successMessage)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Successful update with multiple users", func() {
		printer.Clean()
		cmd := &cobra.Command{}

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

		foundUser := &model.User{
			Id:    userID,
			Email: userEmail,
		}

		foundUser2 := &model.User{
			Id:    model.NewId(),
			Email: "foundUser2@email.com",
		}

		foundChannelMember2 := &model.ChannelMember{
			ChannelId:   channelID,
			UserId:      foundUser2.Id,
			SchemeGuest: false,
			SchemeUser:  false,
			SchemeAdmin: false,
		}

		foundChannelMember := &model.ChannelMember{
			ChannelId:   channelID,
			UserId:      userID,
			SchemeGuest: false,
			SchemeUser:  false,
			SchemeAdmin: false,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), userEmail, "").
			Return(foundUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMember(context.TODO(), channelID, userID, "").
			Return(foundChannelMember, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), foundUser2.Email, "").
			Return(foundUser2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMember(context.TODO(), channelID, foundUser2.Id, "").
			Return(foundChannelMember2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelMemberSchemeRoles(context.TODO(), channelID, userID, &model.SchemeRoles{
				SchemeAdmin: true,
				SchemeUser:  true,
				SchemeGuest: true,
			}).
			Return(&model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelMemberSchemeRoles(context.TODO(), channelID, foundUser2.Id, &model.SchemeRoles{
				SchemeAdmin: true,
				SchemeUser:  true,
				SchemeGuest: true,
			}).
			Return(&model.Response{}, nil).
			Times(1)

		err := channelUsersRolesAddCmdF(s.client, cmd, []string{channelArg, userEmail + "," + foundUser2.Email, mockRole})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], successMessage)
		s.Len(printer.GetErrorLines(), 0)
	})
}
