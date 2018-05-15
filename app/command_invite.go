// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type InviteProvider struct {
}

const (
	CMD_INVITE = "invite"
)

func init() {
	RegisterCommandProvider(&InviteProvider{})
}

func (me *InviteProvider) GetTrigger() string {
	return CMD_INVITE
}

func (me *InviteProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_INVITE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_invite.desc"),
		AutoCompleteHint: T("api.command_invite.hint"),
		DisplayName:      T("api.command_invite.name"),
	}
}

func (me *InviteProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	if message == "" {
		return &model.CommandResponse{Text: args.T("api.command_invite.missing_message.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	splitMessage := strings.SplitN(message, " ", 2)
	targetUsername := splitMessage[0]
	targetUsername = strings.TrimPrefix(targetUsername, "@")

	var userProfile *model.User
	if result := <-a.Srv.Store.User().GetByUsername(targetUsername); result.Err != nil {
		mlog.Error(result.Err.Error())
		return &model.CommandResponse{Text: args.T("api.command_invite.missing_user.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		userProfile = result.Data.(*model.User)
	}

	var channelToJoin *model.Channel
	var err *model.AppError
	// User set a channel to add the invited user
	if len(splitMessage) > 1 && splitMessage[1] != "" {
		targetChannelName := strings.TrimPrefix(strings.TrimSpace(splitMessage[1]), "~")

		if channelToJoin, err = a.GetChannelByName(targetChannelName, args.TeamId); err != nil {
			return &model.CommandResponse{Text: args.T("api.command_invite.channel.error", map[string]interface{}{"Channel": targetChannelName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	} else {
		channelToJoin, err = a.GetChannel(args.ChannelId)
		if err != nil {
			return &model.CommandResponse{Text: args.T("api.command_invite.channel.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	// Check if is a Direct Channel
	if channelToJoin.Type == model.CHANNEL_DIRECT || channelToJoin.Type == model.CHANNEL_GROUP {
		return &model.CommandResponse{Text: args.T("api.command_invite.directchannel.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Check Permissions
	if channelToJoin.Type == model.CHANNEL_OPEN && !a.SessionHasPermissionToChannel(args.Session, channelToJoin.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
		return &model.CommandResponse{Text: args.T("api.command_invite.permission.app_error", map[string]interface{}{"User": userProfile.Username, "Channel": channelToJoin.Name}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Check if the user who wants to add another is trying to add in a pvt channel, but does not have permission
	// but is in the channel
	_, err = a.GetChannelMember(channelToJoin.Id, args.UserId)
	if channelToJoin.Type == model.CHANNEL_PRIVATE && !a.SessionHasPermissionToChannel(args.Session, channelToJoin.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) && err == nil {
		return &model.CommandResponse{Text: args.T("api.command_invite.permission.app_error", map[string]interface{}{"User": userProfile.Username, "Channel": channelToJoin.Name}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// In this case just check if is a pvt channel and user has permission
	if channelToJoin.Type == model.CHANNEL_PRIVATE && !a.SessionHasPermissionToChannel(args.Session, channelToJoin.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
		return &model.CommandResponse{Text: args.T("api.command_invite.private_channel.app_error", map[string]interface{}{"Channel": channelToJoin.Name}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Check if user is already in the channel
	_, err = a.GetChannelMember(channelToJoin.Id, userProfile.Id)
	if err == nil {
		return &model.CommandResponse{Text: args.T("api.command_invite.user_already_in_channel.app_error", map[string]interface{}{"User": userProfile.Username}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if _, err := a.AddChannelMember(userProfile.Id, channelToJoin, args.Session.UserId, ""); err != nil {
		return &model.CommandResponse{Text: args.T("api.command_invite.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if args.ChannelId != channelToJoin.Id {
		return &model.CommandResponse{Text: args.T("api.command_invite.success", map[string]interface{}{"User": userProfile.Username, "Channel": channelToJoin.Name}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{}
}
