// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type MuteProvider struct {
}

const (
	CMD_MUTE = "mute"
)

func init() {
	RegisterCommandProvider(&MuteProvider{})
}

func (me *MuteProvider) GetTrigger() string {
	return CMD_MUTE
}

func (me *MuteProvider) GetCommand(T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_MUTE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_mute.desc"),
		DisplayName:      T("api.command_mute.name"),
	}
}

func (me *MuteProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	var channel *model.Channel
	var noChannelErr *model.AppError

	if channel, noChannelErr = a.GetChannel(args.ChannelId); noChannelErr != nil {
		return &model.CommandResponse{Text: args.T("api.command_mute.error", map[string]interface{}{"Channel": channel.Name}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	muteChannel := a.ToggleMuteChannel(args.ChannelId, args.UserId)

	if muteChannel {
		return &model.CommandResponse{Text: args.T("api.command_mute.successmute", map[string]interface{}{"Channel": channel.Name}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		return &model.CommandResponse{Text: args.T("api.command_mute.success_unmute", map[string]interface{}{"Channel": channel.Name}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
}
