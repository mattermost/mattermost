// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"
	"os"

	"github.com/spf13/cobra"
)

var ExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export data.",
}

var BulkExportCmd = &cobra.Command{
	Use:     "bulk [file]",
	Short:   "Export bulk data.",
	Long:    "Export data to a file compatible with the Mattermost Bulk Import format.",
	Example: "  export bulk bulk_data.json",
	RunE:    bulkExportCmdF,
}

func init() {
	BulkExportCmd.Flags().Bool("all-teams", false, "Export all teams from the server.")

	ExportCmd.AddCommand(
		BulkExportCmd,
	)
	RootCmd.AddCommand(ExportCmd)
}

func bulkExportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	allTeams, err := command.Flags().GetBool("all-teams")
	if err != nil {
		return errors.New("Apply flag error")
	}

	if !allTeams {
		return errors.New("Nothing to export. Please specify the --all-teams flag to export all teams.")
	}

	fileWriter, err := os.Create(args[0])
	if err != nil {
		return err
	}
	defer fileWriter.Close()

	if err := a.BulkExport(fileWriter); err != nil {
		CommandPrettyPrintln(err.Error())
		return err
	}

	return nil
}
