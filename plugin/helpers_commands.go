// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

type CommandCallback func(c *Context, args *CommandArgs) (*model.CommandResponse, *model.AppError)

type CommandArgs struct {
	Trigger      string
	Args         []string
	OriginalArgs *model.CommandArgs
}

func (p *HelpersImpl) RegisterCommand(command *model.Command, callback CommandCallback) error {
	if callback == nil {
		return errors.New("Cannot register a command without callback")
	}

	if err := p.API.RegisterCommand(command); err != nil {
		return err
	}

	p.CommandCallbacks.Store(command.Trigger, callback)
	return nil
}

func (p *HelpersImpl) ExecuteCommand(c *Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	fields := strings.Fields(args.Command)
	trigger := strings.TrimPrefix(fields[0], "/")
	parameters := fields[1:]
	pluginArgs := &CommandArgs{
		Trigger:      trigger,
		Args:         parameters,
		OriginalArgs: args,
	}
	callback, ok := p.CommandCallbacks.Load(trigger)

	if !ok {
		p.API.LogWarn("Callback not available for the executed command", "trigger", trigger, "args", parameters)
		return nil, nil
	}

	return callback.(CommandCallback)(c, pluginArgs)
}
