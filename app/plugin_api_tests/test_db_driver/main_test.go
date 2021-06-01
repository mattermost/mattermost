// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	// "context"
	"database/sql"
	"testing"

	"github.com/mattermost/mattermost-server/v5/app/plugin_api_tests"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/shared/driver"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
)

type MyPlugin struct {
	plugin.MattermostPlugin
	config plugin_api_tests.BasicConfig
	t      *testing.T
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.config); err != nil {
		return err
	}
	return nil
}

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	str := "echo test via driver"
	if p.Driver.Hello(str) != str {
		return nil, "unexpected response string"
	}

	store := sqlstore.New(p.API.GetUnsanitizedConfig().SqlSettings, nil)
	store.GetMaster().Db.Close()

	connector, err := driver.NewConnector(p.Driver)
	if err != nil {
		return nil, err.Error()
	}
	store.GetMaster().Db = sql.OpenDB(connector)
	defer store.GetMaster().Db.Close()

	// Testing with a handful of stores
	storetest.TestUserStore(p.t, store, store)
	storetest.TestTeamStore(p.t, store)
	storetest.TestChannelStore(p.t, store, store)
	storetest.TestBotStore(p.t, store, store)

	// Use the API to instantiate the driver
	// And then run the full suite of tests.
	return nil, "OK"
}

// TestDBAPI is a test function which actually runs a plugin. The objective
// is to run the storetest suite from inside a plugin.
//
// The test runner compiles the test code to a binary, and runs it as a normal
// binary. But under the hood, a test runs.
func TestDBAPI(t *testing.T) {
	plugin.ClientMain(&MyPlugin{t: t})
}
