// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"
	"os"

	"fmt"

	"github.com/spf13/cobra"
)

var ImportCmd = &cobra.Command{
	Use:   "import",
	Short: "Import data.",
}

var SlackImportCmd = &cobra.Command{
	Use:     "slack [team] [file]",
	Short:   "Import a team from Slack.",
	Long:    "Import a team from a Slack export zip file.",
	Example: "  import slack myteam slack_export.zip",
	RunE:    slackImportCmdF,
}

var BulkImportCmd = &cobra.Command{
	Use:     "bulk [file]",
	Short:   "Import bulk data.",
	Long:    "Import data from a Mattermost Bulk Import File.",
	Example: "  import bulk bulk_data.json",
	RunE:    bulkImportCmdF,
}

func init() {
	BulkImportCmd.Flags().Bool("apply", false, "Save the import data to the database. Use with caution - this cannot be reverted.")
	BulkImportCmd.Flags().Bool("validate", false, "Validate the import data without making any changes to the system.")
	BulkImportCmd.Flags().Int("workers", 2, "How many workers to run whilst doing the import.")

	ImportCmd.AddCommand(
		BulkImportCmd,
		SlackImportCmd,
	)
	RootCmd.AddCommand(ImportCmd)
}

func slackImportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) != 2 {
		return errors.New("Incorrect number of arguments.")
	}

	team := getTeamFromTeamArg(a, args[0])
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

	importErr, log := a.SlackImport(fileReader, fileInfo.Size(), team.Id)

	if importErr != nil {
		return err
	}

	CommandPrettyPrintln("")
	CommandPrintln(log.String())
	CommandPrettyPrintln("")

	CommandPrettyPrintln("Finished Slack Import.")
	CommandPrettyPrintln("")

	return nil
}

func bulkImportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	apply, err := command.Flags().GetBool("apply")
	if err != nil {
		return errors.New("Apply flag error")
	}

	validate, err := command.Flags().GetBool("validate")
	if err != nil {
		return errors.New("Validate flag error")
	}

	workers, err := command.Flags().GetInt("workers")
	if err != nil {
		return errors.New("Workers flag error")
	}

	if len(args) != 1 {
		return errors.New("Incorrect number of arguments.")
	}

	fileReader, err := os.Open(args[0])
	if err != nil {
		return err
	}
	defer fileReader.Close()

	if apply && validate {
		CommandPrettyPrintln("Use only one of --apply or --validate.")
		return nil
	}

	if apply && !validate {
		CommandPrettyPrintln("Running Bulk Import. This may take a long time.")
	} else {
		CommandPrettyPrintln("Running Bulk Import Data Validation.")
		CommandPrettyPrintln("** This checks the validity of the entities in the data file, but does not persist any changes **")
		CommandPrettyPrintln("Use the --apply flag to perform the actual data import.")
	}

	CommandPrettyPrintln("")

	if err, lineNumber := a.BulkImport(fileReader, !apply, workers); err != nil {
		CommandPrettyPrintln(err.Error())
		if lineNumber != 0 {
			CommandPrettyPrintln(fmt.Sprintf("Error occurred on data file line %v", lineNumber))
		}
		return err
	}

	if apply {
		CommandPrettyPrintln("Finished Bulk Import.")
	} else {
		CommandPrettyPrintln("Validation complete. You can now perform the import by rerunning this command with the --apply flag.")
	}

	return nil
}
