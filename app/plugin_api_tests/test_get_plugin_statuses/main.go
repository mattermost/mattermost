// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
)

type PluginGetPluginStatuses struct {
	plugin.MattermostPlugin
}

func main() {
	plugin.ClientMain(&PluginGetPluginStatuses{})
}

func (p *PluginGetPluginStatuses) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	pluginStatuses, err := p.API.GetPluginStatuses()
	if err != nil {
		return nil, err.Error()
	}

	if len(pluginStatuses) != 1 {
		return nil, errors.Errorf("expected 1 plugin statuses got %d", len(pluginStatuses)).Error()
	}

	if pluginStatuses[0].PluginId != "test_get_plugin_statuses" {
		return nil, errors.Errorf("unexpected plugin id %s", pluginStatuses[0].PluginId).Error()
	}

	return nil, "OK"
}
