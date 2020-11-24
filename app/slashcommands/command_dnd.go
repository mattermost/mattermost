// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

type DndProvider struct {
}

const (
	CMD_DND = "dnd"
)

func init() {
	app.RegisterCommandProvider(&DndProvider{})
}

func (d *DndProvider) GetTrigger() string {
	return CMD_DND
}

func (d *DndProvider) GetCommand(a *app.App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_DND,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_dnd.desc"),
		DisplayName:      T("api.command_dnd.name"),
	}
}

func (d *DndProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	a.SetStatusDoNotDisturb(args.UserId)

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command_dnd.success")}
}
