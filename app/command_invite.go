// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	goi18n "github.com/nicksnyder/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
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
		return &model.CommandResponse{
			Text:         args.T("api.command_invite.missing_message.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	splitMessage := strings.SplitN(message, " ", 2)
	targetUsername := splitMessage[0]
	targetUsername = strings.TrimPrefix(targetUsername, "@")

	result := <-a.Srv.Store.User().GetByUsername(targetUsername)
	if result.Err != nil {
		mlog.Error(result.Err.Error())
		return &model.CommandResponse{
			Text:         args.T("api.command_invite.missing_user.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	userProfile := result.Data.(*model.User)
	if userProfile.DeleteAt != 0 {
		return &model.CommandResponse{
			Text:         args.T("api.command_invite.missing_user.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	var channelToJoin *model.Channel
	var err *model.AppError
	// User set a channel to add the invited user
	if len(splitMessage) > 1 && splitMessage[1] != "" {
		targetChannelName := strings.TrimPrefix(strings.TrimSpace(splitMessage[1]), "~")

		if channelToJoin, err = a.GetChannelByName(targetChannelName, args.TeamId, false); err != nil {
			return &model.CommandResponse{
				Text: args.T("api.command_invite.channel.error", map[string]interface{}{
					"Channel": targetChannelName,
				}),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	} else {
		channelToJoin, err = a.GetChannel(args.ChannelId)
		if err != nil {
			return &model.CommandResponse{
				Text:         args.T("api.command_invite.channel.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	}

	// Permissions Check
	switch channelToJoin.Type {
	case model.CHANNEL_OPEN:
		if !a.SessionHasPermissionToChannel(args.Session, channelToJoin.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
			return &model.CommandResponse{
				Text: args.T("api.command_invite.permission.app_error", map[string]interface{}{
					"User":    userProfile.Username,
					"Channel": channelToJoin.Name,
				}),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	case model.CHANNEL_PRIVATE:
		if !a.SessionHasPermissionToChannel(args.Session, channelToJoin.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
			if _, err = a.GetChannelMember(channelToJoin.Id, args.UserId); err == nil {
				// User doing the inviting is a member of the channel.
				return &model.CommandResponse{
					Text: args.T("api.command_invite.permission.app_error", map[string]interface{}{
						"User":    userProfile.Username,
						"Channel": channelToJoin.Name,
					}),
					ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
				}
			} else {
				// User doing the inviting is *not* a member of the channel.
				return &model.CommandResponse{
					Text: args.T("api.command_invite.private_channel.app_error", map[string]interface{}{
						"Channel": channelToJoin.Name,
					}),
					ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
				}
			}
		}
	default:
		return &model.CommandResponse{
			Text:         args.T("api.command_invite.directchannel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	// Check if user is already in the channel
	_, err = a.GetChannelMember(channelToJoin.Id, userProfile.Id)
	if err == nil {
		return &model.CommandResponse{
			Text: args.T("api.command_invite.user_already_in_channel.app_error", map[string]interface{}{
				"User": userProfile.Username,
			}),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	if _, err := a.AddChannelMember(userProfile.Id, channelToJoin, args.Session.UserId, "", !args.Session.IsMobileApp()); err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_invite.fail.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	if args.ChannelId != channelToJoin.Id {
		return &model.CommandResponse{
			Text: args.T("api.command_invite.success", map[string]interface{}{
				"User":    userProfile.Username,
				"Channel": channelToJoin.Name,
			}),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	return &model.CommandResponse{}
}
