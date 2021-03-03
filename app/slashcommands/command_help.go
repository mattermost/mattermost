// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
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

func (h *HelpProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	helpLink := *a.Config().SupportSettings.HelpLink

	if helpLink == "" {
		helpLink = model.SUPPORT_SETTINGS_DEFAULT_HELP_LINK
	}

	return &model.CommandResponse{GotoLocation: helpLink}
}
