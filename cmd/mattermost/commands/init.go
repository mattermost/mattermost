// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func initDBCommandContextCobra(command *cobra.Command, readOnlyConfigStore bool) (*app.App, error) {
	a, err := initDBCommandContext(getConfigDSN(command, config.GetEnvironment()), readOnlyConfigStore)
	if err != nil {
		// Returning an error just prints the usage message, so actually panic
		panic(err)
	}

	c := request.EmptyContext(a.Log())
	a.InitPlugins(c, *a.Config().PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory)
	a.DoAppMigrations(c)

	return a, nil
}

func InitDBCommandContextCobra(command *cobra.Command) (*app.App, error) {
	return initDBCommandContextCobra(command, true)
}

func InitDBCommandContextCobraReadWrite(command *cobra.Command) (*app.App, error) {
	return initDBCommandContextCobra(command, false)
}

func initDBCommandContext(configDSN string, readOnlyConfigStore bool) (*app.App, error) {
	if err := utils.TranslationsPreInit(); err != nil {
		return nil, err
	}
	model.AppErrorInit(i18n.T)

	s, err := app.NewServer(
		// The option order is important as app.Config option reads app.StartMetrics option.
		app.StartMetrics,
		app.Config(configDSN, readOnlyConfigStore, nil),
		app.StartSearchEngine,
	)
	if err != nil {
		return nil, err
	}

	a := app.New(app.ServerConnector(s.Channels()))

	if model.BuildEnterpriseReady == "true" {
		a.Srv().LoadLicense(request.EmptyContext(a.Log()))
	}

	return a, nil
}
