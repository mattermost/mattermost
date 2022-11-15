// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"
	"fmt"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

type VoiceProvider struct {
}

const (
	CmdVoice = "voice"
)

func init() {
	app.RegisterCommandProvider(&VoiceProvider{})
}

func (*VoiceProvider) GetTrigger() string {
	return CmdVoice
}

func (*VoiceProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdVoice,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_voice.desc"),
		DisplayName:      T("api.command_voice.name"),
	}
}

func (*VoiceProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	trigger := strings.TrimPrefix(strings.Fields(args.Command)[0], "/")

	if trigger == CmdVoice {
		return &model.CommandResponse{}
	}
	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeEphemeral,
		Text:         fmt.Sprintf("Unknown command: " + args.Command),
	}
}
