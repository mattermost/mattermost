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
	initDBCommandContext(config)

	return nil
}

func initDBCommandContext(configFileLocation string) {
	if errstr := utils.InitAndLoadConfig(configFileLocation); errstr != "" {
		return
	}

	utils.ConfigureCmdLineLog()

	app.NewServer()
	app.InitStores()
	if model.BuildEnterpriseReady == "true" {
		app.LoadLicense()
	}
}
