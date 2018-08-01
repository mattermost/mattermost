// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type PluginCommand struct {
	Command  *model.Command
	PluginId string
}

func (a *App) RegisterPluginCommand(pluginId string, command *model.Command) error {
	if command.Trigger == "" {
		return fmt.Errorf("invalid command")
	}

	command = &model.Command{
		Trigger:          strings.ToLower(command.Trigger),
		TeamId:           command.TeamId,
		AutoComplete:     command.AutoComplete,
		AutoCompleteDesc: command.AutoCompleteDesc,
		AutoCompleteHint: command.AutoCompleteHint,
		DisplayName:      command.DisplayName,
	}

	a.pluginCommandsLock.Lock()
	defer a.pluginCommandsLock.Unlock()

	for _, pc := range a.pluginCommands {
		if pc.Command.Trigger == command.Trigger && pc.Command.TeamId == command.TeamId {
			if pc.PluginId == pluginId {
				pc.Command = command
				return nil
			}
		}
	}

	a.pluginCommands = append(a.pluginCommands, &PluginCommand{
		Command:  command,
		PluginId: pluginId,
	})
	return nil
}

func (a *App) UnregisterPluginCommand(pluginId, teamId, trigger string) {
	trigger = strings.ToLower(trigger)

	a.pluginCommandsLock.Lock()
	defer a.pluginCommandsLock.Unlock()

	var remaining []*PluginCommand
	for _, pc := range a.pluginCommands {
		if pc.Command.TeamId != teamId || pc.Command.Trigger != trigger {
			remaining = append(remaining, pc)
		}
	}
	a.pluginCommands = remaining
}

func (a *App) UnregisterPluginCommands(pluginId string) {
	a.pluginCommandsLock.Lock()
	defer a.pluginCommandsLock.Unlock()

	var remaining []*PluginCommand
	for _, pc := range a.pluginCommands {
		if pc.PluginId != pluginId {
			remaining = append(remaining, pc)
		}
	}
	a.pluginCommands = remaining
}

func (a *App) PluginCommandsForTeam(teamId string) []*model.Command {
	a.pluginCommandsLock.RLock()
	defer a.pluginCommandsLock.RUnlock()

	var commands []*model.Command
	for _, pc := range a.pluginCommands {
		if pc.Command.TeamId == "" || pc.Command.TeamId == teamId {
			commands = append(commands, pc.Command)
		}
	}
	return commands
}

func (a *App) ExecutePluginCommand(args *model.CommandArgs) (*model.Command, *model.CommandResponse, *model.AppError) {
	parts := strings.Split(args.Command, " ")
	trigger := parts[0][1:]
	trigger = strings.ToLower(trigger)

	a.pluginCommandsLock.RLock()
	defer a.pluginCommandsLock.RUnlock()

	for _, pc := range a.pluginCommands {
		if (pc.Command.TeamId == "" || pc.Command.TeamId == args.TeamId) && pc.Command.Trigger == trigger {
			pluginHooks, err := a.Plugins.HooksForPlugin(pc.PluginId)
			if err != nil {
				return pc.Command, nil, model.NewAppError("ExecutePluginCommand", "model.plugin_command.error.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
			}
			response, appErr := pluginHooks.ExecuteCommand(&plugin.Context{}, args)
			return pc.Command, response, appErr
		}
	}
	return nil, nil, nil
}
