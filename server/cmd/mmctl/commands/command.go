// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

var CommandCmd = &cobra.Command{
	Use:   "command",
	Short: "Management of slash commands",
}

var CommandCreateCmd = &cobra.Command{
	Use:     "create [team]",
	Short:   "Create a custom slash command",
	Long:    `Create a custom slash command for the specified team.`,
	Args:    cobra.MinimumNArgs(1),
	Example: `  command create myteam --title MyCommand --description "My Command Description" --trigger-word mycommand --url http://localhost:8000/my-slash-handler --creator myusername --response-username my-bot-username --icon http://localhost:8000/my-slash-handler-bot-icon.png --autocomplete --post`,
	RunE:    withClient(createCommandCmdF),
}

var CommandListCmd = &cobra.Command{
	Use:     "list [teams]",
	Short:   "List all commands on specified teams.",
	Long:    `List all commands on specified teams.`,
	Example: ` command list myteam`,
	RunE:    withClient(listCommandCmdF),
}

var CommandDeleteCmd = &cobra.Command{
	Use:        "delete [commandID]",
	Short:      "Delete a slash command",
	Long:       `Delete a slash command. Commands can be specified by command ID.`,
	Example:    `  command delete commandID`,
	Deprecated: "please use \"archive\" instead",
	Args:       cobra.ExactArgs(1),
	RunE:       withClient(archiveCommandCmdF),
}

var CommandArchiveCmd = &cobra.Command{
	Use:     "archive [commandID]",
	Short:   "Archive a slash command",
	Long:    `Archive a slash command. Commands can be specified by command ID.`,
	Example: `  command archive commandID`,
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(archiveCommandCmdF),
}

var CommandModifyCmd = &cobra.Command{
	Use:     "modify [commandID]",
	Short:   "Modify a slash command",
	Long:    `Modify a slash command. Commands can be specified by command ID.`,
	Args:    cobra.ExactArgs(1),
	Example: `  command modify commandID --title MyModifiedCommand --description "My Modified Command Description" --trigger-word mycommand --url http://localhost:8000/my-slash-handler --creator myusername --response-username my-bot-username --icon http://localhost:8000/my-slash-handler-bot-icon.png --autocomplete --post`,
	RunE:    withClient(modifyCommandCmdF),
}

var CommandMoveCmd = &cobra.Command{
	Use:     "move [team] [commandID]",
	Short:   "Move a slash command to a different team",
	Long:    `Move a slash command to a different team. Commands can be specified by command ID.`,
	Args:    cobra.ExactArgs(2),
	Example: `  command move newteam commandID`,
	RunE:    withClient(moveCommandCmdF),
}

var CommandShowCmd = &cobra.Command{
	Use:     "show [commandID]",
	Short:   "Show a custom slash command",
	Long:    `Show a custom slash command. Commands can be specified by command ID. Returns command ID, team ID, trigger word, display name and creator username.`,
	Args:    cobra.ExactArgs(1),
	Example: `  command show commandID`,
	RunE:    withClient(showCommandCmdF),
}

func addCommandFieldsFlags(cmd *cobra.Command) {
	cmd.Flags().String("title", "", "Command Title")
	cmd.Flags().String("description", "", "Command Description")
	cmd.Flags().String("trigger-word", "", "Command Trigger Word (required)")
	cmd.Flags().String("url", "", "Command Callback URL (required)")
	cmd.Flags().String("creator", "", "Command Creator's username, email or id (required)")
	cmd.Flags().String("response-username", "", "Command Response Username")
	cmd.Flags().String("icon", "", "Command Icon URL")
	cmd.Flags().Bool("autocomplete", false, "Show Command in autocomplete list")
	cmd.Flags().String("autocompleteDesc", "", "Short Command Description for autocomplete list")
	cmd.Flags().String("autocompleteHint", "", "Command Arguments displayed as help in autocomplete list")
	cmd.Flags().Bool("post", false, "Use POST method for Callback URL")
}

func init() {
	cmds := []*cobra.Command{CommandCreateCmd, CommandModifyCmd}
	for _, cmd := range cmds {
		addCommandFieldsFlags(cmd)
	}

	_ = CommandCreateCmd.MarkFlagRequired("trigger-word")
	_ = CommandCreateCmd.MarkFlagRequired("url")
	_ = CommandCreateCmd.MarkFlagRequired("creator")

	CommandCmd.AddCommand(
		CommandCreateCmd,
		CommandListCmd,
		CommandDeleteCmd,
		CommandModifyCmd,
		CommandMoveCmd,
		CommandShowCmd,
		CommandArchiveCmd,
	)
	RootCmd.AddCommand(CommandCmd)
}

func createCommandCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	team := getTeamFromTeamArg(c, args[0])
	if team == nil {
		return errors.New("unable to find team '" + args[0] + "'")
	}

	// get the creator
	creator, _ := cmd.Flags().GetString("creator")
	user := getUserFromUserArg(c, creator)
	if user == nil {
		return errors.New("unable to find user '" + creator + "'")
	}

	title, _ := cmd.Flags().GetString("title")
	description, _ := cmd.Flags().GetString("description")
	trigger, _ := cmd.Flags().GetString("trigger-word")

	if strings.HasPrefix(trigger, "/") {
		return errors.New("a trigger word cannot begin with a /")
	}
	if strings.Contains(trigger, " ") {
		return errors.New("a trigger word must not contain spaces")
	}

	url, _ := cmd.Flags().GetString("url")
	responseUsername, _ := cmd.Flags().GetString("response-username")
	icon, _ := cmd.Flags().GetString("icon")
	autocomplete, _ := cmd.Flags().GetBool("autocomplete")
	autocompleteDesc, _ := cmd.Flags().GetString("autocompleteDesc")
	autocompleteHint, _ := cmd.Flags().GetString("autocompleteHint")
	post, errp := cmd.Flags().GetBool("post")
	method := "P"
	if errp != nil || !post {
		method = "G"
	}

	newCommand := &model.Command{
		CreatorId:        user.Id,
		TeamId:           team.Id,
		Trigger:          trigger,
		Method:           method,
		Username:         responseUsername,
		IconURL:          icon,
		AutoComplete:     autocomplete,
		AutoCompleteDesc: autocompleteDesc,
		AutoCompleteHint: autocompleteHint,
		DisplayName:      title,
		Description:      description,
		URL:              url,
	}

	createdCommand, _, err := c.CreateCommand(context.TODO(), newCommand)
	if err != nil {
		return errors.New("unable to create command '" + newCommand.DisplayName + "'. " + err.Error())
	}

	printer.PrintT("created command {{.DisplayName}}", createdCommand)

	return nil
}

func listCommandCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	var teams []*model.Team
	if len(args) < 1 {
		teamList, _, err := c.GetAllTeams(context.TODO(), "", 0, 10000)
		if err != nil {
			return err
		}
		teams = teamList
	} else {
		teams = getTeamsFromTeamArgs(c, args)
	}

	var errs *multierror.Error
	for i, team := range teams {
		if team == nil {
			printer.PrintError("Unable to find team '" + args[i] + "'")
			errs = multierror.Append(errs, fmt.Errorf("unable to find team '%s'", args[i]))
			continue
		}
		commands, _, err := c.ListCommands(context.TODO(), team.Id, true)
		if err != nil {
			printer.PrintError("Unable to list commands for '" + team.Id + "'")
			errs = multierror.Append(errs, fmt.Errorf("unable to list commands for '%s': %w", team.Id, err))
			continue
		}
		for _, command := range commands {
			printer.PrintT("{{.Id}}: {{.DisplayName}} (team: "+team.Name+")", command)
		}
	}
	return errs.ErrorOrNil()
}

func archiveCommandCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	resp, err := c.DeleteCommand(context.TODO(), args[0])
	if err != nil {
		return errors.New("Unable to archive command '" + args[0] + "' error: " + err.Error())
	}

	if resp.StatusCode == http.StatusOK {
		printer.PrintT("Status: {{.status}}", map[string]interface{}{"status": "ok"})
	} else {
		printer.PrintT("Status: {{.status}}", map[string]interface{}{"status": "error"})
	}
	return nil
}

func modifyCommandCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)
	command := getCommandFromCommandArg(c, args[0])
	if command == nil {
		return fmt.Errorf("unable to find command '%s'", args[0])
	}

	flags := cmd.Flags()
	if flags.Changed("title") {
		command.DisplayName, _ = flags.GetString("title")
	}
	if flags.Changed("description") {
		command.Description, _ = flags.GetString("description")
	}
	if flags.Changed("trigger-word") {
		trigger, _ := flags.GetString("trigger-word")
		if strings.HasPrefix(trigger, "/") {
			return errors.New("a trigger word cannot begin with a /")
		}
		if strings.Contains(trigger, " ") {
			return errors.New("a trigger word must not contain spaces")
		}
		command.Trigger = trigger
	}
	if flags.Changed("url") {
		command.URL, _ = flags.GetString("url")
	}
	if flags.Changed("creator") {
		creator, _ := flags.GetString("creator")
		user := getUserFromUserArg(c, creator)
		if user == nil {
			return fmt.Errorf("unable to find user '%s'", creator)
		}
		command.CreatorId = user.Id
	}
	if flags.Changed("response-username") {
		command.Username, _ = flags.GetString("response-username")
	}
	if flags.Changed("icon") {
		command.IconURL, _ = flags.GetString("icon")
	}
	if flags.Changed("autocomplete") {
		command.AutoComplete, _ = flags.GetBool("autocomplete")
	}
	if flags.Changed("autocompleteDesc") {
		command.AutoCompleteDesc, _ = flags.GetString("autocompleteDesc")
	}
	if flags.Changed("autocompleteHint") {
		command.AutoCompleteHint, _ = flags.GetString("autocompleteHint")
	}
	if flags.Changed("post") {
		post, _ := flags.GetBool("post")
		if post {
			command.Method = "P"
		} else {
			command.Method = "G"
		}
	}

	modifiedCommand, _, err := c.UpdateCommand(context.TODO(), command)
	if err != nil {
		return fmt.Errorf("unable to modify command '%s'. %s", command.DisplayName, err.Error())
	}

	printer.PrintT("modified command {{.DisplayName}}", modifiedCommand)
	return nil
}

func moveCommandCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	newTeam := getTeamFromTeamArg(c, args[0])
	if newTeam == nil {
		return fmt.Errorf("unable to find team '%s'", args[0])
	}

	command := getCommandFromCommandArg(c, args[1])
	if command == nil {
		return fmt.Errorf("unable to find command '%s'", args[1])
	}

	resp, err := c.MoveCommand(context.TODO(), newTeam.Id, command.Id)
	if err != nil {
		return fmt.Errorf("unable to move command '%s'. %s", command.Id, err.Error())
	}

	if resp.StatusCode == http.StatusOK {
		printer.PrintT("Status: {{.status}}", map[string]interface{}{"status": "ok"})
	} else {
		printer.PrintT("Status: {{.status}}", map[string]interface{}{"status": "error"})
	}
	return nil
}

func showCommandCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	command := getCommandFromCommandArg(c, args[0])
	if command == nil {
		return fmt.Errorf("unable to find command '%s'", args[0])
	}

	template :=
		`teamId:             {{.TeamId}}
title:              {{.DisplayName}}
description:        {{.Description}}
trigger-word:       {{.Trigger}}
URL:                {{.URL}}
creatorId:          {{.CreatorId}}
response-username:  {{.Username}}
iconURL:            {{.IconURL}}
autoComplete:       {{.AutoComplete}}
autoCompleteDesc:   {{.AutoCompleteDesc}}
autoCompleteHint:   {{.AutoCompleteHint}}
method:             {{.Method}}`

	printer.PrintT(template, command)
	return nil
}
