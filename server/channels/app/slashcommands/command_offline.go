// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/i18n"
	"github.com/mattermost/mattermost-server/server/v8/channels/app"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
)

type OfflineProvider struct {
}

const (
	CmdOffline = "offline"
)

func init() {
	app.RegisterCommandProvider(&OfflineProvider{})
}

func (*OfflineProvider) GetTrigger() string {
	return CmdOffline
}

func (*OfflineProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdOffline,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_offline.desc"),
		DisplayName:      T("api.command_offline.name"),
	}
}

func (*OfflineProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	a.SetStatusOffline(args.UserId, true)

	return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_offline.success")}
}
