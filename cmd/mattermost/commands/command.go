// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"
	"strings"

	"fmt"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/spf13/cobra"
)

var CommandCmd = &cobra.Command{
	Use:   "command",
	Short: "Management of slash commands",
}

var CommandMoveCmd = &cobra.Command{
	Use:     "move",
	Short:   "Move a slash command to a different team",
	Long:    `Move a slash command to a different team. Commands can be specified by [team]:[command-trigger-word]. ie. myteam:trigger or by command ID.`,
	Example: `  command move newteam oldteam:command`,
	RunE:    moveCommandCmdF,
}

var CommandListCmd = &cobra.Command{
	Use:     "list",
	Short:   "List all commands on specified teams.",
	Long:    `List all commands on specified teams.`,
	Example: ` command list myteam`,
	RunE:    listCommandCmdF,
}

var CommandCreateCmd = &cobra.Command{
	Use:     "create [team]",
	Short:   "Create a custom slash command",
	Long:    `Create a custom slash command for the specified team.`,
	Example: `  command create myteam --title MyCommand --description "My Command Description" --trigger-word mycommand --url http://localhost:8000/my-slash-handler --creator myusername --response-username my-bot-username --icon http://localhost:8000/my-slash-handler-bot-icon.png --autocomplete --post`,
	RunE:    createCommandCmdF,
}

func init() {
	CommandCreateCmd.Flags().String("title", "", "Command Title")
	CommandCreateCmd.Flags().String("description", "", "Command Description")
	CommandCreateCmd.Flags().String("trigger-word", "", "Command Trigger Word")
	CommandCreateCmd.Flags().String("url", "", "Command Callback URL")
	CommandCreateCmd.Flags().String("creator", "", "Command Creator's Username")
	CommandCreateCmd.Flags().String("response-username", "", "Command Response Username")
	CommandCreateCmd.Flags().String("icon", "", "Command Icon URL")
	CommandCreateCmd.Flags().Bool("autocomplete", false, "Show Command in autocomplete list")
	CommandCreateCmd.Flags().String("autocompleteDesc", "", "Short Command Description for autocomplete list")
	CommandCreateCmd.Flags().String("autocompleteHint", "", "Command Arguments displayed as help in autocomplete list")
	CommandCreateCmd.Flags().Bool("post", false, "Command Callback URL Method Type ")

	CommandCmd.AddCommand(
		CommandMoveCmd,
		CommandListCmd,
		CommandCreateCmd,
	)
	RootCmd.AddCommand(CommandCmd)
}

func moveCommandCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 2 {
		return errors.New("Enter the destination team and at least one comamnd to move.")
	}

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("Unable to find destination team '" + args[0] + "'")
	}

	commands := getCommandsFromCommandArgs(a, args[1:])
	CommandPrintErrorln(commands)
	for i, command := range commands {
		if command == nil {
			CommandPrintErrorln("Unable to find command '" + args[i+1] + "'")
			continue
		}
		if err := moveCommand(a, team, command); err != nil {
			CommandPrintErrorln("Unable to move command '" + command.Trigger + "' error: " + err.Error())
		} else {
			CommandPrettyPrintln("Moved command '" + command.Trigger + "'")
		}
	}

	return nil
}

func moveCommand(a *app.App, team *model.Team, command *model.Command) *model.AppError {
	return a.MoveCommand(team, command)
}

func listCommandCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	var teams []*model.Team
	if len(args) < 1 {
		teamList, err := a.GetAllTeams()
		if err != nil {
			return err
		}
		teams = teamList
	} else {
		teams = getTeamsFromTeamArgs(a, args)
	}

	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}
		result := <-a.Srv.Store.Command().GetByTeam(team.Id)
		if result.Err != nil {
			CommandPrintErrorln("Unable to list commands for '" + args[i] + "'")
			continue
		}
		commands := result.Data.([]*model.Command)
		for _, command := range commands {
			commandListItem := fmt.Sprintf("%s: %s (team: %s)", command.Id, command.DisplayName, team.Name)
			CommandPrettyPrintln(commandListItem)
		}
	}
	return nil
}

func createCommandCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("enter the team this command will be created for")
	}

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("unable to find team '" + args[0] + "'")
	}

	title, _ := command.Flags().GetString("title")
	description, _ := command.Flags().GetString("description")
	trigger, errt := command.Flags().GetString("trigger-word")
	if errt != nil || trigger == "" {
		return errors.New("atrigger word is required")
	}
	if strings.HasPrefix(trigger, "/") {
		return errors.New("a trigger word cannot begin with a /")
	}
	if strings.Contains(trigger, " ") {
		return errors.New("a trigger word must not contain spaces")
	}

	url, erru := command.Flags().GetString("url")
	if erru != nil || url == "" {
		return errors.New("a request URL is required")
	}
	creator, errc := command.Flags().GetString("creator")
	if errc != nil || creator == "" {
		return errors.New("a creator username is required")
	}
	user := getUserFromUserArg(a, creator)
	responseUsername, _ := command.Flags().GetString("response-username")
	icon, _ := command.Flags().GetString("icon")
	autocomplete, _ := command.Flags().GetBool("autocomplete")
	autocompleteDesc, _ := command.Flags().GetString("autocompleteDesc")
	autocompleteHint, _ := command.Flags().GetString("autocompleteHint")
	post, errp := command.Flags().GetBool("post")
	method := "P"
	if errp != nil || post == false {
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

	if err := createCommand(a, team, newCommand); err != nil {
		return errors.New("unable to create command '" + newCommand.Trigger + "'. " + err.Error())
	}
	CommandPrettyPrintln("created command '" + newCommand.Trigger + "'")

	return nil
}

func createCommand(a *app.App, team *model.Team, command *model.Command) *model.AppError {
	_, err := a.CreateCommand(command)
	return err
}
