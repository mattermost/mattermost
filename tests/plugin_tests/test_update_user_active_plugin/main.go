// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	uid := "{{.BasicUser.Id}}"
	if err := p.API.UpdateUserActive(uid, true); err != nil {
		return nil, err.Error()
	}

	user, err := p.API.GetUser(uid)
	if err != nil {
		return nil, err.Error()
	}

	if int64(0) != user.DeleteAt {
		return nil, "DeleteAt value is not 0"
	}

	if err = p.API.UpdateUserActive(uid, false); err != nil {
		return nil, err.Error()
	}

	user, err = p.API.GetUser(uid)
	if err != nil {
		return nil, err.Error()
	}
	if user == nil {
		return nil, "GetUser returned nil"
	}

	if int64(0) == user.DeleteAt {
		return nil, "DeleteAt value is 0"
	}

	if err = p.API.UpdateUserActive(uid, true); err != nil {
		return nil, err.Error()
	}

	if err = p.API.UpdateUserActive(uid, true); err != nil {
		return nil, err.Error()
	}

	user, err = p.API.GetUser(uid)
	if err != nil {
		return nil, err.Error()
	}

	if int64(0) != user.DeleteAt {
		return nil, "DeleteAt value is not 0"
	}

	return nil, ""
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
