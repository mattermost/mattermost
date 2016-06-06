// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
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

func (me *ExpandProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	return setCollapsePreference(c, "false")
}

func (me *CollapseProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	return setCollapsePreference(c, "true")
}

func setCollapsePreference(c *Context, value string) *model.CommandResponse {
	pref := model.Preference{
		UserId:   c.Session.UserId,
		Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
		Name:     model.PREFERENCE_NAME_COLLAPSE_SETTING,
		Value:    value,
	}

	if result := <-Srv.Store.Preference().Save(&model.Preferences{pref}); result.Err != nil {
		return &model.CommandResponse{Text: c.T("api.command_expand_collapse.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	socketMessage := model.NewMessage("", "", c.Session.UserId, model.ACTION_PREFERENCE_CHANGED)
	socketMessage.Add("preference", pref.ToJson())
	go Publish(socketMessage)

	return &model.CommandResponse{}
}
