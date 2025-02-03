// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/v8/channels/app/plugin_api_tests"
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
	if p.API.HasPermissionTo(p.configuration.BasicUserID, model.PermissionManageSystem) {
		return nil, "basic user should not yet be a system admin"
	}

	if _, appErr := p.API.UpdateUserRoles(p.configuration.BasicUserID, model.SystemAdminRoleId+" "+model.SystemUserRoleId); appErr != nil {
		return nil, fmt.Sprintf("failed to update user roles: %s", appErr)
	}

	if !p.API.HasPermissionTo(p.configuration.BasicUserID, model.PermissionManageSystem) {
		return nil, "basic user should be a system admin"
	}

	if _, appErr := p.API.UpdateUserRoles(p.configuration.BasicUserID, model.SystemUserRoleId); appErr != nil {
		return nil, fmt.Sprintf("failed to update user roles: %s", appErr)
	}

	if p.API.HasPermissionTo(p.configuration.BasicUserID, model.PermissionManageSystem) {
		return nil, "basic user should no longer be a system admin"
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
