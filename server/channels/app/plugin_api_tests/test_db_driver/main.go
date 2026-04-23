// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main_test

import (
	"database/sql"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/driver"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/plugin_api_tests"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
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
	rctx := request.TestContext(p.t)
	settings := p.API.GetUnsanitizedConfig().SqlSettings
	settings.Trace = model.NewPointer(false)
	store, err := sqlstore.New(settings, rctx.Logger(), nil, sqlstore.DisableMorphLogging())
	if err != nil {
		panic(err)
	}
	store.GetMaster().Close()

	for _, isMaster := range []bool{true, false} {
		handle := sql.OpenDB(driver.NewConnector(p.Driver, isMaster))
		store.SetMasterX(handle)

		store.GetMaster().Close()
	}

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
