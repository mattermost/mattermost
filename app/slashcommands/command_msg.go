// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
	"strings"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/store"
)

type msgProvider struct {
}

const (
	CmdMsg = "msg"
)

func init() {
	app.RegisterCommandProvider(&msgProvider{})
}

func (*msgProvider) GetTrigger() string {
	return CmdMsg
}

func (*msgProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdMsg,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_msg.desc"),
		AutoCompleteHint: T("api.command_msg.hint"),
		DisplayName:      T("api.command_msg.name"),
	}
}

func (*msgProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	splitMessage := strings.SplitN(message, " ", 2)

	parsedMessage := ""
	targetUsername := ""

	if len(splitMessage) > 1 {
		parsedMessage = strings.SplitN(message, " ", 2)[1]
	}
	targetUsername = strings.SplitN(message, " ", 2)[0]
	targetUsername = strings.TrimPrefix(targetUsername, "@")

	userProfile, nErr := a.Srv().Store.User().GetByUsername(targetUsername)
	if nErr != nil {
		mlog.Error(nErr.Error())
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
	if channel, channelErr := a.Srv().Store.Channel().GetByName(args.TeamId, channelName, true); channelErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(channelErr, &nfErr) {
			if !a.HasPermissionTo(args.UserId, model.PERMISSION_CREATE_DIRECT_CHANNEL) {
				return &model.CommandResponse{Text: args.T("api.command_msg.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}

			var directChannel *model.Channel
			if directChannel, err = a.GetOrCreateDirectChannel(args.UserId, userProfile.Id); err != nil {
				mlog.Error(err.Error())
				return &model.CommandResponse{Text: args.T("api.command_msg.dm_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}
			targetChannelId = directChannel.Id
		} else {
			mlog.Error(channelErr.Error())
			return &model.CommandResponse{Text: args.T("api.command_msg.dm_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	} else {
		targetChannelId = channel.Id
	}

	if parsedMessage != "" {
		post := &model.Post{}
		post.Message = parsedMessage
		post.ChannelId = targetChannelId
		post.UserId = args.UserId
		if _, err = a.CreatePostMissingChannel(post, true); err != nil {
			return &model.CommandResponse{Text: args.T("api.command_msg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	team, err := a.GetTeam(args.TeamId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_msg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{GotoLocation: args.SiteURL + "/" + team.Name + "/channels/" + channelName, Text: "", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}
