// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display version information",
	RunE:  versionCmdF,
}

func versionCmdF(cmd *cobra.Command, args []string) error {
	if err := initDBCommandContextCobra(cmd); err != nil {
		return err
	}

	printVersion()

	return nil
}

func printVersion() {
	CommandPrintln("Version: " + model.CurrentVersion)
	CommandPrintln("Build Number: " + model.BuildNumber)
	CommandPrintln("Build Date: " + model.BuildDate)
	CommandPrintln("Build Hash: " + model.BuildHash)
	CommandPrintln("Build Enterprise Ready: " + model.BuildEnterpriseReady)
	CommandPrintln("DB Version: " + app.Global().Srv.Store.(*store.LayeredStore).DatabaseLayer.GetCurrentSchemaVersion())
}
