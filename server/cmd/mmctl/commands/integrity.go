// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"

	"github.com/hashicorp/go-multierror"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

var IntegrityCmd = &cobra.Command{
	Use:    "integrity",
	Short:  "Check database records integrity.",
	Long:   "Perform a relational integrity check which returns information about any orphaned record found.",
	Args:   cobra.NoArgs,
	PreRun: localOnlyPrecheck,
	RunE:   withClient(integrityCmdF),
}

func init() {
	IntegrityCmd.Flags().Bool("confirm", false, "Confirm you really want to run a complete integrity check that may temporarily harm system performance")
	IntegrityCmd.Flags().BoolP("verbose", "v", false, "Show detailed information on integrity check results")
	RootCmd.AddCommand(IntegrityCmd)
}

func printRelationalIntegrityCheckResult(data model.RelationalIntegrityCheckData, verbose bool) {
	printer.PrintT("Found {{len .Records}} in relation {{ .ChildName }} orphans of relation {{ .ParentName }}", data)
	if !verbose {
		return
	}
	const null = "NULL"
	const empty = "empty"
	for _, record := range data.Records {
		var parentID string

		switch {
		case record.ParentId == nil:
			parentID = null
		case *record.ParentId == "":
			parentID = empty
		default:
			parentID = *record.ParentId
		}

		if record.ChildId != nil {
			if parentID == null || parentID == empty {
				fmt.Printf("  Child %s (%s.%s) has %s ParentIdAttr (%s.%s)\n", *record.ChildId, data.ChildName, data.ChildIdAttr, parentID, data.ChildName, data.ParentIdAttr)
			} else {
				fmt.Printf("  Child %s (%s.%s) is missing Parent %s (%s.%s)\n", *record.ChildId, data.ChildName, data.ChildIdAttr, parentID, data.ChildName, data.ParentIdAttr)
			}
		} else {
			if parentID == null || parentID == empty {
				fmt.Printf("  Child has %s ParentIdAttr (%s.%s)\n", parentID, data.ChildName, data.ParentIdAttr)
			} else {
				fmt.Printf("  Child is missing Parent %s (%s.%s)\n", parentID, data.ChildName, data.ParentIdAttr)
			}
		}
	}
}

func printIntegrityCheckResult(result model.IntegrityCheckResult, verbose bool) {
	switch data := result.Data.(type) {
	case model.RelationalIntegrityCheckData:
		printRelationalIntegrityCheckResult(data, verbose)
	default:
		printer.PrintError("invalid data type")
	}
}

func integrityCmdF(c client.Client, command *cobra.Command, args []string) error {
	confirmFlag, _ := command.Flags().GetBool("confirm")
	if !confirmFlag {
		if err := getConfirmation("This check may harm performance on live systems. Are you sure you want to proceed?", false); err != nil {
			return err
		}
	}

	verboseFlag, _ := command.Flags().GetBool("verbose")

	results, _, err := c.CheckIntegrity(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to perform integrity check. Error: %w", err)
	}

	var errs *multierror.Error
	for _, result := range results {
		if result.Err != nil {
			errs = multierror.Append(errs, result.Err)
			printer.PrintError(result.Err.Error())
			continue
		}
		printIntegrityCheckResult(result, verboseFlag)
	}

	return errs.ErrorOrNil()
}
