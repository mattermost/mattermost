// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/spf13/cobra"
)

var ComplianceExportCmd = &cobra.Command{
	Use:   "compliance_export",
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
	Example: "  compliance_export show o98rj3ur83dp5dppfyk5yk6osy",
	Short:   "Show compliance export job",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(complianceExportShowCmdF),
}

func init() {
	ComplianceExportListCmd.Flags().Int("page", 0, "Page number to fetch for the list of compliance export jobs")
	ComplianceExportListCmd.Flags().Int("per-page", DefaultPageSize, "Number of compliance export jobs to be fetched")
	ComplianceExportListCmd.Flags().Bool("all", false, "Fetch all compliance export jobs. --page flag will be ignored if provided")

	ComplianceExportCmd.AddCommand(
		ComplianceExportListCmd,
		ComplianceExportShowCmd,
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
