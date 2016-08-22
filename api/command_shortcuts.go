// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"strings"

	"github.com/mattermost/platform/model"
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
	shortcutIds := [4]string{
		"api.command_shortcuts.nav",
		"api.command_shortcuts.files",
		"api.command_shortcuts.msgs",
		"api.command_shortcuts.browser",
	}

	var buffer bytes.Buffer
	if strings.Contains(message, "mac") {
		for _, element := range shortcutIds {
			buffer.WriteString(c.T(element + "_mac"))
		}
	} else {
		for _, element := range shortcutIds {
			buffer.WriteString(c.T(element))
		}
	}

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: buffer.String()}
}
