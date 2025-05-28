// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package commands

import (
	"fmt"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestTeamUserAddCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
	s.Require().Nil(appErr)

	team, appErr := s.th.App.CreateTeam(s.th.Context, &model.Team{
		DisplayName: "dn_" + model.NewId(),
		Name:        api4.GenerateTestTeamName(),
		Email:       s.th.GenerateTestEmail(),
		Type:        model.TeamOpen,
	})
	s.Require().Nil(appErr)

	unlinkUserFromTeam := func(teamId string, userId string) error {
		teamMembers, err := s.th.App.GetTeamMembers(teamId, 0, 10, nil)
		if err != nil {
			return err
		}
		var teamMember *model.TeamMember
		for _, v := range teamMembers {
			if v.UserId == userId {
				teamMember = v
				break
			}
		}
		if teamMember == nil {
			return nil
		}
		return s.th.App.RemoveUserFromTeam(s.th.Context, teamId, teamMember.UserId, s.th.SystemAdminUser.Id)
	}

	s.RunForSystemAdminAndLocal("Add user to team", func(c client.Client) {
		printer.Clean()

		appErr := unlinkUserFromTeam(team.Id, user.Id)
		s.Require().Nil(appErr)

		err := teamUsersAddCmdF(c, &cobra.Command{}, []string{team.Id, user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		teamMembers, err := s.th.App.GetTeamMembers(team.Id, 0, 10, nil)
		s.Require().Nil(err)
		s.Require().NotNil(teamMembers)
		s.Require().Len(teamMembers, 1)
		s.Require().Equal(user.Id, teamMembers[0].UserId)
	})

	s.Run("Add user to team without permissions", func() {
		printer.Clean()

		appErr := unlinkUserFromTeam(team.Id, user.Id)
		s.Require().Nil(appErr)

		err := teamUsersAddCmdF(s.th.Client, &cobra.Command{}, []string{team.Id, user.Email})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(fmt.Sprintf("Unable to find team '%s'", team.Id), err.Error())

		teamMembers, err := s.th.App.GetTeamMembers(team.Id, 0, 10, nil)
		s.Require().Nil(err)
		s.Require().Len(teamMembers, 0)
	})

	s.Run("Add user to team with permissions", func() {
		printer.Clean()

		appErr := unlinkUserFromTeam(team.Id, user.Id)
		s.Require().Nil(appErr)

		_, appErr = s.th.App.AddTeamMember(s.th.Context, team.Id, s.th.BasicUser.Id)
		s.Require().Nil(appErr)
		defer func() {
			appErr = unlinkUserFromTeam(team.Id, s.th.BasicUser.Id)
			s.Require().Nil(appErr)
		}()

		err := teamUsersAddCmdF(s.th.Client, &cobra.Command{}, []string{team.Id, user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		teamMembers, err := s.th.App.GetTeamMembers(team.Id, 0, 10, nil)
		s.Require().Nil(err)
		s.Require().NotNil(teamMembers)
		s.Require().Len(teamMembers, 2)

		var teamUsersID []string
		for _, v := range teamMembers {
			teamUsersID = append(teamUsersID, v.UserId)
		}
		s.Require().Contains(teamUsersID, user.Id)
	})

	s.RunForSystemAdminAndLocal("Add user to nonexistent team", func(c client.Client) {
		printer.Clean()

		appErr := unlinkUserFromTeam(team.Id, user.Id)
		s.Require().Nil(appErr)

		nonexistentTeamName := "nonexistent"
		err := teamUsersAddCmdF(c, &cobra.Command{}, []string{nonexistentTeamName, user.Email})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(fmt.Sprintf("Unable to find team '%s'", nonexistentTeamName), err.Error())
	})

	s.RunForSystemAdminAndLocal("Add nonexistent user to team", func(c client.Client) {
		printer.Clean()

		appErr := unlinkUserFromTeam(team.Id, user.Id)
		s.Require().Nil(appErr)

		nonexistentUserEmail := "nonexistent@email"
		var expectedError error
		expectedError = multierror.Append(expectedError, fmt.Errorf("can't find user '%s'", nonexistentUserEmail))
		err := teamUsersAddCmdF(c, &cobra.Command{}, []string{team.Id, nonexistentUserEmail})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().EqualError(err, expectedError.Error())
	})

	s.Run("Add nonexistent user to team", func() {
		printer.Clean()

		appErr := unlinkUserFromTeam(team.Id, user.Id)
		s.Require().Nil(appErr)

		_, appErr = s.th.App.AddTeamMember(s.th.Context, team.Id, s.th.BasicUser.Id)
		s.Require().Nil(appErr)
		defer func() {
			appErr = unlinkUserFromTeam(team.Id, s.th.BasicUser.Id)
			s.Require().Nil(appErr)
		}()

		nonexistentUserEmail := "nonexistent@email"
		var expectedError error
		expectedError = multierror.Append(expectedError, fmt.Errorf("can't find user '%s'", nonexistentUserEmail))
		err := teamUsersAddCmdF(s.th.Client, &cobra.Command{}, []string{team.Id, nonexistentUserEmail})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().EqualError(err, expectedError.Error())
	})
}

func (s *MmctlE2ETestSuite) TestTeamUsersRemoveCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("Remove user from team", func(c client.Client) {
		printer.Clean()

		user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
		s.Require().Nil(appErr)

		team := model.Team{
			DisplayName: "dn_" + model.NewId(),
			Name:        api4.GenerateTestTeamName(),
			Email:       s.th.GenerateTestEmail(),
			Type:        model.TeamOpen,
		}
		_, appErr = s.th.App.CreateTeamWithUser(s.th.Context, &team, user.Id)
		s.Require().Nil(appErr)

		err := teamUsersRemoveCmdF(c, &cobra.Command{}, []string{team.Name, user.Username})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		teamMembers, err := s.th.App.GetTeamMembers(team.Id, 0, 10, nil)
		s.Require().Nil(err)
		s.Require().NotNil(teamMembers)
		s.Require().Len(teamMembers, 0)
	})

	s.RunForSystemAdminAndLocal("Remove user from non-existent team", func(c client.Client) {
		printer.Clean()

		user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
		s.Require().Nil(appErr)

		nonexistentTeamName := model.NewId()
		err := teamUsersRemoveCmdF(c, &cobra.Command{}, []string{nonexistentTeamName, user.Username})
		s.Require().NotNil(err)
		s.Require().Equal(err.Error(), fmt.Sprintf("Unable to find team '%s'", nonexistentTeamName))
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Remove user from team without permissions", func() {
		printer.Clean()

		user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
		s.Require().Nil(appErr)

		team := model.Team{
			DisplayName: "dn_" + model.NewId(),
			Name:        api4.GenerateTestTeamName(),
			Email:       s.th.GenerateTestEmail(),
			Type:        model.TeamOpen,
		}
		_, appErr = s.th.App.CreateTeamWithUser(s.th.Context, &team, user.Id)
		s.Require().Nil(appErr)

		err := teamUsersRemoveCmdF(s.th.Client, &cobra.Command{}, []string{team.Name, user.Username})
		s.Require().NotNil(err)
		s.Require().Equal(err.Error(), fmt.Sprintf("Unable to find team '%s'", team.Name))
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}
