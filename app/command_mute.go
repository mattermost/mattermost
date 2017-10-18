// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"strings"
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
		return &model.CommandResponse{Text: args.T("api.command_mute.error", map[string]interface{}{"Channel": channel.DisplayName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Overwrite channel with channel-handle if set
	if strings.HasPrefix(message, "~") {
		splitMessage := strings.Split(message, " ")
		chanHandle := strings.Split(splitMessage[0], "~")[1]
		channel = (<-a.Srv.Store.Channel().GetByName(channel.TeamId, chanHandle, true)).Data.(*model.Channel)
	}

	muteChannel := a.ToggleMuteChannel(channel.Id, args.UserId)

	// Invalidate cache to allow cache lookups while sending notifications
	a.Srv.Store.Channel().InvalidateCacheForChannelMembersNotifyProps(channel.Id)

	// Direct messages won't have a nice channel title, omit it
	if channel.Type == model.CHANNEL_DIRECT {
		if muteChannel {
			return &model.CommandResponse{Text: args.T("api.command_mute.success_mute_direct_msg"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		} else {
			return &model.CommandResponse{Text: args.T("api.command_mute.success_unmute_direct_msg"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	if muteChannel {
		return &model.CommandResponse{Text: args.T("api.command_mute.success_mute", map[string]interface{}{"Channel": channel.DisplayName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		return &model.CommandResponse{Text: args.T("api.command_mute.success_unmute", map[string]interface{}{"Channel": channel.DisplayName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
}
