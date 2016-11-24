// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"errors"
	"os"

	"github.com/mattermost/platform/api"
	"github.com/spf13/cobra"
)

var importCmd = &cobra.Command{
	Use:   "import",
	Short: "Import data.",
}

var slackImportCmd = &cobra.Command{
	Use:     "slack [team] [file]",
	Short:   "Import a team from Slack.",
	Long:    "Import a team from a Slack export zip file.",
	Example: "  import slack myteam slack_export.zip",
	RunE:    slackImportCmdF,
}

func init() {
	importCmd.AddCommand(
		slackImportCmd,
	)
}

func slackImportCmdF(cmd *cobra.Command, args []string) error {
	initDBCommandContextCobra(cmd)

	if len(args) != 2 {
		return errors.New("Incorrect number of arguments.")
	}

	team := getTeamFromTeamArg(args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	fileReader, err := os.Open(args[1])
	if err != nil {
		return err
	}
	defer fileReader.Close()

	fileInfo, err := fileReader.Stat()
	if err != nil {
		return err
	}

	CommandPrettyPrintln("Running Slack Import. This may take a long time for large teams or teams with many messages.")

	api.SlackImport(fileReader, fileInfo.Size(), team.Id)

	CommandPrettyPrintln("Finished Slack Import.")

	return nil
}
