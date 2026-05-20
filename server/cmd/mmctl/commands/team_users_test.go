// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package commands

import (
	"context"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestTeamUsersArchiveCmd() {
	teamArg := "example-team-id"
	userArg := "example-user-id"

	s.Run("Remove users from team with a non-existent team returns an error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := teamUsersRemoveCmdF(s.client, &cobra.Command{}, []string{teamArg, userArg})
		s.Require().Equal(err.Error(), "Unable to find team '"+teamArg+"'")
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Remove users from team with a non-existent user returns an error", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: teamArg}
		mockUser := &model.User{Id: userArg}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), mockUser.Id, "").
			Return(nil, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), mockUser.Id, "").
			Return(nil, nil, nil).
			Times(1)

		err := teamUsersRemoveCmdF(s.client, &cobra.Command{}, []string{teamArg, mockUser.Id})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], "can't find user '"+userArg+"'")
	})

	s.Run("Remove users from team by email and get team by name should not return an error", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: teamArg}
		mockUser := &model.User{Id: userArg}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(nil, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamArg, "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), mockUser.Id, "").
			Return(mockUser, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveTeamMember(context.TODO(), mockTeam.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := teamUsersRemoveCmdF(s.client, &cobra.Command{}, []string{mockTeam.Id, mockUser.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Remove users from team by email and get team should not return an error", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: teamArg}
		mockUser := &model.User{Id: userArg}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), mockUser.Id, "").
			Return(mockUser, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveTeamMember(context.TODO(), mockTeam.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := teamUsersRemoveCmdF(s.client, &cobra.Command{}, []string{mockTeam.Id, mockUser.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Remove users from team by username and get team should not return an error", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: teamArg}
		mockUser := &model.User{Id: userArg}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), mockUser.Id, "").
			Return(mockUser, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveTeamMember(context.TODO(), mockTeam.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := teamUsersRemoveCmdF(s.client, &cobra.Command{}, []string{mockTeam.Id, mockUser.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Remove users from team by user and get team should not return an error", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: teamArg}
		mockUser := &model.User{Id: userArg}
		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), mockUser.Id, "").
			Return(nil, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), mockUser.Id, "").
			Return(mockUser, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveTeamMember(context.TODO(), mockTeam.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := teamUsersRemoveCmdF(s.client, &cobra.Command{}, []string{mockTeam.Id, mockUser.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Remove users from team with an erroneous RemoveTeamMember should return an error", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: teamArg, Name: "example-name"}
		mockUser := &model.User{Id: userArg}
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), mockUser.Id, "").
			Return(mockUser, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			RemoveTeamMember(context.TODO(), mockTeam.Id, mockUser.Id).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		err := teamUsersRemoveCmdF(s.client, &cobra.Command{}, []string{mockTeam.Id, mockUser.Id})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], "unable to remove '"+mockUser.Id+"' from "+mockTeam.Name+". Error: "+mockError.Error())
	})
}

func (s *MmctlUnitTestSuite) TestAddUsersCmd() {
	mockTeam := model.Team{
		Id:          "TeamId",
		Name:        "team1",
		DisplayName: "DisplayName",
	}
	mockUser := model.User{
		Id:       "UserID",
		Username: "ExampleUser",
		Email:    "example@example.com",
	}

	s.Run("Add users with a team that cannot be found returns error", func() {
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), "team1", "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), "team1", "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := teamUsersAddCmdF(s.client, cmd, []string{"team1", "user1"})
		s.Require().Equal(err.Error(), "Unable to find team 'team1'")
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Add users with nonexistent user in arguments prints error", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), "team1", "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), "user1", "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), "user1", "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := teamUsersAddCmdF(s.client, cmd, []string{"team1", "user1"})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().ErrorContains(err, "can't find user 'user1'")
	})

	s.Run("Add users should print error when cannot add team member", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), "team1", "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), "user1", "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		mockError := errors.New("cannot add team member")

		s.client.
			EXPECT().
			AddTeamMember(context.TODO(), "TeamId", "UserID").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := teamUsersAddCmdF(s.client, cmd, []string{"team1", "user1"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0],
			"Unable to add 'user1' to team1. Error: cannot add team member")
	})

	s.Run("Add users should not print in console anything on success", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		s.client.
			EXPECT().
			GetTeam(context.TODO(), "team1", "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), "user1", "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			AddTeamMember(context.TODO(), "TeamId", "UserID").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := teamUsersAddCmdF(s.client, cmd, []string{"team1", "user1"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}
