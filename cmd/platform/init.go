package main

import (
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
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

	app.NewServer()
	app.InitStores()
	if model.BuildEnterpriseReady == "true" {
		app.LoadLicense()
	}

	return nil
}
