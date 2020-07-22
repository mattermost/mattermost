// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/model"
)

type CodeProvider struct {
}

const (
	CMD_CODE = "code"
)

func init() {
	RegisterCommandProvider(&CodeProvider{})
}

func (me *CodeProvider) GetTrigger() string {
	return CMD_CODE
}

func (me *CodeProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_CODE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_code.desc"),
		AutoCompleteHint: T("api.command_code.hint"),
		DisplayName:      T("api.command_code.name"),
	}
}

func (me *CodeProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	if len(message) == 0 {
		return &model.CommandResponse{Text: args.T("api.command_code.message.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	rmsg := "    " + strings.Join(strings.Split(message, "\n"), "\n    ")
	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL, Text: rmsg, SkipSlackParsing: true}
}
