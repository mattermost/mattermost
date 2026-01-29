// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type WikiMentionsProvider struct {
}

const (
	CmdWikiMentions = "wiki_mentions"
)

func init() {
	app.RegisterCommandProvider(&WikiMentionsProvider{})
}

func (*WikiMentionsProvider) GetTrigger() string {
	return CmdWikiMentions
}

func (*WikiMentionsProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdWikiMentions,
		AutoComplete:     true,
		AutoCompleteDesc: "Toggle whether page mentions appear in channel feed",
		AutoCompleteHint: "[on|off]",
		DisplayName:      "Wiki Mentions",
	}
}

func (*WikiMentionsProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(rctx, args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         "Unable to get channel.",
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	if hasPermission, _ := a.HasPermissionToChannel(rctx, args.UserId, args.ChannelId, model.PermissionManageChannelRoles); !hasPermission {
		return &model.CommandResponse{
			Text:         "You don't have permission to modify wiki settings for this channel.",
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	wikis, getErr := a.GetWikisForChannel(rctx, channel.Id, false)
	if getErr != nil {
		return &model.CommandResponse{
			Text:         "Unable to get wikis for this channel.",
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	if len(wikis) == 0 {
		return &model.CommandResponse{
			Text:         "This channel has no wikis.",
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	wiki := wikis[0]

	message = strings.TrimSpace(strings.ToLower(message))
	if message == "" {
		currentStatus := "off"
		if wiki.ShowMentionsInChannelFeed() {
			currentStatus = "on"
		}
		return &model.CommandResponse{
			Text:         "Page mentions in channel feed are currently: **" + currentStatus + "**\nUsage: `/wiki_mentions [on|off]`",
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	var enable bool
	switch message {
	case "on", "true", "enable", "enabled":
		enable = true
	case "off", "false", "disable", "disabled":
		enable = false
	default:
		return &model.CommandResponse{
			Text:         "Invalid argument. Use 'on' or 'off'.",
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	wiki.SetShowMentionsInChannelFeed(enable)

	if _, updateErr := a.UpdateWiki(rctx, wiki); updateErr != nil {
		return &model.CommandResponse{
			Text:         "Failed to update wiki settings.",
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	status := "disabled"
	if enable {
		status = "enabled"
	}

	return &model.CommandResponse{
		Text:         "Page mentions in channel feed have been **" + status + "** for wiki: " + wiki.Title,
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}
