package main

import (
	"fmt"

	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/utils"
	"github.com/spf13/cobra"
)

func doLoadConfig(filename string) (err string) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Sprintf("%v", r)
		}
	}()
	utils.TranslationsPreInit()
	utils.LoadConfig(filename)
	return ""
}

func initDBCommandContextCobra(cmd *cobra.Command) error {
	config, err := cmd.Flags().GetString("config")
	if err != nil {
		return err
	}
	initDBCommandContext(config)

	return nil
}

func initDBCommandContext(configFileLocation string) {
	if errstr := doLoadConfig(configFileLocation); errstr != "" {
		return
	}

	utils.ConfigureCmdLineLog()

	api.NewServer()
	api.InitStores()
}
