// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
)

const COMMAND_ARGS_SEPARATOR = ":"

func getCommandsFromCommandArgs(a *app.App, commandArgs []string) []*model.Command {
	commands := make([]*model.Command, 0, len(commandArgs))

	for _, commandArg := range commandArgs {
		command := getCommandFromCommandArg(a, commandArg)
		commands = append(commands, command)
	}

	return commands
}

func parseCommandArg(commandArg string) (string, string) {
	result := strings.SplitN(commandArg, COMMAND_ARGS_SEPARATOR, 2)

	if len(result) == 1 {
		return "", commandArg
	}

	return result[0], result[1]
}

func getCommandFromCommandArg(a *app.App, commandArg string) *model.Command {
	teamArg, commandPart := parseCommandArg(commandArg)
	if teamArg == "" && commandPart == "" {
		return nil
	}

	var command *model.Command
	if teamArg != "" {
		team := getTeamFromTeamArg(a, teamArg)
		if team == nil {
			return nil
		}

		if result := <-a.Srv.Store.Command().GetByTrigger(team.Id, commandPart); result.Err == nil {
			command = result.Data.(*model.Command)
		} else {
			fmt.Println(result.Err.Error())
		}
	}

	if command == nil {
		if result := <-a.Srv.Store.Command().Get(commandPart); result.Err == nil {
			command = result.Data.(*model.Command)
		}
	}

	return command
}
