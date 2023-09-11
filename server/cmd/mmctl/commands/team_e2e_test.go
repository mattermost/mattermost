// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestRenameTeamCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("Error renaming team which does not exist", func(c client.Client) {
		printer.Clean()
		nonExistentTeamName := "existingName"
		cmd := &cobra.Command{}
		args := []string{nonExistentTeamName}
		cmd.Flags().String("display-name", "newDisplayName", "Team Display Name")

		err := renameTeamCmdF(c, cmd, args)
		s.Require().EqualError(err, "Unable to find team 'existingName', to see the all teams try 'team list' command")
	})

	s.RunForSystemAdminAndLocal("Rename an existing team", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		args := []string{s.th.BasicTeam.Name}
		cmd.Flags().String("display-name", "newDisplayName", "Team Display Name")

		err := renameTeamCmdF(c, cmd, args)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal("'"+s.th.BasicTeam.Name+"' team renamed", printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Permission error renaming an existing team", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		args := []string{s.th.BasicTeam.Name}
		cmd.Flags().String("display-name", "newDisplayName", "Team Display Name")

		err := renameTeamCmdF(s.th.Client, cmd, args)
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.ErrorContains(err, "Cannot rename team '"+s.th.BasicTeam.Name+"', error : : You do not have the appropriate permissions.")
	})
}

func (s *MmctlE2ETestSuite) TestDeleteTeamsCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("Error deleting team which does not exist", func(c client.Client) {
		printer.Clean()
		nonExistentName := "existingName"
		cmd := &cobra.Command{}
		args := []string{nonExistentName}
		cmd.Flags().String("display-name", "newDisplayName", "Team Display Name")
		cmd.Flags().Bool("confirm", true, "")

		_ = deleteTeamsCmdF(c, cmd, args)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to find team '"+nonExistentName+"'", printer.GetErrorLines()[0])
	})

	s.Run("Permission error while deleting a valid team", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		args := []string{s.th.BasicTeam.Name}
		cmd.Flags().String("display-name", "newDisplayName", "Team Display Name")
		cmd.Flags().Bool("confirm", true, "")

		_ = deleteTeamsCmdF(s.th.Client, cmd, args)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to delete team '"+s.th.BasicTeam.Name+"' error: : You do not have the appropriate permissions.", printer.GetErrorLines()[0])
		team, _ := s.th.App.GetTeam(s.th.BasicTeam.Id)
		s.Equal(team.Name, s.th.BasicTeam.Name)
	})

	s.RunForSystemAdminAndLocal("Delete a valid team", func(c client.Client) {
		printer.Clean()

		teamName := "teamname" + model.NewRandomString(10)
		teamDisplayname := "Mock Display Name"
		cmd := &cobra.Command{}
		cmd.Flags().String("name", teamName, "")
		cmd.Flags().String("display-name", teamDisplayname, "")
		err := createTeamCmdF(s.th.LocalClient, cmd, []string{})
		s.Require().Nil(err)

		cmd = &cobra.Command{}
		args := []string{teamName}
		cmd.Flags().String("display-name", "newDisplayName", "Team Display Name")
		cmd.Flags().Bool("confirm", true, "")

		// Set EnableAPITeamDeletion
		enableConfig := true
		config, _, _ := c.GetConfig(context.TODO())
		config.ServiceSettings.EnableAPITeamDeletion = &enableConfig
		_, _, _ = c.UpdateConfig(context.TODO(), config)

		// Deletion should succeed for both local and SystemAdmin client now
		err = deleteTeamsCmdF(c, cmd, args)
		s.Require().Nil(err)
		team := printer.GetLines()[0].(*model.Team)
		s.Equal(teamName, team.Name)
		s.Len(printer.GetErrorLines(), 0)

		// Reset config
		enableConfig = false
		config, _, _ = c.GetConfig(context.TODO())
		config.ServiceSettings.EnableAPITeamDeletion = &enableConfig
		_, _, _ = c.UpdateConfig(context.TODO(), config)
	})

	s.Run("Permission denied error for system admin when deleting a valid team", func() {
		printer.Clean()

		args := []string{s.th.BasicTeam.Name}
		cmd := &cobra.Command{}
		cmd.Flags().String("display-name", "newDisplayName", "Team Display Name")
		cmd.Flags().Bool("confirm", true, "")

		// Delete should fail for SystemAdmin client
		err := deleteTeamsCmdF(s.th.SystemAdminClient, cmd, args)
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Unable to delete team '"+s.th.BasicTeam.Name+"' error: : Permanent team deletion feature is not enabled. Please contact your System Administrator.", printer.GetErrorLines()[0])

		// verify team still exists
		team, _ := s.th.App.GetTeam(s.th.BasicTeam.Id)
		s.Equal(team.Name, s.th.BasicTeam.Name)

		// Delete should succeed for local client
		printer.Clean()
		err = deleteTeamsCmdF(s.th.LocalClient, cmd, args)
		s.Require().Nil(err)
		team = printer.GetLines()[0].(*model.Team)
		s.Equal(team.Name, s.th.BasicTeam.Name)
		s.Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestModifyTeamsCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("system & local accounts can set a team to private", func(c client.Client) {
		printer.Clean()
		teamID := s.th.BasicTeam.Id
		cmd := &cobra.Command{}
		cmd.Flags().Bool("private", true, "")
		err := modifyTeamsCmdF(c, cmd, []string{teamID})
		s.Require().NoError(err)

		s.Require().Equal(model.TeamInvite, printer.GetLines()[0].(*model.Team).Type)
		// teardown
		appErr := s.th.App.UpdateTeamPrivacy(teamID, model.TeamOpen, true)
		s.Require().Nil(appErr)
		t, err := s.th.App.GetTeam(teamID)
		s.Require().Nil(err)
		s.Require().Equal(model.TeamOpen, t.Type)
	})

	s.Run("user that creates the team can't set team's privacy due to permissions", func() {
		printer.Clean()
		teamID := s.th.BasicTeam.Id
		cmd := &cobra.Command{}
		cmd.Flags().Bool("private", true, "")
		err := modifyTeamsCmdF(s.th.Client, cmd, []string{teamID})
		s.Require().NoError(err)
		s.Require().Contains(
			printer.GetErrorLines()[0],
			fmt.Sprintf("Unable to modify team '%s' error: : You do not have the appropriate permissions.", s.th.BasicTeam.Name),
		)
		t, appErr := s.th.App.GetTeam(teamID)
		s.Require().Nil(appErr)
		s.Require().Equal(model.TeamOpen, t.Type)
	})

	s.Run("basic user with normal permissions that hasn't created the team can't set team's privacy", func() {
		printer.Clean()
		teamID := s.th.BasicTeam.Id
		cmd := &cobra.Command{}
		cmd.Flags().Bool("private", true, "")
		s.th.LoginBasic2()
		err := modifyTeamsCmdF(s.th.Client, cmd, []string{teamID})
		s.Require().NoError(err)
		s.Require().Contains(
			printer.GetErrorLines()[0],
			fmt.Sprintf("Unable to modify team '%s' error: : You do not have the appropriate permissions.", s.th.BasicTeam.Name),
		)
		t, appErr := s.th.App.GetTeam(teamID)
		s.Require().Nil(appErr)
		s.Require().Equal(model.TeamOpen, t.Type)
	})
}

func (s *MmctlE2ETestSuite) TestTeamCreateCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("Should not create a team w/o name", func(c client.Client) {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().String("display-name", "somedisplayname", "")

		err := createTeamCmdF(c, cmd, []string{})
		s.EqualError(err, "name is required")
		s.Require().Empty(printer.GetLines())
	})

	s.RunForAllClients("Should not create a team w/o display-name", func(c client.Client) {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().String("name", model.NewId(), "")

		err := createTeamCmdF(c, cmd, []string{})
		s.EqualError(err, "display Name is required")
		s.Require().Empty(printer.GetLines())
	})

	s.Run("Should create a new team w/ email using LocalClient", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		teamName := model.NewId()
		cmd.Flags().String("name", teamName, "")
		cmd.Flags().String("display-name", "somedisplayname", "")
		email := "someemail@example.com"
		cmd.Flags().String("email", email, "")

		err := createTeamCmdF(s.th.LocalClient, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		newTeam, err := s.th.App.GetTeamByName(teamName)
		s.Require().Nil(err)
		s.Equal(email, newTeam.Email)
	})

	s.Run("Should create a new team w/ assigned email using SystemAdminClient", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		teamName := model.NewId()
		cmd.Flags().String("name", teamName, "")
		cmd.Flags().String("display-name", "somedisplayname", "")
		email := "someemail@example.com"
		cmd.Flags().String("email", email, "")

		err := createTeamCmdF(s.th.SystemAdminClient, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		newTeam, err := s.th.App.GetTeamByName(teamName)
		s.Require().Nil(err)
		s.NotEqual(email, newTeam.Email)
	})

	s.Run("Should create a new team w/ assigned email using Client", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		teamName := model.NewId()
		cmd.Flags().String("name", teamName, "")
		cmd.Flags().String("display-name", "somedisplayname", "")
		email := "someemail@example.com"
		cmd.Flags().String("email", email, "")

		err := createTeamCmdF(s.th.Client, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		newTeam, err := s.th.App.GetTeamByName(teamName)
		s.Require().Nil(err)
		s.NotEqual(email, newTeam.Email)
	})

	s.RunForAllClients("Should create a new open team", func(c client.Client) {
		printer.Clean()
		cmd := &cobra.Command{}
		teamName := model.NewId()
		cmd.Flags().String("name", teamName, "")
		cmd.Flags().String("display-name", "somedisplayname", "")

		err := createTeamCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		newTeam, err := s.th.App.GetTeamByName(teamName)
		s.Require().Nil(err)
		s.Equal(newTeam.Type, model.TeamOpen)
		s.Equal(newTeam.AllowOpenInvite, true)
	})

	s.RunForAllClients("Should create a new private team", func(c client.Client) {
		printer.Clean()
		cmd := &cobra.Command{}
		teamName := model.NewId()
		cmd.Flags().String("name", teamName, "")
		cmd.Flags().String("display-name", "somedisplayname", "")
		cmd.Flags().Bool("private", true, "")

		err := createTeamCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		newTeam, err := s.th.App.GetTeamByName(teamName)
		s.Require().Nil(err)
		s.Equal(newTeam.Type, model.TeamInvite)
		s.Equal(newTeam.AllowOpenInvite, false)
	})
}

func (s *MmctlE2ETestSuite) TestSearchTeamCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("Search for existing team", func(c client.Client) {
		printer.Clean()

		err := searchTeamCmdF(c, &cobra.Command{}, []string{s.th.BasicTeam.Name})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		team := printer.GetLines()[0].(*model.Team)
		s.Equal(s.th.BasicTeam.Name, team.Name)
	})

	s.Run("Search for existing team with Client", func() {
		printer.Clean()

		err := searchTeamCmdF(s.th.Client, &cobra.Command{}, []string{s.th.BasicTeam.Name})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Unable to find team '"+s.th.BasicTeam.Name+"'", printer.GetErrorLines()[0])
	})

	s.RunForAllClients("Search of nonexistent team", func(c client.Client) {
		printer.Clean()

		teamnameArg := "nonexistentteam"
		err := searchTeamCmdF(c, &cobra.Command{}, []string{teamnameArg})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Unable to find team '"+teamnameArg+"'", printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestArchiveTeamsCmd() {
	s.SetupTestHelper().InitBasic()

	cmd := &cobra.Command{}
	cmd.Flags().Bool("confirm", true, "Confirm you really want to archive the team and a DB backup has been performed.")

	s.RunForAllClients("Archive nonexistent team", func(c client.Client) {
		printer.Clean()

		err := archiveTeamsCmdF(c, cmd, []string{"unknown-team"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to find team 'unknown-team'", printer.GetErrorLines()[0])
	})

	s.RunForSystemAdminAndLocal("Archive basic team", func(c client.Client) {
		printer.Clean()

		err := archiveTeamsCmdF(c, cmd, []string{s.th.BasicTeam.Name})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		team := printer.GetLines()[0].(*model.Team)
		s.Require().Equal(s.th.BasicTeam.Name, team.Name)
		s.Require().Len(printer.GetErrorLines(), 0)

		basicTeam, err := s.th.App.GetTeam(s.th.BasicTeam.Id)
		s.Require().Nil(err)
		s.Require().NotZero(basicTeam.DeleteAt)

		err = s.th.App.RestoreTeam(s.th.BasicTeam.Id)
		s.Require().Nil(err)
	})

	s.Run("Archive team without permissions", func() {
		printer.Clean()

		err := archiveTeamsCmdF(s.th.Client, cmd, []string{s.th.BasicTeam.Name})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], "You do not have the appropriate permissions.")

		basicTeam, err := s.th.App.GetTeam(s.th.BasicTeam.Id)
		s.Require().Nil(err)
		s.Require().Zero(basicTeam.DeleteAt)
	})
}

func (s *MmctlE2ETestSuite) TestListTeamsCmdF() {
	s.SetupTestHelper().InitBasic()
	mockTeamName := "mockteam" + model.NewId()
	mockTeamDisplayname := "mockteam_display"
	_, err := s.th.App.CreateTeam(s.th.Context, &model.Team{Name: mockTeamName, DisplayName: mockTeamDisplayname, Type: model.TeamOpen, DeleteAt: 1})
	s.Require().Nil(err)

	s.RunForSystemAdminAndLocal("Should print both active and archived teams for syasdmin and local clients", func(c client.Client) {
		printer.Clean()

		err := listTeamsCmdF(c, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 2)
		team := printer.GetLines()[0].(*model.Team)
		s.Equal(s.th.BasicTeam.Name, team.Name)

		archivedTeam := printer.GetLines()[1].(*model.Team)
		s.Equal(mockTeamName, archivedTeam.Name)
	})

	s.Run("Should not list teams for Client", func() {
		printer.Clean()

		err := listTeamsCmdF(s.th.Client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestRestoreTeamsCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("Restore team", func(c client.Client) {
		printer.Clean()

		team := s.th.CreateTeam()
		appErr := s.th.App.SoftDeleteTeam(team.Id)
		s.Require().Nil(appErr)

		err := restoreTeamsCmdF(c, &cobra.Command{}, []string{team.Name})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Zero(printer.GetLines()[0].(*model.Team).DeleteAt)
	})

	s.RunForAllClients("Restore non-existent team", func(c client.Client) {
		printer.Clean()

		teamName := "non-existent-team"

		err := restoreTeamsCmdF(c, &cobra.Command{}, []string{teamName})
		var expected error
		errMessage := "unable to find team '" + teamName + "'"
		expected = multierror.Append(expected, errors.New(errMessage))

		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("Restore team without permissions", func() {
		printer.Clean()

		team := s.th.CreateTeamWithClient(s.th.SystemAdminClient)
		appErr := s.th.App.SoftDeleteTeam(team.Id)
		s.Require().Nil(appErr)

		err := restoreTeamsCmdF(s.th.Client, &cobra.Command{}, []string{team.Name})
		var expected error
		errMessage := "unable to find team '" + team.Name + "'"
		expected = multierror.Append(expected, errors.New(errMessage))

		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetErrorLines(), 1)
	})
}
