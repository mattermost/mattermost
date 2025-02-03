// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
	sessionCh chan string
}

func (p *Plugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	return nil, <-p.sessionCh
}

func (p *Plugin) WebSocketMessageHasBeenPosted(connID, userID string, req *model.WebSocketRequest) {
	p.sessionCh <- req.Session.Id
}

func main() {
	plugin.ClientMain(&Plugin{
		sessionCh: make(chan string, 1),
	})
}
