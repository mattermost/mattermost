// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestListCommandCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("List commands for a non existing team", func(c client.Client) {
		printer.Clean()

		nonexistentTeamID := "nonexistent-team-id"

		err := listCommandCmdF(c, &cobra.Command{}, []string{nonexistentTeamID})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Unable to find team '"+nonexistentTeamID+"'", printer.GetErrorLines()[0])
	})

	s.RunForAllClients("List commands for a specific team", func(c client.Client) {
		printer.Clean()

		team, appErr := s.th.App.CreateTeam(s.th.Context, &model.Team{
			DisplayName: "dn_" + model.NewId(),
			Name:        api4.GenerateTestTeamName(),
			Email:       s.th.BasicUser.Email,
			Type:        model.TeamOpen,
		})
		s.Require().Nil(appErr)

		_, _, appErr = s.th.App.AddUserToTeam(s.th.Context, team.Id, s.th.BasicUser.Id, "")
		s.Require().Nil(appErr)

		command, appErr := s.th.App.CreateCommand(&model.Command{
			DisplayName: "command",
			CreatorId:   s.th.BasicUser.Id,
			TeamId:      team.Id,
			URL:         "http://localhost:8000/example",
			Method:      model.CommandMethodGet,
			Trigger:     "trigger",
		})
		s.Require().Nil(appErr)
		defer func() {
			appErr = s.th.App.DeleteCommand(command.Id)
			s.Require().Nil(appErr)
		}()

		err := listCommandCmdF(c, &cobra.Command{}, []string{team.Id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(command, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("List all commands from all teams", func() {
		// add team1
		team1, appErr := s.th.App.CreateTeam(s.th.Context, &model.Team{
			DisplayName: "dn_" + model.NewId(),
			Name:        api4.GenerateTestTeamName(),
			Email:       s.th.BasicUser.Email,
			Type:        model.TeamOpen,
		})
		s.Require().Nil(appErr)

		_, _, appErr = s.th.App.AddUserToTeam(s.th.Context, team1.Id, s.th.BasicUser.Id, "")
		s.Require().Nil(appErr)

		command1, appErr := s.th.App.CreateCommand(&model.Command{
			DisplayName: "command1",
			CreatorId:   s.th.BasicUser.Id,
			TeamId:      team1.Id,
			URL:         "http://localhost:8000/example",
			Method:      model.CommandMethodGet,
			Trigger:     "trigger",
		})
		s.Require().Nil(appErr)
		defer func() {
			appErr = s.th.App.DeleteCommand(command1.Id)
			s.Require().Nil(appErr)
		}()

		// add team 2
		team2, appErr := s.th.App.CreateTeam(s.th.Context, &model.Team{
			DisplayName: "dn_" + model.NewId(),
			Name:        api4.GenerateTestTeamName(),
			Email:       s.th.BasicUser.Email,
			Type:        model.TeamOpen,
		})
		s.Require().Nil(appErr)

		_, _, appErr = s.th.App.AddUserToTeam(s.th.Context, team2.Id, s.th.BasicUser.Id, "")
		s.Require().Nil(appErr)

		command2, appErr := s.th.App.CreateCommand(&model.Command{
			DisplayName: "command2",
			CreatorId:   s.th.BasicUser.Id,
			TeamId:      team2.Id,
			URL:         "http://localhost:8000/example",
			Method:      model.CommandMethodGet,
			Trigger:     "trigger",
		})
		s.Require().Nil(appErr)
		defer func() {
			appErr = s.th.App.DeleteCommand(command2.Id)
			s.Require().Nil(appErr)
		}()

		s.RunForSystemAdminAndLocal("Run list command", func(c client.Client) {
			printer.Clean()

			err := listCommandCmdF(c, &cobra.Command{}, []string{})
			s.Require().Nil(err)
			s.Len(printer.GetLines(), 2)
			s.ElementsMatch([]*model.Command{command1, command2}, printer.GetLines())
			s.Len(printer.GetErrorLines(), 0)
		})
	})

	s.Run("List commands for a specific team without permission", func() {
		printer.Clean()

		team, appErr := s.th.App.CreateTeam(s.th.Context, &model.Team{
			DisplayName: "dn_" + model.NewId(),
			Name:        api4.GenerateTestTeamName(),
			Email:       s.th.BasicUser.Email,
			Type:        model.TeamOpen,
		})
		s.Require().Nil(appErr)

		command, appErr := s.th.App.CreateCommand(&model.Command{
			DisplayName: "command",
			CreatorId:   s.th.BasicUser.Id,
			TeamId:      team.Id,
			URL:         "http://localhost:8000/example",
			Method:      model.CommandMethodGet,
			Trigger:     "trigger",
		})
		s.Require().Nil(appErr)
		defer func() {
			appErr = s.th.App.DeleteCommand(command.Id)
			s.Require().Nil(appErr)
		}()

		err := listCommandCmdF(s.th.Client, &cobra.Command{}, []string{team.Id})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Unable to find team '"+team.Id+"'", printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestArchiveCommandCmdF() {
	s.SetupTestHelper().InitBasic()

	teamOfBasicUser, appErr := s.th.App.CreateTeam(s.th.Context, &model.Team{
		DisplayName: "dn_" + model.NewId(),
		Name:        api4.GenerateTestTeamName(),
		Email:       s.th.BasicUser.Email,
		Type:        model.TeamOpen,
	})
	s.Require().Nil(appErr)

	_, _, appErr = s.th.App.AddUserToTeam(s.th.Context, teamOfBasicUser.Id, s.th.BasicUser.Id, "")
	s.Require().Nil(appErr)

	s.RunForAllClients("Archive nonexistent command", func(c client.Client) {
		printer.Clean()

		nonexistentCommandID := "nonexistent-command-id"

		err := archiveCommandCmdF(c, &cobra.Command{}, []string{nonexistentCommandID})
		s.Require().NotNil(err)
		s.Require().Equal(fmt.Sprintf("Unable to archive command '%s' error: Sorry, we could not find the page., There doesn't appear to be an api call for the url='/api/v4/commands/nonexistent-command-id'.  Typo? are you missing a team_id or user_id as part of the url?", nonexistentCommandID), err.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForAllClients("Archive command", func(c client.Client) {
		printer.Clean()

		command, appErr := s.th.App.CreateCommand(&model.Command{
			TeamId:      teamOfBasicUser.Id,
			DisplayName: "command",
			Description: "command",
			Trigger:     api4.GenerateTestID(),
			URL:         "http://localhost:8000/example",
			CreatorId:   s.th.BasicUser.Id,
			Username:    s.th.BasicUser.Username,
			IconURL:     "http://localhost:8000/icon.ico",
			Method:      model.CommandMethodGet,
		})
		s.Require().Nil(appErr)

		err := archiveCommandCmdF(c, &cobra.Command{}, []string{command.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(map[string]any{"status": "ok"}, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)

		rcommand, err := s.th.App.GetCommand(command.Id)
		s.Require().NotNil(err)
		s.Require().Nil(rcommand)
		s.Require().Contains(err.Error(), "SqlCommandStore.Get: Command does not exist., ")
	})

	s.Run("Archive command without permission", func() {
		printer.Clean()

		teamOfAdminUser, appErr := s.th.App.CreateTeam(s.th.Context, &model.Team{
			DisplayName: "dn_" + model.NewId(),
			Name:        api4.GenerateTestTeamName(),
			Email:       s.th.SystemAdminUser.Email,
			Type:        model.TeamOpen,
		})
		s.Require().Nil(appErr)

		command, appErr := s.th.App.CreateCommand(&model.Command{
			TeamId:      teamOfAdminUser.Id,
			DisplayName: "command",
			Description: "command",
			Trigger:     api4.GenerateTestID(),
			URL:         "http://localhost:8000/example",
			CreatorId:   s.th.SystemAdminUser.Id,
			Username:    s.th.SystemAdminUser.Username,
			IconURL:     "http://localhost:8000/icon.ico",
			Method:      model.CommandMethodGet,
		})
		s.Require().Nil(appErr)

		err := archiveCommandCmdF(s.th.Client, &cobra.Command{}, []string{command.Id})
		s.Require().NotNil(err)
		s.Require().Equal(fmt.Sprintf("Unable to archive command '%s' error: Unable to get the command.", command.Id), err.Error())

		rcommand, err := s.th.App.GetCommand(command.Id)
		s.Require().Nil(err)
		s.Require().NotNil(rcommand)
		s.Require().Equal(int64(0), rcommand.DeleteAt)
	})
}

func (s *MmctlE2ETestSuite) TestModifyCommandCmdF() {
	s.SetupTestHelper().InitBasic()

	// create new command
	newCmd := &model.Command{
		CreatorId: s.th.BasicUser.Id,
		TeamId:    s.th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger",
	}

	command, _, _ := s.th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	index := 0
	s.RunForSystemAdminAndLocal("modifyCommandCmdF", func(c client.Client) {
		printer.Clean()

		// Reset the cmd and parse to force Flag.Changed to be true.
		cmd := CommandModifyCmd
		cmd.ResetFlags()
		addCommandFieldsFlags(cmd)
		url := fmt.Sprintf("%s-%d", command.URL, index)
		index++
		err := cmd.ParseFlags([]string{
			command.Id,
			"--url=" + url,
		})
		s.Require().Nil(err)

		err = modifyCommandCmdF(c, cmd, []string{command.Id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)

		changedCommand, err := s.th.App.GetCommand(command.Id)
		s.Require().Nil(err)
		s.Require().Equal(url, changedCommand.URL)
	})

	s.RunForSystemAdminAndLocal("modifyCommandCmdF for command that does not exist", func(c client.Client) {
		printer.Clean()
		cmd := &cobra.Command{}

		err := modifyCommandCmdF(c, cmd, []string{"nothing"})
		s.Require().NotNil(err)
		s.Require().Equal("unable to find command 'nothing'", err.Error())
	})

	s.RunForSystemAdminAndLocal("modifyCommandCmdF with a space in trigger word", func(c client.Client) {
		printer.Clean()
		// Reset the cmd and parse to force Flag.Changed to be true.
		cmd := CommandModifyCmd
		cmd.ResetFlags()
		addCommandFieldsFlags(cmd)
		err := cmd.ParseFlags([]string{
			command.Id,
			"--trigger-word=modified with space",
		})
		s.Require().Nil(err)

		err = modifyCommandCmdF(c, cmd, []string{command.Id})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "a trigger word must not contain spaces")
	})
}
