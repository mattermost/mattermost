// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

var VersionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display version information",
	RunE:  versionCmdF,
}

func init() {
	VersionCmd.Flags().Bool("skip-server-start", false, "Skip the server initialization and return the Mattermost version without the DB version.")

	RootCmd.AddCommand(VersionCmd)
}

func versionCmdF(command *cobra.Command, args []string) error {
	skipStart, _ := command.Flags().GetBool("skip-server-start")
	if skipStart {
		printVersionNoDB()
		return nil
	}

	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	printVersion(a)

	return nil
}

func printVersion(a *app.App) {
	printVersionNoDB()
	CommandPrintln("DB Version: " + a.Srv().Store.GetCurrentSchemaVersion())
}

func printVersionNoDB() {
	CommandPrintln("Version: " + model.CurrentVersion)
	CommandPrintln("Build Number: " + model.BuildNumber)
	CommandPrintln("Build Date: " + model.BuildDate)
	CommandPrintln("Build Hash: " + model.BuildHash)
	CommandPrintln("Build Enterprise Ready: " + model.BuildEnterpriseReady)
}
