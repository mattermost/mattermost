// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"strings"
)

type ShortcutsProvider struct {
}

const (
	CMD_SHORTCUTS = "shortcuts"
)

func init() {
	RegisterCommandProvider(&ShortcutsProvider{})
}

func (me *ShortcutsProvider) GetTrigger() string {
	return CMD_SHORTCUTS
}

func (me *ShortcutsProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_SHORTCUTS,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_shortcuts.desc"),
		AutoCompleteHint: "",
		DisplayName:      c.T("api.command_shortcuts.name"),
	}
}

func (me *ShortcutsProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	stringId := "api.command_shortcuts.list"

	if strings.Contains(message, "mac") {
		stringId = "api.command_shortcuts.list_mac"
	}

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T(stringId)}
}
