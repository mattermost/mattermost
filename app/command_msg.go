// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

type msgProvider struct {
}

const (
	CMD_MSG = "msg"
)

func init() {
	RegisterCommandProvider(&msgProvider{})
}

func (me *msgProvider) GetTrigger() string {
	return CMD_MSG
}

func (me *msgProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_MSG,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_msg.desc"),
		AutoCompleteHint: T("api.command_msg.hint"),
		DisplayName:      T("api.command_msg.name"),
	}
}

func (me *msgProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	splitMessage := strings.SplitN(message, " ", 2)

	parsedMessage := ""
	targetUsername := ""

	if len(splitMessage) > 1 {
		parsedMessage = strings.SplitN(message, " ", 2)[1]
	}
	targetUsername = strings.SplitN(message, " ", 2)[0]
	targetUsername = strings.TrimPrefix(targetUsername, "@")

	userProfile, err := a.Srv.Store.User().GetByUsername(targetUsername)
	if err != nil {
		mlog.Error(err.Error())
		return &model.CommandResponse{Text: args.T("api.command_msg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if userProfile.Id == args.UserId {
		return &model.CommandResponse{Text: args.T("api.command_msg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	canSee, err := a.UserCanSeeOtherUser(args.UserId, userProfile.Id)
	if err != nil {
		mlog.Error(err.Error())
		return &model.CommandResponse{Text: args.T("api.command_msg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	if !canSee {
		return &model.CommandResponse{Text: args.T("api.command_msg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Find the channel based on this user
	channelName := model.GetDMNameFromIds(args.UserId, userProfile.Id)

	targetChannelId := ""
	if channel, channelErr := a.Srv.Store.Channel().GetByName(args.TeamId, channelName, true); channelErr != nil {
		if channelErr.Id == "store.sql_channel.get_by_name.missing.app_error" {
			if !a.SessionHasPermissionTo(args.Session, model.PERMISSION_CREATE_DIRECT_CHANNEL) {
				return &model.CommandResponse{Text: args.T("api.command_msg.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}

			var directChannel *model.Channel
			if directChannel, err = a.GetOrCreateDirectChannel(args.UserId, userProfile.Id); err != nil {
				mlog.Error(err.Error())
				return &model.CommandResponse{Text: args.T("api.command_msg.dm_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			} else {
				targetChannelId = directChannel.Id
			}
		} else {
			mlog.Error(channelErr.Error())
			return &model.CommandResponse{Text: args.T("api.command_msg.dm_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	} else {
		targetChannelId = channel.Id
	}

	if len(parsedMessage) > 0 {
		post := &model.Post{}
		post.Message = parsedMessage
		post.ChannelId = targetChannelId
		post.UserId = args.UserId
		if _, err = a.CreatePostMissingChannel(post, true); err != nil {
			return &model.CommandResponse{Text: args.T("api.command_msg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	teamId := args.TeamId
	if teamId == "" {
		if len(args.Session.TeamMembers) == 0 {
			return &model.CommandResponse{Text: args.T("api.command_msg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
		teamId = args.Session.TeamMembers[0].TeamId
	}

	team, err := a.GetTeam(teamId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_msg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{GotoLocation: args.SiteURL + "/" + team.Name + "/channels/" + channelName, Text: "", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}
