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

func (me *ShortcutsProvider) DoCommand(c *Context, args *model.CommandArgs, message string) *model.CommandResponse {
	shortcutIds := [28]string{
		"api.command_shortcuts.header",
		// Nav shortcuts
		"api.command_shortcuts.nav.header",
		"api.command_shortcuts.nav.prev",
		"api.command_shortcuts.nav.next",
		"api.command_shortcuts.nav.unread_prev",
		"api.command_shortcuts.nav.unread_next",
		"api.command_shortcuts.nav.switcher",
		"api.command_shortcuts.nav.settings",
		"api.command_shortcuts.nav.recent_mentions",
		// Files shortcuts
		"api.command_shortcuts.files.header",
		"api.command_shortcuts.files.upload",
		// Msg shortcuts
		"api.command_shortcuts.msgs.header",
		"api.command_shortcuts.msgs.mark_as_read",
		"api.command_shortcuts.msgs.reprint_prev",
		"api.command_shortcuts.msgs.reprint_next",
		"api.command_shortcuts.msgs.edit",
		"api.command_shortcuts.msgs.comp_username",
		"api.command_shortcuts.msgs.comp_channel",
		"api.command_shortcuts.msgs.comp_emoji",
		// Browser shortcuts
		"api.command_shortcuts.browser.header",
		"api.command_shortcuts.browser.channel_prev",
		"api.command_shortcuts.browser.channel_next",
		"api.command_shortcuts.browser.font_increase",
		"api.command_shortcuts.browser.font_decrease",
		"api.command_shortcuts.browser.highlight_prev",
		"api.command_shortcuts.browser.highlight_next",
		"api.command_shortcuts.browser.newline",
	}

	var osDependentWords map[string]interface{}
	if strings.Contains(message, "mac") {
		osDependentWords = map[string]interface{}{
			"CmdOrCtrl":      c.T("api.command_shortcuts.cmd"),
			"ChannelPrevCmd": c.T("api.command_shortcuts.browser.channel_prev.cmd_mac"),
			"ChannelNextCmd": c.T("api.command_shortcuts.browser.channel_next.cmd_mac"),
		}
	} else {
		osDependentWords = map[string]interface{}{
			"CmdOrCtrl":      c.T("api.command_shortcuts.ctrl"),
			"ChannelPrevCmd": c.T("api.command_shortcuts.browser.channel_prev.cmd"),
			"ChannelNextCmd": c.T("api.command_shortcuts.browser.channel_next.cmd"),
		}
	}

	var buffer bytes.Buffer
	for _, element := range shortcutIds {
		buffer.WriteString(c.T(element, osDependentWords))
	}

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: buffer.String()}
}
