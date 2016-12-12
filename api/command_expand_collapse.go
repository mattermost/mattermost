// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strconv"

	"github.com/mattermost/platform/model"
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

func (me *ExpandProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_EXPAND,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_expand.desc"),
		DisplayName:      c.T("api.command_expand.name"),
	}
}

func (me *CollapseProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_COLLAPSE,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_collapse.desc"),
		DisplayName:      c.T("api.command_collapse.name"),
	}
}

func (me *ExpandProvider) DoCommand(c *Context, args *model.CommandArgs, message string) *model.CommandResponse {
	return setCollapsePreference(c, false)
}

func (me *CollapseProvider) DoCommand(c *Context, args *model.CommandArgs, message string) *model.CommandResponse {
	return setCollapsePreference(c, true)
}

func setCollapsePreference(c *Context, isCollapse bool) *model.CommandResponse {
	pref := model.Preference{
		UserId:   c.Session.UserId,
		Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
		Name:     model.PREFERENCE_NAME_COLLAPSE_SETTING,
		Value:    strconv.FormatBool(isCollapse),
	}

	if result := <-Srv.Store.Preference().Save(&model.Preferences{pref}); result.Err != nil {
		return &model.CommandResponse{Text: c.T("api.command_expand_collapse.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	socketMessage := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PREFERENCE_CHANGED, "", "", c.Session.UserId, nil)
	socketMessage.Add("preference", pref.ToJson())
	go Publish(socketMessage)

	var rmsg string

	if isCollapse {
		rmsg = c.T("api.command_collapse.success")
	} else {
		rmsg = c.T("api.command_expand.success")
	}
	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: rmsg}
}
