// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestCommandCreateCmd() {
	s.Run("Create a new custom slash command for a specified team", func() {
		printer.Clean()
		teamArg := "example-team-id"
		titleArg := "example-command-name"
		descriptionArg := "example-description-text"
		triggerWordArg := "example-trigger-word"
		urlArg := "http://localhost:8000/example"
		creatorIDArg := "example-user-id"
		creatorUsernameArg := "example-user"
		responseUsernameArg := "example-username2"
		iconArg := "icon-url"
		method := "G"
		autocomplete := false
		autocompleteDesc := "autocompleteDesc"
		autocompleteHint := "autocompleteHint"

		mockTeam := model.Team{Id: teamArg, Name: "TeamRed"}
		mockUser := model.User{Id: creatorIDArg, Username: creatorUsernameArg}
		mockCommand := model.Command{
			TeamId:           teamArg,
			DisplayName:      titleArg,
			Description:      descriptionArg,
			Trigger:          triggerWordArg,
			URL:              urlArg,
			CreatorId:        creatorIDArg,
			Username:         responseUsernameArg,
			IconURL:          iconArg,
			Method:           method,
			AutoComplete:     autocomplete,
			AutoCompleteDesc: autocompleteDesc,
			AutoCompleteHint: autocompleteHint,
		}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamArg, "")
		cmd.Flags().String("title", titleArg, "")
		cmd.Flags().String("description", descriptionArg, "")
		cmd.Flags().String("trigger-word", triggerWordArg, "")
		cmd.Flags().String("url", urlArg, "")
		cmd.Flags().String("creator", creatorIDArg, "")
		cmd.Flags().String("response-username", responseUsernameArg, "")
		cmd.Flags().String("icon", iconArg, "")
		cmd.Flags().String("method", method, "")
		cmd.Flags().Bool("autocomplete", autocomplete, "")
		cmd.Flags().String("autocompleteDesc", autocompleteDesc, "")
		cmd.Flags().String("autocompleteHint", autocompleteHint, "")

		// createCommandCmdF will call getTeamFromTeamArg,  getUserFromUserArg which then calls GetUserByEmail
		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), creatorIDArg, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			CreateCommand(context.Background(), &mockCommand).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)

		err := createCommandCmdF(s.client, cmd, []string{teamArg})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(&mockCommand, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Create a slash command only providing team, trigger word, url, creator", func() {
		printer.Clean()
		teamArg := "example-team-id"
		triggerWordArg := "example-trigger-word"
		urlArg := "http://localhost:8000/example"
		creatorIDArg := "example-user-id"
		creatorUsernameArg := "example-user"
		method := "G"

		mockTeam := model.Team{Id: teamArg}
		mockUser := model.User{Id: creatorIDArg, Username: creatorUsernameArg}
		mockCommand := model.Command{
			TeamId:    teamArg,
			Trigger:   triggerWordArg,
			URL:       urlArg,
			CreatorId: creatorIDArg,
			Method:    method,
		}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamArg, "")
		cmd.Flags().String("trigger-word", triggerWordArg, "")
		cmd.Flags().String("url", urlArg, "")
		cmd.Flags().String("creator", creatorIDArg, "")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), creatorIDArg, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			CreateCommand(context.Background(), &mockCommand).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)

		err := createCommandCmdF(s.client, cmd, []string{teamArg})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(&mockCommand, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Create slash command for a nonexistent team", func() {
		printer.Clean()
		teamArg := "example-team-id"
		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamArg, "")

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

		err := createCommandCmdF(s.client, cmd, []string{teamArg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "unable to find team '"+teamArg+"'")
	})

	s.Run("Create slash command with a space in trigger word", func() {
		printer.Clean()
		teamArg := "example-team-id"
		titleArg := "example-command-name"
		descriptionArg := "example-description-text"
		triggerWordArg := "example    trigger    word"
		urlArg := "http://localhost:8000/example"
		creatorIDArg := "example-user-id"
		creatorUsernameArg := "example-user"
		responseUsernameArg := "example-username2"
		iconArg := "icon-url"
		method := "G"
		autocomplete := false
		autocompleteDesc := "autocompleteDesc"
		autocompleteHint := "autocompleteHint"

		mockTeam := model.Team{Id: teamArg}
		mockUser := model.User{Id: creatorIDArg, Username: creatorUsernameArg}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamArg, "")
		cmd.Flags().String("title", titleArg, "")
		cmd.Flags().String("description", descriptionArg, "")
		cmd.Flags().String("trigger-word", triggerWordArg, "")
		cmd.Flags().String("url", urlArg, "")
		cmd.Flags().String("creator", creatorIDArg, "")
		cmd.Flags().String("response-username", responseUsernameArg, "")
		cmd.Flags().String("icon", iconArg, "")
		cmd.Flags().String("method", method, "")
		cmd.Flags().Bool("autocomplete", autocomplete, "")
		cmd.Flags().String("autocompleteDesc", autocompleteDesc, "")
		cmd.Flags().String("autocompleteHint", autocompleteHint, "")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), creatorIDArg, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		err := createCommandCmdF(s.client, cmd, []string{teamArg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "a trigger word must not contain spaces")
	})

	s.Run("Create slash command with trigger word prefixed with /", func() {
		printer.Clean()
		teamArg := "example-team-id"
		titleArg := "example-command-name"
		descriptionArg := "example-description-text"
		triggerWordArg := "/example-trigger-word"
		urlArg := "http://localhost:8000/example"
		creatorIDArg := "example-user-id"
		creatorUsernameArg := "example-user"
		responseUsernameArg := "example-username2"
		iconArg := "icon-url"
		method := "G"
		autocomplete := false
		autocompleteDesc := "autocompleteDesc"
		autocompleteHint := "autocompleteHint"

		mockTeam := model.Team{Id: teamArg}
		mockUser := model.User{Id: creatorIDArg, Username: creatorUsernameArg}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamArg, "")
		cmd.Flags().String("title", titleArg, "")
		cmd.Flags().String("description", descriptionArg, "")
		cmd.Flags().String("trigger-word", triggerWordArg, "")
		cmd.Flags().String("url", urlArg, "")
		cmd.Flags().String("creator", creatorIDArg, "")
		cmd.Flags().String("response-username", responseUsernameArg, "")
		cmd.Flags().String("icon", iconArg, "")
		cmd.Flags().String("method", method, "")
		cmd.Flags().Bool("autocomplete", autocomplete, "")
		cmd.Flags().String("autocompleteDesc", autocompleteDesc, "")
		cmd.Flags().String("autocompleteHint", autocompleteHint, "")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), creatorIDArg, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		err := createCommandCmdF(s.client, cmd, []string{teamArg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "a trigger word cannot begin with a /")
	})

	s.Run("Create slash command fail", func() {
		printer.Clean()
		teamArg := "example-team-id"
		titleArg := "example-command-name"
		descriptionArg := "example-description-text"
		triggerWordArg := "example-trigger-word"
		urlArg := "http://localhost:8000/example"
		creatorIDArg := "example-user-id"
		creatorUsernameArg := "example-user"
		responseUsernameArg := "example-username2"
		iconArg := "icon-url"
		method := "G"
		autocomplete := false
		autocompleteDesc := "autocompleteDesc"
		autocompleteHint := "autocompleteHint"

		mockTeam := model.Team{Id: teamArg}
		mockUser := model.User{Id: creatorIDArg, Username: creatorUsernameArg}
		mockCommand := model.Command{
			TeamId:           teamArg,
			DisplayName:      titleArg,
			Description:      descriptionArg,
			Trigger:          triggerWordArg,
			URL:              urlArg,
			CreatorId:        creatorIDArg,
			Username:         responseUsernameArg,
			IconURL:          iconArg,
			Method:           method,
			AutoComplete:     autocomplete,
			AutoCompleteDesc: autocompleteDesc,
			AutoCompleteHint: autocompleteHint,
		}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamArg, "")
		cmd.Flags().String("title", titleArg, "")
		cmd.Flags().String("description", descriptionArg, "")
		cmd.Flags().String("trigger-word", triggerWordArg, "")
		cmd.Flags().String("url", urlArg, "")
		cmd.Flags().String("creator", creatorIDArg, "")
		cmd.Flags().String("response-username", responseUsernameArg, "")
		cmd.Flags().String("icon", iconArg, "")
		cmd.Flags().String("method", method, "")
		cmd.Flags().Bool("autocomplete", autocomplete, "")
		cmd.Flags().String("autocompleteDesc", autocompleteDesc, "")
		cmd.Flags().String("autocompleteHint", autocompleteHint, "")

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), creatorIDArg, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)
		mockError := errors.New("mock error, simulated error for CreateCommand")
		s.client.
			EXPECT().
			CreateCommand(context.Background(), &mockCommand).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := createCommandCmdF(s.client, cmd, []string{teamArg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "unable to create command '"+mockCommand.DisplayName+"'. "+mockError.Error())
	})
}

func (s *MmctlUnitTestSuite) TestArchiveCommandCmd() {
	s.Run("Delete without errors", func() {
		printer.Clean()
		arg := "cmd1"
		outputMessage := map[string]interface{}{"status": "ok"}

		s.client.
			EXPECT().
			DeleteCommand(context.Background(), arg).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := archiveCommandCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], outputMessage)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Not able to delete", func() {
		printer.Clean()
		arg := "cmd1"
		outputMessage := map[string]interface{}{"status": "error"}

		s.client.
			EXPECT().
			DeleteCommand(context.Background(), arg).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := archiveCommandCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], outputMessage)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Delete with response error", func() {
		printer.Clean()
		arg := "cmd1"
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			DeleteCommand(context.Background(), arg).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		err := archiveCommandCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().NotNil(err)
		s.Require().Equal(err, errors.New("Unable to archive command '"+arg+"' error: "+mockError.Error()))
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestCommandListCmdF() {
	s.Run("List all commands from all teams", func() {
		printer.Clean()
		team1ID := "team-id-1"
		team2Id := "team-id-2"

		commandTeam1ID := "command-team1-id"
		commandTeam2Id := "command-team2-id"
		teams := []*model.Team{
			{Id: team1ID},
			{Id: team2Id},
		}

		team1Commands := []*model.Command{
			{
				Id: commandTeam1ID,
			},
		}
		team2Commands := []*model.Command{
			{
				Id: commandTeam2Id,
			},
		}

		cmd := &cobra.Command{}
		s.client.EXPECT().GetAllTeams(context.Background(), "", 0, 10000).Return(teams, &model.Response{}, nil).Times(1)
		s.client.EXPECT().ListCommands(context.Background(), team1ID, true).Return(team1Commands, &model.Response{}, nil).Times(1)
		s.client.EXPECT().ListCommands(context.Background(), team2Id, true).Return(team2Commands, &model.Response{}, nil).Times(1)
		err := listCommandCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 2)
		s.Equal(team1Commands[0], printer.GetLines()[0])
		s.Equal(team2Commands[0], printer.GetLines()[1])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("List commands for a specific team", func() {
		printer.Clean()
		teamID := "team-id"
		commandID := "command-id"
		team := &model.Team{Id: teamID}
		teamCommand := []*model.Command{
			{
				Id: commandID,
			},
		}

		cmd := &cobra.Command{}
		s.client.EXPECT().GetTeam(context.Background(), teamID, "").Return(team, &model.Response{}, nil).Times(1)
		s.client.EXPECT().ListCommands(context.Background(), teamID, true).Return(teamCommand, &model.Response{}, nil).Times(1)
		err := listCommandCmdF(s.client, cmd, []string{teamID})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(teamCommand[0], printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("List commands for a non existing team", func() {
		teamID := "non-existing-team"
		printer.Clean()
		cmd := &cobra.Command{}
		// first try to get team by id
		s.client.EXPECT().GetTeam(context.Background(), teamID, "").Return(nil, &model.Response{}, nil).Times(1)
		// second try to search the team by name
		s.client.EXPECT().GetTeamByName(context.Background(), teamID, "").Return(nil, &model.Response{}, nil).Times(1)
		err := listCommandCmdF(s.client, cmd, []string{teamID})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Unable to find team '"+teamID+"'", printer.GetErrorLines()[0])
	})

	s.Run("Failling to list commands for an existing team", func() {
		teamID := "team-id"
		printer.Clean()
		cmd := &cobra.Command{}
		team := &model.Team{Id: teamID}
		s.client.EXPECT().GetTeam(context.Background(), teamID, "").Return(team, &model.Response{}, nil).Times(1)
		s.client.EXPECT().ListCommands(context.Background(), teamID, true).Return(nil, &model.Response{}, errors.New("")).Times(1)
		err := listCommandCmdF(s.client, cmd, []string{teamID})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal("Unable to list commands for '"+teamID+"'", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestCommandModifyCmd() {
	arg := "cmd1"
	teamID := "example-team-id"
	titleArg := "example-command-name"
	descriptionArg := "example-description-text"
	triggerWordArg := "example-trigger-word"
	urlArg := "http://localhost:8000/example"
	creatorIDArg := "example-user-id"
	responseUsernameArg := "example-username2"
	iconArg := "icon-url"
	method := "G"
	autocomplete := false
	autocompleteDesc := "autocompleteDesc"
	autocompleteHint := "autocompleteHint"

	mockCommand := model.Command{
		TeamId:           teamID,
		DisplayName:      titleArg,
		Description:      descriptionArg,
		Trigger:          triggerWordArg,
		URL:              urlArg,
		CreatorId:        creatorIDArg,
		Username:         responseUsernameArg,
		IconURL:          iconArg,
		Method:           method,
		AutoComplete:     autocomplete,
		AutoCompleteDesc: autocompleteDesc,
		AutoCompleteHint: autocompleteHint,
	}

	s.Run("Modify a custom slash command by id", func() {
		printer.Clean()
		mockCommandModified := copyCommand(&mockCommand)
		mockCommandModified.DisplayName = titleArg + "_modified"
		mockCommandModified.Description = descriptionArg + "_modified"
		mockCommandModified.Trigger = triggerWordArg + "_modified"
		mockCommandModified.URL = urlArg + "_modified"
		mockCommandModified.CreatorId = creatorIDArg + "_modified"
		mockCommandModified.Username = responseUsernameArg + "_modified"
		mockCommandModified.IconURL = iconArg + "_modified"
		mockCommandModified.Method = method
		mockCommandModified.AutoComplete = !autocomplete
		mockCommandModified.AutoCompleteDesc = autocompleteDesc + "_modified"
		mockCommandModified.AutoCompleteHint = autocompleteHint + "_modified"

		cli := []string{
			arg,
			"--title=" + mockCommandModified.DisplayName,
			"--description=" + mockCommandModified.Description,
			"--trigger-word=" + mockCommandModified.Trigger,
			"--url=" + mockCommandModified.URL,
			"--creator=" + mockCommandModified.CreatorId,
			"--response-username=" + mockCommandModified.Username,
			"--icon=" + mockCommandModified.IconURL,
			"--autocomplete=" + strconv.FormatBool(mockCommandModified.AutoComplete),
			"--autocompleteDesc=" + mockCommandModified.AutoCompleteDesc,
			"--autocompleteHint=" + mockCommandModified.AutoCompleteHint,
			"--post=" + strconv.FormatBool(method2Bool(mockCommandModified.Method)),
		}

		// modifyCommandCmdF will call getCommandById, GetUserByEmail and UpdateCommand
		s.client.
			EXPECT().
			GetCommandById(context.Background(), arg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), mockCommandModified.CreatorId, "").
			Return(&model.User{Id: mockCommandModified.CreatorId}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			UpdateCommand(context.Background(), &mockCommand).
			Return(mockCommandModified, &model.Response{}, nil).
			Times(1)

		// Reset the cmd and parse to force Flag.Changed to be true.
		cmd := CommandModifyCmd
		cmd.ResetFlags()
		addCommandFieldsFlags(cmd)
		err := cmd.ParseFlags(cli)
		s.Require().Nil(err)

		err = modifyCommandCmdF(s.client, cmd, []string{arg})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(mockCommandModified, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Modify slash command using a nonexistent commandID", func() {
		printer.Clean()
		mockCommandModified := copyCommand(&mockCommand)
		mockCommandModified.DisplayName = titleArg + "_modified"

		cli := []string{
			arg,
			"--title=" + mockCommandModified.DisplayName,
		}

		// modifyCommandCmdF will call getCommandById
		s.client.
			EXPECT().
			GetCommandById(context.Background(), arg).
			Return(nil, &model.Response{}, nil).
			Times(1)

		// Reset the cmd and parse to force Flag.Changed to be true for all flags on the CLI.
		cmd := CommandModifyCmd
		cmd.ResetFlags()
		addCommandFieldsFlags(cmd)
		err := cmd.ParseFlags(cli)
		s.Require().Nil(err)

		err = modifyCommandCmdF(s.client, cmd, []string{arg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "unable to find command '"+arg+"'")
	})

	s.Run("Modify slash command with invalid user name", func() {
		printer.Clean()
		mockCommandModified := copyCommand(&mockCommand)
		mockCommandModified.CreatorId = creatorIDArg + "_modified"

		bogusUsername := "bogus"
		cli := []string{
			arg,
			"--creator=" + bogusUsername,
		}

		// modifyCommandCmdF will call getCommandById, then try looking up user
		// via email, username, and id.
		s.client.
			EXPECT().
			GetCommandById(context.Background(), arg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), bogusUsername, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUserByUsername(context.Background(), bogusUsername, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetUser(context.Background(), bogusUsername, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		// Reset the cmd and parse to force Flag.Changed to be true for all flags on the CLI.
		cmd := CommandModifyCmd
		cmd.ResetFlags()
		addCommandFieldsFlags(cmd)
		err := cmd.ParseFlags(cli)
		s.Require().Nil(err)

		err = modifyCommandCmdF(s.client, cmd, []string{arg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "unable to find user '"+bogusUsername+"'")
	})

	s.Run("Modify slash command with a space in trigger word", func() {
		printer.Clean()
		mockCommandModified := copyCommand(&mockCommand)
		mockCommandModified.Trigger = creatorIDArg + " modified with space"

		cli := []string{
			arg,
			"--trigger-word=" + mockCommandModified.Trigger,
		}

		// modifyCommandCmdF will call getCommandById
		s.client.
			EXPECT().
			GetCommandById(context.Background(), arg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)

		// Reset the cmd and parse to force Flag.Changed to be true for all flags on the CLI.
		cmd := CommandModifyCmd
		cmd.ResetFlags()
		addCommandFieldsFlags(cmd)
		err := cmd.ParseFlags(cli)
		s.Require().Nil(err)

		err = modifyCommandCmdF(s.client, cmd, []string{arg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "a trigger word must not contain spaces")
	})

	s.Run("Modify slash command with trigger word prefixed with /", func() {
		printer.Clean()
		mockCommandModified := copyCommand(&mockCommand)
		mockCommandModified.Trigger = "/modified_with_slash"

		cli := []string{
			arg,
			"--trigger-word=" + mockCommandModified.Trigger,
		}

		// modifyCommandCmdF will call getCommandById
		s.client.
			EXPECT().
			GetCommandById(context.Background(), arg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)

		// Reset the cmd and parse to force Flag.Changed to be true for all flags on the CLI.
		cmd := CommandModifyCmd
		cmd.ResetFlags()
		addCommandFieldsFlags(cmd)
		err := cmd.ParseFlags(cli)
		s.Require().Nil(err)

		err = modifyCommandCmdF(s.client, cmd, []string{arg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "a trigger word cannot begin with a /")
	})

	s.Run("Modify slash command fail", func() {
		printer.Clean()
		mockCommandModified := copyCommand(&mockCommand)
		mockCommandModified.Trigger = creatorIDArg + "_modified"

		cli := []string{
			arg,
			"--trigger-word=" + mockCommandModified.Trigger,
		}

		// modifyCommandCmdF will call getCommandById then UpdateCommand
		s.client.
			EXPECT().
			GetCommandById(context.Background(), arg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)
		mockError := errors.New("mock error, simulated error for CreateCommand")
		s.client.
			EXPECT().
			UpdateCommand(context.Background(), &mockCommand).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		// Reset the cmd and parse to force Flag.Changed to be true for all flags on the CLI.
		cmd := CommandModifyCmd
		cmd.ResetFlags()
		addCommandFieldsFlags(cmd)
		err := cmd.ParseFlags(cli)
		s.Require().Nil(err)

		err = modifyCommandCmdF(s.client, cmd, []string{arg})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "unable to modify command '"+mockCommand.DisplayName+"'. "+mockError.Error())
	})
}

//nolint:golint,unused
func method2Bool(method string) bool {
	switch strings.ToUpper(method) {
	case "P":
		return true
	case "G":
		return false
	default:
		panic(fmt.Errorf("invalid method '%s'", method))
	}
}

//nolint:golint,unused
func copyCommand(cmd *model.Command) *model.Command {
	c := *cmd
	return &c
}

func (s *MmctlUnitTestSuite) TestCommandMoveCmd() {
	commandArg := "cmd1"
	commandArgBogus := "bogus-command-id"
	teamArg := "dest-team-id"
	teamArgBogus := "bogus-team-id"

	mockTeamDest := model.Team{Id: teamArg}

	mockCommand := model.Command{
		Id:          commandArg,
		TeamId:      "orig-team-id",
		DisplayName: "example-title",
		Trigger:     "example-trigger",
	}

	mockError := errors.New("mock error")
	outputMessageOK := map[string]interface{}{"status": "ok"}
	outputMessageError := map[string]interface{}{"status": "error"}

	s.Run("Move custom slash command to another team by id", func() {
		printer.Clean()
		mockCommandModified := copyCommand(&mockCommand)
		mockCommandModified.TeamId = teamArg

		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamArg, "").
			Return(&mockTeamDest, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetCommandById(context.Background(), commandArg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			MoveCommand(context.Background(), teamArg, mockCommand.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := moveCommandCmdF(s.client, &cobra.Command{}, []string{teamArg, mockCommand.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], outputMessageOK)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Move custom slash command to invalid team by id", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArgBogus, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamArgBogus, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := moveCommandCmdF(s.client, &cobra.Command{}, []string{teamArgBogus, commandArg})
		s.Require().NotNil(err)
		s.EqualError(err, "unable to find team '"+teamArgBogus+"'")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Move custom slash command to different team by invalid id", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeamDest, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetCommandById(context.Background(), commandArgBogus).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := moveCommandCmdF(s.client, &cobra.Command{}, []string{teamArg, commandArgBogus})
		s.Require().NotNil(err)
		s.EqualError(err, "unable to find command '"+commandArgBogus+"'")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Unable to move custom slash command", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeamDest, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetCommandById(context.Background(), commandArg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			MoveCommand(context.Background(), teamArg, commandArg).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := moveCommandCmdF(s.client, &cobra.Command{}, []string{teamArg, commandArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], outputMessageError)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Move custom slash command with response error", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetTeam(context.Background(), teamArg, "").
			Return(&mockTeamDest, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetCommandById(context.Background(), commandArg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			MoveCommand(context.Background(), teamArg, commandArg).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		err := moveCommandCmdF(s.client, &cobra.Command{}, []string{teamArg, commandArg})
		s.Require().NotNil(err)
		s.Require().EqualError(err, "unable to move command '"+commandArg+"'. "+mockError.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestCommandShowCmd() {
	commandArg := "example-command-id"
	commandArgBogus := "bogus-command-id"

	mockCommand := model.Command{
		Id:               commandArg,
		TeamId:           "example-team-id",
		DisplayName:      "example-command-name",
		Description:      "example-description-text",
		Trigger:          "example-trigger-word",
		URL:              "http://localhost:8000/example",
		CreatorId:        "example-user-id",
		Username:         "example-username2",
		IconURL:          "http://mydomain/example-icon-url",
		Method:           "G",
		AutoComplete:     false,
		AutoCompleteDesc: "example autocomplete description",
		AutoCompleteHint: "autocompleteHint",
	}
	mockTeam := model.Team{Id: "mockteamid", Name: "TeamRed"}

	s.Run("Show custom slash command via id", func() {
		printer.Clean()

		// showCommandCmdF will look up command by id
		s.client.
			EXPECT().
			GetCommandById(context.Background(), commandArg).
			Return(&mockCommand, &model.Response{}, nil).
			Times(1)

		err := showCommandCmdF(s.client, &cobra.Command{}, []string{commandArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Equal(&mockCommand, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Show custom slash command with invalid id", func() {
		printer.Clean()
		// showCommandCmdF will look up command by id
		s.client.
			EXPECT().
			GetCommandById(context.Background(), commandArgBogus).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := showCommandCmdF(s.client, &cobra.Command{}, []string{commandArgBogus})
		s.Require().NotNil(err)
		s.EqualError(err, "unable to find command '"+commandArgBogus+"'")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Show custom slash command via team:trigger", func() {
		printer.Clean()

		list := []*model.Command{copyCommand(&mockCommand), &mockCommand, copyCommand(&mockCommand)}
		list[0].Trigger = "bloop"
		list[2].Trigger = "bleep"

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), mockTeam.Name, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCommands(context.Background(), mockTeam.Id, false).
			Return(list, &model.Response{}, nil).
			Times(1)

		err := showCommandCmdF(s.client, &cobra.Command{}, []string{fmt.Sprintf("%s:%s", mockTeam.Name, mockCommand.Trigger)})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Equal(&mockCommand, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Show custom slash command via team:trigger with invalid team", func() {
		printer.Clean()

		list := []*model.Command{copyCommand(&mockCommand), &mockCommand, copyCommand(&mockCommand)}
		list[0].Trigger = "bloop"
		list[2].Trigger = "bleep"

		const teamName = "bogus_team"
		teamTrigger := fmt.Sprintf("%s:%s", teamName, mockCommand.Trigger)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), teamName, "").
			Return(nil, &model.Response{}, errors.New("team not found")).
			Times(1)

		s.client.
			EXPECT().
			GetCommandById(context.Background(), teamTrigger).
			Return(nil, &model.Response{}, errors.New("command not found")).
			Times(1)

		err := showCommandCmdF(s.client, &cobra.Command{}, []string{teamTrigger})
		s.Require().EqualError(err, fmt.Sprintf("unable to find command '%s'", teamTrigger))
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Show custom slash command via team:trigger with invalid trigger", func() {
		printer.Clean()

		list := []*model.Command{copyCommand(&mockCommand), &mockCommand, copyCommand(&mockCommand)}
		list[0].Trigger = "bloop"
		list[2].Trigger = "bleep"

		const trigger = "bogus_trigger"
		teamTrigger := fmt.Sprintf("%s:%s", mockTeam.Name, trigger)

		s.client.
			EXPECT().
			GetTeamByName(context.Background(), mockTeam.Name, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCommands(context.Background(), mockTeam.Id, false).
			Return(list, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetCommandById(context.Background(), teamTrigger).
			Return(nil, &model.Response{}, errors.New("bogus")).
			Times(1)

		err := showCommandCmdF(s.client, &cobra.Command{}, []string{teamTrigger})
		s.Require().EqualError(err, fmt.Sprintf("unable to find command '%s'", teamTrigger))
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Avoid path traversal", func() {
		printer.Clean()
		arg := "\"test/../hello?\"move"

		err := showCommandCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().NotNil(err)
		s.EqualError(err, "unable to find command '\"test/../hello?\"move'")
	})
}
