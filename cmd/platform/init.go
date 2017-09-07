package main

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/spf13/cobra"
)

func initDBCommandContextCobra(cmd *cobra.Command) error {
	config, err := cmd.Flags().GetString("config")
	if err != nil {
		return err
	}

	if err := initDBCommandContext(config); err != nil {
		// Returning an error just prints the usage message, so actually panic
		panic(err)
	}

	return nil
}

func initDBCommandContext(configFileLocation string) error {
	if err := utils.InitAndLoadConfig(configFileLocation); err != nil {
		return err
	}

	utils.ConfigureCmdLineLog()

	app.Global().NewServer()
	app.Global().InitStores()
	if model.BuildEnterpriseReady == "true" {
		app.Global().LoadLicense()
	}

	return nil
}
