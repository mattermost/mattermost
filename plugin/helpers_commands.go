// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

type CommandCallback func(c *Context, args *CommandArgs, originalArgs *model.CommandArgs) (*model.CommandResponse, *model.AppError)

type CommandArgs struct {
	Trigger string
	Args    []string
}

func (p *HelpersImpl) RegisterCommand(command *model.Command, callback CommandCallback) error {
	if callback == nil {
		return errors.New("Cannot register a command without callback")
	}

	err := p.API.RegisterCommand(command)
	if err != nil {
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
		Trigger: trigger,
		Args:    parameters,
	}
	callback, ok := p.CommandCallbacks.Load(trigger)

	if ok {
		return callback.(CommandCallback)(c, pluginArgs, args)
	}

	return nil, nil
}
