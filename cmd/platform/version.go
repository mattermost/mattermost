// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
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
	CommandPrintln("DB Version: " + app.Srv.Store.(*store.LayeredStore).DatabaseLayer.GetCurrentSchemaVersion())
}
