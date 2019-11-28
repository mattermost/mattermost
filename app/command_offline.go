// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/model"
)

type OfflineProvider struct {
}

const (
	CMD_OFFLINE = "offline"
)

func init() {
	RegisterCommandProvider(&OfflineProvider{})
}

func (me *OfflineProvider) GetTrigger() string {
	return CMD_OFFLINE
}

func (me *OfflineProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_OFFLINE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_offline.desc"),
		DisplayName:      T("api.command_offline.name"),
	}
}

func (me *OfflineProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	a.SetStatusOffline(args.UserId, true)

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command_offline.success")}
}
