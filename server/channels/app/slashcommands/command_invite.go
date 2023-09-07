// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type InviteProvider struct {
}

const (
	CmdInvite = "invite"
)

type UserError int64

const (
	NoError UserError = iota
	UserInChannel
	UserNotInTeam
	IsConstrained
	Unknown
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
	return &model.CommandResponse{
		Text:         i.doCommand(a, c, args, message),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}

func (i *InviteProvider) doCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) string {
	if message == "" {
		return args.T("api.command_invite.missing_message.app_error")
	}

	resps := &[]string{}

	targetUsers, targetChannels, resp := i.parseMessage(a, c, args, resps, message)
	if resp != "" {
		return resp
	}

	// Verify that the inviter has permissions to invite users to the every channel.
	targetChannels = i.checkPermissions(a, c, args, resps, targetUsers[0], targetChannels)

	differentChannels := make([]string, 0, 1)
	nonTeamUsers := make([]string, 0, 1)
	teamConstrained := make([]*model.User, 0, 1)
	usersInChannel := make([]string, 0, 1)
	errorUsers := make([]*model.User, 0, 1)

	for _, targetUser := range targetUsers {
		for _, targetChannel := range targetChannels {
			userError := i.addUserToChannel(a, c, args, targetUser, targetChannel)
			if userError == NoError {
				if args.ChannelId != targetChannel.Id {
					differentChannels = append(differentChannels, targetUser.Username)
				}
			} else if userError == UserNotInTeam {
				nonTeamUsers = append(nonTeamUsers, targetUser.Username)
			} else if userError == IsConstrained {
				teamConstrained = append(teamConstrained, targetUser)
			} else if userError == UserInChannel {
				usersInChannel = append(usersInChannel, targetUser.Username)
			} else {
				errorUsers = append(errorUsers, targetUser)
			}
		}
	}

	if len(usersInChannel) > 0 {
		if len(usersInChannel) > 10 {
			*resps = append(*resps,
				args.T("api.command_invite.user_already_in_channel.overflow", map[string]any{
					"FirstUser": "@" + usersInChannel[0],
					"Others":    len(usersInChannel) - 1,
				}),
			)
		} else {
			usersString := map[string]any{
				"User": "@" + strings.Join(usersInChannel, ", @"),
			}
			*resps = append(*resps,
				args.T("api.command_invite.user_already_in_channel.app_error", len(usersInChannel), usersString),
			)
		}
	}

	if len(differentChannels) > 0 {
		if len(differentChannels) > 10 {
			*resps = append(*resps,
				args.T("api.command_invite.successOverflow", map[string]any{
					"FirstUser": "@" + differentChannels[0],
					"Others":    len(differentChannels) - 1,
					"Channel":   "",
				}),
			)
		} else {
			usersString := map[string]any{
				"Users":   "@" + strings.Join(differentChannels, ", @"),
				"Channel": "test",
			}
			*resps = append(*resps,
				args.T("api.command_invite.success", usersString),
			)
		}
	}

	if len(nonTeamUsers) > 0 {
		if len(nonTeamUsers) > 10 {
			*resps = append(*resps,
				args.T("api.command_invite.user_not_in_team.messageOverflow", map[string]any{
					"FirstUser": "@" + nonTeamUsers[0],
					"Others":    len(nonTeamUsers) - 1,
					"Team":      "",
				}),
			)
		} else {
			usersString := map[string]any{
				"Users": "@" + strings.Join(nonTeamUsers, ", @"),
				"Team":  "test",
			}
			*resps = append(*resps,
				args.T("api.command_invite.user_not_in_team.app_error", usersString),
			)
		}
	}

	if len(teamConstrained) > 0 {
		*resps = append(*resps,
			args.T("api.command_invite.group_constrained_user_denied"),
		)
	}

	if len(errorUsers) > 0 {
		*resps = append(*resps,
			args.T("api.command_invite.fail.app_error"),
		)
	}

	if len(*resps) > 0 {
		return strings.Join(*resps, "\n")
	}
	return ""
}

func (i *InviteProvider) getUsersFromMentionName(a *app.App, mentionName string) []*model.User {
	userProfile, err := a.Srv().Store().User().GetByUsername(mentionName)
	if err == nil && userProfile.DeleteAt == 0 {
		return []*model.User{userProfile}
	}

	group, appErr := a.GetGroupByName(mentionName, model.GroupSearchOpts{})
	if appErr != nil || group == nil {
		return nil
	}

	members, appErr := a.GetGroupMemberUsers(group.Id)
	if appErr != nil {
		return nil
	}

	return members
}

func (i *InviteProvider) parseMessage(a *app.App, c request.CTX, args *model.CommandArgs, resps *[]string, message string) ([]*model.User, []*model.Channel, string) {
	splitMessage := strings.Split(message, " ")

	targetUsers := make([]*model.User, 0, 1)
	targetChannels := make([]*model.Channel, 0)

	for j, msg := range splitMessage {
		if msg == "" {
			continue
		}

		if msg[0] == '@' || (msg[0] != '~' && j == 0) {
			targetMentionName := strings.TrimPrefix(msg, "@")
			users := i.getUsersFromMentionName(a, targetMentionName)
			if len(users) == 0 {
				*resps = append(*resps, args.T("api.command_invite.missing_user.app_error", map[string]any{
					"User": targetMentionName,
				}))
				continue
			}
			targetUsers = append(targetUsers, users...)
		} else {
			targetChannelName := strings.TrimPrefix(msg, "~")
			channelToJoin, err := a.GetChannelByName(c, targetChannelName, args.TeamId, false)
			if err != nil {
				*resps = append(*resps, args.T("api.command_invite.channel.error", map[string]any{
					"Channel": targetChannelName,
				}))
				continue
			}
			targetChannels = append(targetChannels, channelToJoin)
		}
	}

	if len(targetUsers) == 0 {
		if len(*resps) != 0 {
			return nil, nil, strings.Join(*resps, "\n")
		}
		return nil, nil, args.T("api.command_invite.missing_message.app_error")
	}

	if len(targetChannels) == 0 {
		if len(*resps) != 0 {
			return nil, nil, strings.Join(*resps, "\n")
		}

		channelToJoin, err := a.GetChannel(c, args.ChannelId)
		if err != nil {
			return nil, nil, args.T("api.command_invite.channel.app_error")
		}
		targetChannels = append(targetChannels, channelToJoin)
	}

	return targetUsers, targetChannels, ""
}

func (i *InviteProvider) getUserProfile(a *app.App, username string) *model.User {
	userProfile, nErr := a.Srv().Store().User().GetByUsername(username)
	if nErr != nil {
		return nil
	}

	if userProfile.DeleteAt != 0 {
		return nil
	}

	return userProfile
}

func (i *InviteProvider) checkPermissions(a *app.App, c request.CTX, args *model.CommandArgs, resps *[]string, targetUser *model.User, targetChannels []*model.Channel) []*model.Channel {
	var err *model.AppError
	validChannels := make([]*model.Channel, 0, len(targetChannels))
	for _, targetChannel := range targetChannels {
		switch targetChannel.Type {
		case model.ChannelTypeOpen:
			if !a.HasPermissionToChannel(c, args.UserId, targetChannel.Id, model.PermissionManagePublicChannelMembers) {
				*resps = append(*resps, args.T("api.command_invite.permission.app_error", map[string]any{
					"User":    targetUser.Username,
					"Channel": targetChannel.Name,
				}))
				continue
			}
		case model.ChannelTypePrivate:
			if !a.HasPermissionToChannel(c, args.UserId, targetChannel.Id, model.PermissionManagePrivateChannelMembers) {
				if _, err = a.GetChannelMember(c, targetChannel.Id, args.UserId); err == nil {
					// User doing the inviting is a member of the channel.
					*resps = append(*resps, args.T("api.command_invite.permission.app_error", map[string]any{
						"User":    targetUser.Username,
						"Channel": targetChannel.Name,
					}))
					continue
				}
				// User doing the inviting is *not* a member of the channel.
				*resps = append(*resps, args.T("api.command_invite.private_channel.app_error", map[string]any{
					"Channel": targetChannel.Name,
				}))
				continue
			}
		default:
			*resps = append(*resps, args.T("api.command_invite.directchannel.app_error"))
			continue
		}
		validChannels = append(validChannels, targetChannel)
	}
	return validChannels
}

func (i *InviteProvider) addUserToChannel(a *app.App, c request.CTX, args *model.CommandArgs, userProfile *model.User, channelToJoin *model.Channel) UserError {
	// Check if user is already in the channel
	_, err := a.GetChannelMember(c, channelToJoin.Id, userProfile.Id)
	if err == nil {
		return UserInChannel
	}

	if _, err = a.AddChannelMember(c, userProfile.Id, channelToJoin, app.ChannelMemberOpts{UserRequestorID: args.UserId}); err != nil {
		if err.Id == "api.channel.add_members.user_denied" {
			return IsConstrained
		} else if err.Id == "app.team.get_member.missing.app_error" ||
			err.Id == "api.channel.add_user.to.channel.failed.deleted.app_error" {
			return UserNotInTeam
		}
		mlog.Warn("addUserToChannel had unexpected error.", mlog.String("UserId", userProfile.Id), mlog.Err(err))
		return Unknown
	}

	return NoError
}
