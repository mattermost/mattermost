// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"strings"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"

	"github.com/mattermost/mattermost-server/server/public/model"
)

// getCommandFromCommandArg retrieves a Command by command id or team:trigger.
func getCommandFromCommandArg(c client.Client, commandArg string) *model.Command {
	if checkSlash(commandArg) {
		return nil
	}

	cmd := getCommandFromTeamTrigger(c, commandArg)
	if cmd == nil {
		cmd, _, _ = c.GetCommandById(context.TODO(), commandArg)
	}
	return cmd
}

// getCommandFromTeamTrigger retrieves a Command via team:trigger syntax.
func getCommandFromTeamTrigger(c client.Client, teamTrigger string) *model.Command {
	arr := strings.Split(teamTrigger, ":")
	if len(arr) != 2 {
		return nil
	}

	team, _, _ := c.GetTeamByName(context.TODO(), arr[0], "")
	if team == nil {
		return nil
	}

	trigger := arr[1]
	if trigger == "" {
		return nil
	}

	list, _, _ := c.ListCommands(context.TODO(), team.Id, false)
	if list == nil {
		return nil
	}

	for _, cmd := range list {
		if cmd.Trigger == trigger {
			return cmd
		}
	}
	return nil
}
