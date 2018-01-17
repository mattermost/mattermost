// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/spf13/cobra"
)

func initDBCommandContextCobra(cmd *cobra.Command) (*app.App, error) {
	config, err := cmd.Flags().GetString("config")
	if err != nil {
		return nil, err
	}

	a, err := initDBCommandContext(config)
	if err != nil {
		// Returning an error just prints the usage message, so actually panic
		panic(err)
	}

	return a, nil
}

func initDBCommandContext(configFileLocation string) (*app.App, error) {
	if err := utils.InitAndLoadConfig(configFileLocation); err != nil {
		return nil, err
	}

	utils.ConfigureCmdLineLog()

	a := app.New(app.ConfigFile(configFileLocation))
	if model.BuildEnterpriseReady == "true" {
		a.LoadLicense()
	}

	return a, nil
}
