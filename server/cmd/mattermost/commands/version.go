// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
)

var VersionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display version information",
	RunE:  versionCmdF,
}

func init() {
	VersionCmd.Flags().Bool("skip-server-start", false, "Skip the server initialization and return the Mattermost version without the DB version.")
	VersionCmd.Flags().MarkDeprecated("skip-server-start", "This flag is not necessary anymore and the flag will be removed in the future releases. Consider removing it from your scripts.")
	RootCmd.AddCommand(VersionCmd)
}

func versionCmdF(command *cobra.Command, args []string) error {
	CommandPrintln("Version: " + model.CurrentVersion)
	CommandPrintln("Build Number: " + model.BuildNumber)
	CommandPrintln("Build Date: " + model.BuildDate)
	CommandPrintln("Build Hash: " + model.BuildHash)
	CommandPrintln("Build Enterprise Ready: " + model.BuildEnterpriseReady)

	return nil
}
