// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// Code inspired on plugin_commands.go.
//
// Key differences/points:
// - There's no need of health checks or unregisterProductCommands on products, they are compiled and assumed as active server side
// - HooksForProduct still returns a plugin.Hooks struct, it might make sense to improve the name/package
// - Plugin code had a check for a plugin crash after a command was executed, that has been omitted for products

type ProductCommand struct {
	Command   *model.Command
	ProductID string
}

func (a *App) RegisterProductCommand(ProductID string, command *model.Command) error {
	if command.Trigger == "" {
		return errors.New("invalid command")
	}
	if command.AutocompleteData != nil {
		if err := command.AutocompleteData.IsValid(); err != nil {
			return errors.Wrap(err, "invalid autocomplete data in command")
		}
	}

	// TODO: check this block
	if command.AutocompleteData == nil {
		command.AutocompleteData = model.NewAutocompleteData(command.Trigger, command.AutoCompleteHint, command.AutoCompleteDesc)
	} else {
		baseURL, err := url.Parse("/plugins/" + ProductID)
		if err != nil {
			return errors.Wrapf(err, "Can't parse url %s", "/plugins/"+ProductID)
		}
		err = command.AutocompleteData.UpdateRelativeURLsForPluginCommands(baseURL)
		if err != nil {
			return errors.Wrap(err, "Can't update relative urls for plugin commands")
		}
	}

	command = &model.Command{
		Trigger:              strings.ToLower(command.Trigger),
		TeamId:               command.TeamId,
		AutoComplete:         command.AutoComplete,
		AutoCompleteDesc:     command.AutoCompleteDesc,
		AutoCompleteHint:     command.AutoCompleteHint,
		DisplayName:          command.DisplayName,
		AutocompleteData:     command.AutocompleteData,
		AutocompleteIconData: command.AutocompleteIconData,
	}

	a.ch.productCommandsLock.Lock()
	defer a.ch.productCommandsLock.Unlock()

	for _, pc := range a.ch.productCommands {
		if pc.Command.Trigger == command.Trigger && pc.Command.TeamId == command.TeamId {
			if pc.ProductID == ProductID {
				pc.Command = command
				return nil
			}
		}
	}

	a.ch.productCommands = append(a.ch.productCommands, &ProductCommand{
		Command:   command,
		ProductID: ProductID,
	})
	return nil
}

func (a *App) UnregisterProductCommand(productID, teamID, trigger string) {
	trigger = strings.ToLower(trigger)

	a.ch.productCommandsLock.Lock()
	defer a.ch.productCommandsLock.Unlock()

	var remaining []*ProductCommand
	for _, pc := range a.ch.productCommands {
		if pc.Command.TeamId != teamID || pc.Command.Trigger != trigger {
			remaining = append(remaining, pc)
		}
	}
	a.ch.productCommands = remaining
}

func (a *App) ProductCommandsForTeam(teamID string) []*model.Command {
	a.ch.productCommandsLock.RLock()
	defer a.ch.productCommandsLock.RUnlock()

	var commands []*model.Command
	for _, pc := range a.ch.productCommands {
		if pc.Command.TeamId == "" || pc.Command.TeamId == teamID {
			commands = append(commands, pc.Command)
		}
	}
	return commands
}

// tryExecuteProductCommand attempts to run a command provided by a product based on the given arguments. If no such
// command can be found, returns nil for all arguments.
func (a *App) tryExecuteProductCommand(c request.CTX, args *model.CommandArgs) (*model.Command, *model.CommandResponse, *model.AppError) {
	parts := strings.Split(args.Command, " ")
	trigger := parts[0][1:]
	trigger = strings.ToLower(trigger)

	var matched *ProductCommand
	a.ch.productCommandsLock.RLock()
	for _, pc := range a.ch.productCommands {
		if (pc.Command.TeamId == "" || pc.Command.TeamId == args.TeamId) && pc.Command.Trigger == trigger {
			matched = pc
			break
		}
	}
	a.ch.productCommandsLock.RUnlock()
	if matched == nil {
		return nil, nil, nil
	}

	// The type returned is still plugin.Hooks, could make sense in the future to move Hooks
	// to another package or change  the abstraction
	productHooks := a.HooksManager().HooksForProduct(matched.ProductID)
	if productHooks == nil {
		//TODO improve error message
		return matched.Command, nil, model.NewAppError("ExecutePropductCommand", "model.plugin_command.error.app_error", nil, "", http.StatusInternalServerError)
	}

	for username, userID := range a.MentionsToTeamMembers(c, args.Command, args.TeamId) {
		args.AddUserMention(username, userID)
	}

	for channelName, channelID := range a.MentionsToPublicChannels(c, args.Command, args.TeamId) {
		args.AddChannelMention(channelName, channelID)
	}

	response, appErr := productHooks.ExecuteCommand(pluginContext(c), args)

	// This is a response from the product, which may set an incorrect status code;
	// e.g setting a status code of 0 will crash the server. So we always bucket everything under 500.
	if appErr != nil && (appErr.StatusCode < 100 || appErr.StatusCode > 999) {
		mlog.Warn("Invalid status code returned from plugin. Converting to internal server error.", mlog.String("plugin_id", matched.ProductID), mlog.Int("status_code", appErr.StatusCode))
		appErr.StatusCode = http.StatusInternalServerError
	}

	return matched.Command, response, appErr
}
