// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/server/v8/channels/app/plugin_api_tests"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
	configuration plugin_api_tests.BasicConfig
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
		return err
	}
	return nil
}

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	uid := p.configuration.BasicUserID
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

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
