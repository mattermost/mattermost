// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/spf13/cobra"
)

func InitDBCommandContextCobra(command *cobra.Command) (*app.App, error) {
	config, err := command.Flags().GetString("config")
	if err != nil {
		return nil, err
	}

	i18nOverride, _ := command.Flags().GetString("i18n-override")
	mailOverride, _ := command.Flags().GetString("mail-templates-override")
	clientOverride, _ := command.Flags().GetString("client-override")

	a, err := InitDBCommandContext(
		config,
		i18nOverride,
		mailOverride,
		clientOverride,
	)
	a.InitPlugins(*a.Config().PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory)

	if err != nil {
		// Returning an error just prints the usage message, so actually panic
		panic(err)
	}

	a.DoAdvancedPermissionsMigration()
	a.DoEmojisPermissionsMigration()

	return a, nil
}

func InitDBCommandContext(configFileLocation, i18nOverride, mailOverride, clientOverride string) (*app.App, error) {
	if err := utils.TranslationsPreInit(i18nOverride); err != nil {
		return nil, err
	}
	model.AppErrorInit(utils.T)

	a, err := app.New(app.ConfigFile(configFileLocation), app.StaticsOverride(i18nOverride, mailOverride, clientOverride))
	if err != nil {
		return nil, err
	}

	if model.BuildEnterpriseReady == "true" {
		a.LoadLicense()
	}

	return a, nil
}
