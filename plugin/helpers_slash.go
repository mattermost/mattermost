// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

// SplitCommandArgs is a helper that parses command arguments into a command, action, and parameters.
func (p *HelpersImpl) SplitCommandArgs(args *model.CommandArgs) (string, string, []string) {
	split := strings.Fields(args.Command)
	command := split[0]
	parameters := []string{}
	action := ""

	if len(split) > 1 {
		action = split[1]
	}
	if len(split) > 2 {
		parameters = split[2:]
	}

	return command, action, parameters
}

// RegisterSlashCommand is a helper used to call a provided callback function for a given trigger and passes action/parameters to the callback.
func (p *HelpersImpl) RegisterSlashCommand(args *model.CommandArgs, trigger string, callback func(string, []string, *model.CommandArgs) (*model.CommandResponse, *model.AppError)) (*model.CommandResponse, error) {
	command, action, parameters := p.SplitCommandArgs(args)
	if callback == nil {
		return nil, errors.New("missing callback function")
	}	
	if command != "/" + trigger {
		return nil, nil
	}

	commandResponse, err := callback(action, parameters, args)
	if err != nil {
		return nil, errors.Wrap(err, "error occured with RegisterSlashCommand callback")
	}

	return commandResponse, nil
}