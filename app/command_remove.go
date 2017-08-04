// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type removeProvider struct {
}

type kickProvider struct {
}

const (
	CMD_REMOVE = "remove"
	CMD_KICK   = "kick"
)

func init() {
	RegisterCommandProvider(&removeProvider{})
	RegisterCommandProvider(&kickProvider{})
}

func (me *removeProvider) GetTrigger() string {
	return CMD_REMOVE
}

func (me *kickProvider) GetTrigger() string {
	return CMD_KICK
}

func (me *removeProvider) GetCommand(T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_REMOVE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_remove.desc"),
		AutoCompleteHint: T("api.command_remove.hint"),
		DisplayName:      T("api.command_remove.name"),
	}
}

func (me *kickProvider) GetCommand(T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_KICK,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_remove.desc"),
		AutoCompleteHint: T("api.command_remove.hint"),
		DisplayName:      T("api.command_kick.name"),
	}
}

func (me *removeProvider) DoCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	return doCommand(args, message)
}

func (me *kickProvider) DoCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	return doCommand(args, message)
}

func doCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_channel_rename.channel.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channel.Type == model.CHANNEL_OPEN && !SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
		return &model.CommandResponse{Text: args.T("api.command_remove.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channel.Type == model.CHANNEL_PRIVATE && !SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
		return &model.CommandResponse{Text: args.T("api.command_remove.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channel.Type == model.CHANNEL_GROUP || channel.Type == model.CHANNEL_DIRECT {
		return &model.CommandResponse{Text: args.T("api.command_remove.direct_group.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if len(message) == 0 {
		return &model.CommandResponse{Text: args.T("api.command_channel_rename.message.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	targetUsername := ""

	targetUsername = strings.SplitN(message, " ", 2)[0]
	targetUsername = strings.TrimPrefix(targetUsername, "@")

	var userProfile *model.User
	if result := <-Srv.Store.User().GetByUsername(targetUsername); result.Err != nil {
		l4g.Error(result.Err.Error())
		return &model.CommandResponse{Text: args.T("api.command_msg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		userProfile = result.Data.(*model.User)
	}

	if err = RemoveUserFromChannel(userProfile.Id, args.UserId, channel); err != nil {
		return &model.CommandResponse{Text: args.T(err.Id, map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{}
}
