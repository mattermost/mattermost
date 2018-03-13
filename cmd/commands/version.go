// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/cmd"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/spf13/cobra"
)

var VersionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display version information",
	RunE:  versionCmdF,
}

func init() {
	cmd.RootCmd.AddCommand(VersionCmd)
}

func versionCmdF(command *cobra.Command, args []string) error {
	a, err := cmd.InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}

	printVersion(a)

	return nil
}

func printVersion(a *app.App) {
	cmd.CommandPrintln("Version: " + model.CurrentVersion)
	cmd.CommandPrintln("Build Number: " + model.BuildNumber)
	cmd.CommandPrintln("Build Date: " + model.BuildDate)
	cmd.CommandPrintln("Build Hash: " + model.BuildHash)
	cmd.CommandPrintln("Build Enterprise Ready: " + model.BuildEnterpriseReady)
	if supplier, ok := a.Srv.Store.(*store.LayeredStore).DatabaseLayer.(*sqlstore.SqlSupplier); ok {
		cmd.CommandPrintln("DB Version: " + supplier.GetCurrentSchemaVersion())
	}
}
