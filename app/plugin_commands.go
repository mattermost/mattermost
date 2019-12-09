// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
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

	a.Srv.pluginCommandsLock.Lock()
	defer a.Srv.pluginCommandsLock.Unlock()

	for _, pc := range a.Srv.pluginCommands {
		if pc.Command.Trigger == command.Trigger && pc.Command.TeamId == command.TeamId {
			if pc.PluginId == pluginId {
				pc.Command = command
				return nil
			}
		}
	}

	a.Srv.pluginCommands = append(a.Srv.pluginCommands, &PluginCommand{
		Command:  command,
		PluginId: pluginId,
	})
	return nil
}

func (a *App) UnregisterPluginCommand(pluginId, teamId, trigger string) {
	trigger = strings.ToLower(trigger)

	a.Srv.pluginCommandsLock.Lock()
	defer a.Srv.pluginCommandsLock.Unlock()

	var remaining []*PluginCommand
	for _, pc := range a.Srv.pluginCommands {
		if pc.Command.TeamId != teamId || pc.Command.Trigger != trigger {
			remaining = append(remaining, pc)
		}
	}
	a.Srv.pluginCommands = remaining
}

func (a *App) UnregisterPluginCommands(pluginId string) {
	a.Srv.pluginCommandsLock.Lock()
	defer a.Srv.pluginCommandsLock.Unlock()

	var remaining []*PluginCommand
	for _, pc := range a.Srv.pluginCommands {
		if pc.PluginId != pluginId {
			remaining = append(remaining, pc)
		}
	}
	a.Srv.pluginCommands = remaining
}

func (a *App) PluginCommandsForTeam(teamId string) []*model.Command {
	a.Srv.pluginCommandsLock.RLock()
	defer a.Srv.pluginCommandsLock.RUnlock()

	var commands []*model.Command
	for _, pc := range a.Srv.pluginCommands {
		if pc.Command.TeamId == "" || pc.Command.TeamId == teamId {
			commands = append(commands, pc.Command)
		}
	}
	return commands
}

// tryExecutePluginCommand attempts to run a command provided by a plugin based on the given arguments. If no such
// command can be found, returns nil for all arguments.
func (a *App) tryExecutePluginCommand(args *model.CommandArgs) (*model.Command, *model.CommandResponse, *model.AppError) {
	parts := strings.Split(args.Command, " ")
	trigger := parts[0][1:]
	trigger = strings.ToLower(trigger)

	var matched *PluginCommand
	a.Srv.pluginCommandsLock.RLock()
	for _, pc := range a.Srv.pluginCommands {
		if (pc.Command.TeamId == "" || pc.Command.TeamId == args.TeamId) && pc.Command.Trigger == trigger {
			matched = pc
			break
		}
	}
	a.Srv.pluginCommandsLock.RUnlock()
	if matched == nil {
		return nil, nil, nil
	}

	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, nil, nil
	}

	pluginHooks, err := pluginsEnvironment.HooksForPlugin(matched.PluginId)
	if err != nil {
		return matched.Command, nil, model.NewAppError("ExecutePluginCommand", "model.plugin_command.error.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}

	response, appErr := pluginHooks.ExecuteCommand(a.PluginContext(), args)
	return matched.Command, response, appErr
}
