// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strconv"

	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/model"
)

type ExpandProvider struct {
}

type CollapseProvider struct {
}

const (
	CMD_EXPAND   = "expand"
	CMD_COLLAPSE = "collapse"
)

func init() {
	RegisterCommandProvider(&ExpandProvider{})
	RegisterCommandProvider(&CollapseProvider{})
}

func (me *ExpandProvider) GetTrigger() string {
	return CMD_EXPAND
}

func (me *CollapseProvider) GetTrigger() string {
	return CMD_COLLAPSE
}

func (me *ExpandProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_EXPAND,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_expand.desc"),
		DisplayName:      T("api.command_expand.name"),
	}
}

func (me *CollapseProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_COLLAPSE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_collapse.desc"),
		DisplayName:      T("api.command_collapse.name"),
	}
}

func (me *ExpandProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	return a.setCollapsePreference(args, false)
}

func (me *CollapseProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	return a.setCollapsePreference(args, true)
}

func (a *App) setCollapsePreference(args *model.CommandArgs, isCollapse bool) *model.CommandResponse {
	pref := model.Preference{
		UserId:   args.UserId,
		Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
		Name:     model.PREFERENCE_NAME_COLLAPSE_SETTING,
		Value:    strconv.FormatBool(isCollapse),
	}

	if err := a.Srv.Store.Preference().Save(&model.Preferences{pref}); err != nil {
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
