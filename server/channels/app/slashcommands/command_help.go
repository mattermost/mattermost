// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/server/v8/channels/app"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/i18n"
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

func (h *HelpProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
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
