// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"time"

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
	firstExpiry := time.Now().Add(time.Minute)
	session := &model.Session{
		UserId:    p.configuration.BasicUser2Id,
		ExpiresAt: model.GetMillisForTime(firstExpiry),
	}
	session, appErr := p.API.CreateSession(session)
	if appErr != nil {
		return nil, appErr.Error()
	}

	newExpiry := firstExpiry.Add(time.Minute)
	appErr = p.API.ExtendSessionExpiry(session.Id, model.GetMillisForTime(newExpiry))
	if appErr != nil {
		return nil, appErr.Error()
	}

	rSession, appErr := p.API.GetSession(session.Id)
	if appErr != nil {
		return nil, appErr.Error()
	}
	if rSession.ExpiresAt != model.GetMillisForTime(firstExpiry.Add(time.Minute)) {
		return nil, fmt.Sprintf("ExpiresAt not equal, expected: %v, got: %v", model.GetMillisForTime(firstExpiry.Add(time.Minute)), rSession.ExpiresAt)
	}

	appErr = p.API.RevokeSession(session.Id)
	if appErr != nil {
		return nil, appErr.Error()
	}

	rSession, appErr = p.API.GetSession(session.Id)
	if appErr == nil {
		return nil, "Session should not be found"
	}
	if rSession != nil {
		return nil, "Returned session should be nil"
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
