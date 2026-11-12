// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
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
	for i := range 5 {
		for _, prefix := range []string{"alpha_", "beta_"} {
			if appErr := p.API.KVSet(fmt.Sprintf("%s%d", prefix, i), []byte("v")); appErr != nil {
				return nil, appErr.Error()
			}
		}
	}

	client := pluginapi.NewClient(p.API, p.Driver)

	testCases := []struct {
		name    string
		page    int
		count   int
		options []pluginapi.ListKeysOption
		want    []string
	}{
		{"prefix alpha_", 0, 100, []pluginapi.ListKeysOption{pluginapi.WithPrefix("alpha_")}, []string{"alpha_0", "alpha_1", "alpha_2", "alpha_3", "alpha_4"}},
		{"prefix beta_", 0, 100, []pluginapi.ListKeysOption{pluginapi.WithPrefix("beta_")}, []string{"beta_0", "beta_1", "beta_2", "beta_3", "beta_4"}},
		{"prefix with no match", 0, 100, []pluginapi.ListKeysOption{pluginapi.WithPrefix("gamma_")}, []string{}},
		{"two prefixes must both match", 0, 100, []pluginapi.ListKeysOption{pluginapi.WithPrefix("alpha_"), pluginapi.WithPrefix("alpha_1")}, []string{"alpha_1"}},
		{"page over the filtered keys", 1, 2, []pluginapi.ListKeysOption{pluginapi.WithPrefix("beta_")}, []string{"beta_2", "beta_3"}},
		{"no prefix", 0, 100, nil, []string{"alpha_0", "alpha_1", "alpha_2", "alpha_3", "alpha_4", "beta_0", "beta_1", "beta_2", "beta_3", "beta_4"}},
	}

	for _, tc := range testCases {
		keys, err := client.KV.ListKeys(tc.page, tc.count, tc.options...)
		if err != nil {
			return nil, fmt.Sprintf("%s: %s", tc.name, err.Error())
		}
		if !slices.Equal(tc.want, keys) {
			return nil, fmt.Sprintf("%s: expected %v, got %v", tc.name, tc.want, keys)
		}
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
