// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"fmt"

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
	data := []byte("some data")

	appErr := p.API.KVSet("some_key", data)
	if appErr != nil {
		return nil, appErr.Error()
	}

	rData, appErr := p.API.KVGet("some_key")
	if appErr != nil {
		return nil, appErr.Error()
	}
	if !bytes.Equal(data, rData) {
		return nil, fmt.Sprintf("Data not equal, expected: %s, got: %s", string(data), string(rData))
	}

	data = []byte("some other data")

	var longKey string
	for i := 0; i < model.KeyValueKeyMaxRunes; i++ {
		longKey += "k"
	}

	appErr = p.API.KVSet(longKey, data)
	if appErr != nil {
		return nil, appErr.Error()
	}

	rData, appErr = p.API.KVGet(longKey)
	if appErr != nil {
		return nil, appErr.Error()
	}

	if !bytes.Equal(data, rData) {
		return nil, fmt.Sprintf("Data not equal, expected: %s, got: %s", string(data), string(rData))
	}

	longKey += "extra"

	appErr = p.API.KVSet(longKey, data)
	if appErr == nil {
		return nil, "Should have gotten an error for a to long key"
	}

	rData, appErr = p.API.KVGet(longKey)
	if appErr != nil {
		return nil, "Should have gotten an error for a to long key"
	}
	if rData != nil {
		return nil, "Returned data should have been nil"
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
