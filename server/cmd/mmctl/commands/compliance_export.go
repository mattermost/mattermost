// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
)

var ComplianceExportCmd = &cobra.Command{
	Use:   "compliance_export",
	Short: "Management of compliance exports",
}

var ComplianceExportListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List compliance export jobs",
	Args:    cobra.NoArgs,
	RunE:    withClient(complianceExportListCmdF),
}

func init() {
	ComplianceExportListCmd.Flags().Int("page", 0, "Page number to fetch for the list of compliance export jobs")
	ComplianceExportListCmd.Flags().Int("per-page", DefaultPageSize, "Number of compliance export jobs to be fetched")
	ComplianceExportListCmd.Flags().Bool("all", false, "Fetch all compliance export jobs. --page flag will be ignored if provided")

	ComplianceExportCmd.AddCommand(
		ComplianceExportListCmd,
	)
	RootCmd.AddCommand(ComplianceExportCmd)
}

func complianceExportListCmdF(c client.Client, command *cobra.Command, args []string) error {
	page, _ := command.Flags().GetInt("page")
	perPage, _ := command.Flags().GetInt("per-page")
	if perPage == 0 {
		perPage = DefaultPageSize
	}
	all, _ := command.Flags().GetBool("all")

	if all {
		page = 0
		perPage = 1000
	}

	jobs, _, err := c.ListComplianceExports(context.TODO(), page, perPage)
	if err != nil {
		return fmt.Errorf("failed to get compliance export jobs: %w", err)
	}

	if len(jobs) == 0 {
		printer.Print("No compliance export jobs found")
		return nil
	}

	for _, job := range jobs {
		printJob(job)
	}

	return nil
}
