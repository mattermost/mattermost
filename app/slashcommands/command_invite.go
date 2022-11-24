// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type InviteProvider struct {
}

const (
	CmdInvite = "invite"
)

func init() {
	app.RegisterCommandProvider(&InviteProvider{})
}

func (*InviteProvider) GetTrigger() string {
	return CmdInvite
}

func (*InviteProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdInvite,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_invite.desc"),
		AutoCompleteHint: T("api.command_invite.hint"),
		DisplayName:      T("api.command_invite.name"),
	}
}

func (i *InviteProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if message == "" {
		return &model.CommandResponse{
			Text:         args.T("api.command_invite.missing_message.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	targetUsers, targetChannels, resp := i.parseMessage(a, c, args, message)
	if resp != nil {
		return resp
	}

	for _, targetUser := range targetUsers {
		for _, targetChannel := range targetChannels {
			if resp = i.addUserToChannel(a, c, args, targetUser, targetChannel); resp != nil {
				return resp
			}
		}
	}

	targetUsernames := make([]string, 0, len(targetUsers))
	for _, targetUser := range targetUsers {
		targetUsernames = append(targetUsernames, targetUser.Username)
	}

	targetChannelsNames := make([]string, 0, len(targetChannels))
	for _, targetChannel := range targetChannels {
		if args.ChannelId != targetChannel.Id {
			targetChannelsNames = append(targetChannelsNames, targetChannel.Name)
		}
	}

	if len(targetChannelsNames) > 0 {
		return &model.CommandResponse{
			Text: args.T("api.command_invite.success", map[string]any{
				"User":    strings.Join(targetUsernames, ", "),
				"Channel": strings.Join(targetChannelsNames, ", "),
			}),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	return &model.CommandResponse{}
}

func (i *InviteProvider) parseMessage(a *app.App, c request.CTX, args *model.CommandArgs, message string) ([]*model.User, []*model.Channel, *model.CommandResponse) {
	splitMessage := strings.Split(message, " ")

	targetUsers := make([]*model.User, 0, 1)
	targetChannels := make([]*model.Channel, 0)

	if len(splitMessage) == 1 {
		userProfile := i.getUserProfile(a, strings.TrimPrefix(splitMessage[0], "@"))
		if userProfile == nil {
			return targetUsers, targetChannels, &model.CommandResponse{
				Text:         args.T("api.command_invite.missing_user.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
		targetUsers = append(targetUsers, userProfile)
	} else {
		for _, msg := range splitMessage {
			if len(msg) == 0 {
				continue
			}

			switch msg[0] {
			case '@':
				targetUsername := strings.TrimPrefix(msg, "@")
				userProfile := i.getUserProfile(a, targetUsername)
				if userProfile == nil {
					return targetUsers, targetChannels, &model.CommandResponse{
						Text:         args.T("api.command_invite.missing_user.app_error"),
						ResponseType: model.CommandResponseTypeEphemeral,
					}
				}
				targetUsers = append(targetUsers, userProfile)
			case '~':
				targetChannelName := strings.TrimPrefix(msg, "~")
				mlog.Debug("targetChannelName", mlog.String("targetChannelName", targetChannelName))
				channelToJoin, err := a.GetChannelByName(c, targetChannelName, args.TeamId, false)
				if err != nil {
					return targetUsers, targetChannels, &model.CommandResponse{
						Text: args.T("api.command_invite.channel.error", map[string]any{
							"Channel": targetChannelName,
						}),
						ResponseType: model.CommandResponseTypeEphemeral,
					}
				}
				targetChannels = append(targetChannels, channelToJoin)
			default:
				channelToJoin, err := a.GetChannelByName(c, msg, args.TeamId, false)
				if err != nil {
					return targetUsers, targetChannels, &model.CommandResponse{
						Text: args.T("api.command_invite.channel.error", map[string]any{
							"Channel": msg,
						}),
						ResponseType: model.CommandResponseTypeEphemeral,
					}
				}
				targetChannels = append(targetChannels, channelToJoin)
			}
		}
	}

	if len(targetUsers) == 0 {
		return targetUsers, targetChannels, &model.CommandResponse{
			Text:         args.T("api.command_invite.missing_user.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	if len(targetChannels) == 0 {
		channelToJoin, err := a.GetChannel(c, args.ChannelId)
		if err != nil {
			return targetUsers, targetChannels, &model.CommandResponse{
				Text:         args.T("api.command_invite.channel.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
		targetChannels = append(targetChannels, channelToJoin)
	}

	return targetUsers, targetChannels, nil
}

func (i *InviteProvider) getUserProfile(a *app.App, username string) *model.User {
	userProfile, nErr := a.Srv().Store().User().GetByUsername(username)
	if nErr != nil {
		mlog.Error(nErr.Error())
		return nil
	}

	if userProfile.DeleteAt != 0 {
		return nil
	}

	return userProfile
}

func (i *InviteProvider) addUserToChannel(a *app.App, c request.CTX, args *model.CommandArgs, userProfile *model.User, channelToJoin *model.Channel) *model.CommandResponse {
	var err *model.AppError

	// Permissions Check
	switch channelToJoin.Type {
	case model.ChannelTypeOpen:
		if !a.HasPermissionToChannel(c, args.UserId, channelToJoin.Id, model.PermissionManagePublicChannelMembers) {
			return &model.CommandResponse{
				Text: args.T("api.command_invite.permission.app_error", map[string]any{
					"User":    userProfile.Username,
					"Channel": channelToJoin.Name,
				}),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
	case model.ChannelTypePrivate:
		if !a.HasPermissionToChannel(c, args.UserId, channelToJoin.Id, model.PermissionManagePrivateChannelMembers) {
			if _, err = a.GetChannelMember(c, channelToJoin.Id, args.UserId); err == nil {
				// User doing the inviting is a member of the channel.
				return &model.CommandResponse{
					Text: args.T("api.command_invite.permission.app_error", map[string]any{
						"User":    userProfile.Username,
						"Channel": channelToJoin.Name,
					}),
					ResponseType: model.CommandResponseTypeEphemeral,
				}
			}
			// User doing the inviting is *not* a member of the channel.
			return &model.CommandResponse{
				Text: args.T("api.command_invite.private_channel.app_error", map[string]any{
					"Channel": channelToJoin.Name,
				}),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
	default:
		return &model.CommandResponse{
			Text:         args.T("api.command_invite.directchannel.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	// Check if user is already in the channel
	_, err = a.GetChannelMember(c, channelToJoin.Id, userProfile.Id)
	if err == nil {
		return &model.CommandResponse{
			Text: args.T("api.command_invite.user_already_in_channel.app_error", map[string]any{
				"User": userProfile.Username,
			}),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	if _, err = a.AddChannelMember(c, userProfile.Id, channelToJoin, app.ChannelMemberOpts{
		UserRequestorID: args.UserId,
	}); err != nil {
		var text string
		if err.Id == "api.channel.add_members.user_denied" {
			text = args.T("api.command_invite.group_constrained_user_denied")
		} else if err.Id == "app.team.get_member.missing.app_error" ||
			err.Id == "api.channel.add_user.to.channel.failed.deleted.app_error" {
			text = args.T("api.command_invite.user_not_in_team.app_error", map[string]any{
				"Username": userProfile.Username,
			})
		} else {
			text = args.T("api.command_invite.fail.app_error")
		}
		return &model.CommandResponse{
			Text:         text,
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	return nil
}
