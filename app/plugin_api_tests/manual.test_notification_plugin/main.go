// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func (p *MyPlugin) NotificationWillBeSent(c *plugin.Context, post *model.Post, mentions *model.ExplicitMentions) *model.ExplicitMentions {
	return nil
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
