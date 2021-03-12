// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strconv"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

type ExpandProvider struct {
}

type CollapseProvider struct {
}

const (
	CmdExpand   = "expand"
	CmdCollapse = "collapse"
)

func init() {
	app.RegisterCommandProvider(&ExpandProvider{})
	app.RegisterCommandProvider(&CollapseProvider{})
}

func (*ExpandProvider) GetTrigger() string {
	return CmdExpand
}

func (*CollapseProvider) GetTrigger() string {
	return CmdCollapse
}

func (*ExpandProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdExpand,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_expand.desc"),
		DisplayName:      T("api.command_expand.name"),
	}
}

func (*CollapseProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdCollapse,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_collapse.desc"),
		DisplayName:      T("api.command_collapse.name"),
	}
}

func (*ExpandProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	return setCollapsePreference(a, args, false)
}

func (*CollapseProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	return setCollapsePreference(a, args, true)
}

func setCollapsePreference(a *app.App, args *model.CommandArgs, isCollapse bool) *model.CommandResponse {
	pref := model.Preference{
		UserId:   args.UserId,
		Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
		Name:     model.PREFERENCE_NAME_COLLAPSE_SETTING,
		Value:    strconv.FormatBool(isCollapse),
	}

	if err := a.Srv().Store.Preference().Save(&model.Preferences{pref}); err != nil {
		return &model.CommandResponse{Text: args.T("api.command_expand_collapse.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	socketMessage := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PREFERENCE_CHANGED, "", "", args.UserId, nil)
	socketMessage.Add("preference", pref.ToJson())
	a.Publish(socketMessage)

	var rmsg string

	if isCollapse {
		rmsg = args.T("api.command_collapse.success")
	} else {
		rmsg = args.T("api.command_expand.success")
	}
	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: rmsg}
}
