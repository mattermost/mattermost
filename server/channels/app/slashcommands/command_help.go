// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type HelpProvider struct {
}

const (
	CmdHelp = "help"
)

func init() {
	app.RegisterCommandProvider(&HelpProvider{})
}

func (h *HelpProvider) GetTrigger() string {
	return CmdHelp
}

func (h *HelpProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdHelp,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_help.desc"),
		DisplayName:      T("api.command_help.name"),
	}
}

func (h *HelpProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	helpLink := *a.Config().SupportSettings.HelpLink

	if helpLink == "" {
		helpLink = model.SupportSettingsDefaultHelpLink
	}

	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeEphemeral,
		Text: args.T("api.command_help.success", map[string]any{
			"HelpLink": helpLink,
		}),
	}
}
