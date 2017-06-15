// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type HelpProvider struct {
}

const (
	CMD_HELP = "help"
)

func init() {
	RegisterCommandProvider(&HelpProvider{})
}

func (h *HelpProvider) GetTrigger() string {
	return CMD_HELP
}

func (h *HelpProvider) GetCommand(T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_HELP,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_help.desc"),
		DisplayName:      T("api.command_help.name"),
	}
}

func (h *HelpProvider) DoCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	helpLink := *utils.Cfg.SupportSettings.HelpLink

	if helpLink == "" {
		helpLink = model.SUPPORT_SETTINGS_DEFAULT_HELP_LINK
	}

	return &model.CommandResponse{GotoLocation: helpLink}
}
