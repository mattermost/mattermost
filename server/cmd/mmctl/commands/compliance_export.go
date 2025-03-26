// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"os"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
)

var ComplianceExportCmd = &cobra.Command{
	Use:   "compliance-export",
	Short: "Management of compliance exports",
}

var ComplianceExportListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List compliance export jobs, sorted by creation date descending (newest first)",
	Args:    cobra.NoArgs,
	RunE:    withClient(complianceExportListCmdF),
}

var ComplianceExportShowCmd = &cobra.Command{
	Use:     "show [complianceExportJobID]",
	Example: "compliance-export show o98rj3ur83dp5dppfyk5yk6osy",
	Short:   "Show compliance export job",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(complianceExportShowCmdF),
}

var ComplianceExportCancelCmd = &cobra.Command{
	Use:     "cancel [complianceExportJobID]",
	Example: "compliance-export cancel o98rj3ur83dp5dppfyk5yk6osy",
	Short:   "Cancel compliance export job",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(complianceExportCancelCmdF),
}

var ComplianceExportDownloadCmd = &cobra.Command{
	Use:     "download [complianceExportJobID] [output filepath (optional)]",
	Example: "  compliance_export download o98rj3ur83dp5dppfyk5yk6osy",
	Short:   "Download compliance export file",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(complianceExportDownloadCmdF),
}

func init() {
	ComplianceExportListCmd.Flags().Int("page", 0, "Page number to fetch for the list of compliance export jobs")
	ComplianceExportListCmd.Flags().Int("per-page", DefaultPageSize, "Number of compliance export jobs to be fetched")
	ComplianceExportListCmd.Flags().Bool("all", false, "Fetch all compliance export jobs. --page flag will be ignored if provided")

	ComplianceExportDownloadCmd.Flags().Int("num-retries", 5, "Number of retries if the download fails")

	ComplianceExportCmd.AddCommand(
		ComplianceExportListCmd,
		ComplianceExportShowCmd,
		ComplianceExportCancelCmd,
		ComplianceExportDownloadCmd,
	)
	RootCmd.AddCommand(ComplianceExportCmd)
}

func complianceExportListCmdF(c client.Client, command *cobra.Command, args []string) error {
	return jobListCmdF(c, command, "message_export", "")
}

func complianceExportShowCmdF(c client.Client, command *cobra.Command, args []string) error {
	job, _, err := c.GetJob(context.TODO(), args[0])
	if err != nil {
		return fmt.Errorf("failed to get compliance export job: %w", err)
	}

	printJob(job)

	return nil
}

func complianceExportCancelCmdF(c client.Client, command *cobra.Command, args []string) error {
	if _, err := c.CancelJob(context.TODO(), args[0]); err != nil {
		return fmt.Errorf("failed to cancel compliance export job: %w", err)
	}

	return nil
}

func complianceExportDownloadCmdF(c client.Client, command *cobra.Command, args []string) error {
	jobID := args[0]
	var path string
	if len(args) > 1 {
		path = args[1]
	} else {
		path = jobID + ".zip"
	}

	retries, _ := command.Flags().GetInt("num-retries")

	var outFile *os.File
	info, err := os.Stat(path)
	switch {
	case err != nil && !os.IsNotExist(err):
		// some error occurred and not because file doesn't exist
		return fmt.Errorf("failed to stat compliance export file: %w", err)
	case err == nil && info.Size() > 0:
		// we exit to avoid overwriting an existing non-empty file
		return fmt.Errorf("compliance export file already exists")
	case err != nil:
		// file does not exist, we create it
		outFile, err = os.Create(path)
	default:
		// no error, file exists, we open it
		outFile, err = os.OpenFile(path, os.O_WRONLY, 0600)
	}

	if err != nil {
		return fmt.Errorf("failed to create/open compliance export file: %w", err)
	}
	defer outFile.Close()

	i := 0
	var suggestedFilename string
	for i < retries+1 {
		suggestedFilename, err = c.DownloadComplianceExport(context.TODO(), jobID, outFile)
		if err != nil {
			if i == retries {
				return fmt.Errorf("failed to download compliance export file: %w", err)
			}
			i++
			fmt.Printf("Download attempt %d/%d failed: %v. Retrying...\n", i, retries+1, err)
			continue
		}
		break
	}

	// If we didn't provide a path and got a suggested filename, rename the file
	if len(args) == 1 && suggestedFilename != "" && suggestedFilename != path {
		// Close the file before renaming
		outFile.Close()

		// If the suggested name already exists, don't overwrite
		if _, err := os.Stat(suggestedFilename); err == nil {
			printer.PrintWarning(fmt.Sprintf("File with suggested name %q already exists, keeping %q", suggestedFilename, path))
		} else {
			if err := os.Rename(path, suggestedFilename); err != nil {
				printer.PrintWarning(fmt.Sprintf("Could not rename file to suggested name %q: %v", suggestedFilename, err))
			} else {
				path = suggestedFilename
			}
		}
	}

	printer.Print(fmt.Sprintf("Compliance export file downloaded to %q", path))
	return nil
}
