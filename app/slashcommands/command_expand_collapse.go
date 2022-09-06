// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"encoding/json"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
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

func (*ExpandProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	return setCollapsePreference(a, args, false)
}

func (*CollapseProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	return setCollapsePreference(a, args, true)
}

func setCollapsePreference(a *app.App, args *model.CommandArgs, isCollapse bool) *model.CommandResponse {
	pref := model.Preference{
		UserId:   args.UserId,
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameCollapseSetting,
		Value:    strconv.FormatBool(isCollapse),
	}

	if err := a.Srv().Store().Preference().Save(model.Preferences{pref}); err != nil {
		return &model.CommandResponse{Text: args.T("api.command_expand_collapse.fail.app_error") + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}
	}

	socketMessage := model.NewWebSocketEvent(model.WebsocketEventPreferenceChanged, "", "", args.UserId, nil, "")

	prefJSON, err := json.Marshal(pref)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.marshal_error") + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}
	}
	socketMessage.Add("preference", string(prefJSON))
	a.Publish(socketMessage)

	var rmsg string

	if isCollapse {
		rmsg = args.T("api.command_collapse.success")
	} else {
		rmsg = args.T("api.command_expand.success")
	}
	return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: rmsg}
}
