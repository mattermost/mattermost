// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/audit"
)

var ImportCmd = &cobra.Command{
	Use:   "import",
	Short: "Import data.",
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
	BulkImportCmd.Flags().String("import-path", "", "A path to the data directory to import files from.")

	ImportCmd.AddCommand(
		BulkImportCmd,
	)
	RootCmd.AddCommand(ImportCmd)
}

func bulkImportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	apply, err := command.Flags().GetBool("apply")
	if err != nil {
		return errors.New("apply flag error")
	}

	validate, err := command.Flags().GetBool("validate")
	if err != nil {
		return errors.New("validate flag error")
	}

	workers, err := command.Flags().GetInt("workers")
	if err != nil {
		return errors.New("workers flag error")
	}

	importPath, err := command.Flags().GetString("import-path")
	if err != nil {
		return errors.New("import-path flag error")
	}

	if len(args) != 1 {
		return errors.New("incorrect number of arguments")
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

	if err, lineNumber := a.BulkImportWithPath(&request.Context{}, fileReader, nil, !apply, workers, importPath); err != nil {
		CommandPrintErrorln(err.Error())
		if lineNumber != 0 {
			CommandPrintErrorln(fmt.Sprintf("Error occurred on data file line %v", lineNumber))
		}
		return err
	}

	if apply {
		CommandPrettyPrintln("Finished Bulk Import.")
		auditRec := a.MakeAuditRecord("bulkImport", audit.Success)
		auditRec.AddMeta("file", args[0])
		a.LogAuditRec(auditRec, nil)
	} else {
		CommandPrettyPrintln("Validation complete. You can now perform the import by rerunning this command with the --apply flag.")
	}

	return nil
}
