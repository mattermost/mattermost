// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/spf13/cobra"
)

var ExtractCmd = &cobra.Command{
	Use:   "extract",
	Short: "Management of content extraction job.",
}

var ExtractRunCmd = &cobra.Command{
	Use:     "run",
	Example: "  extract run",
	Short:   "Start a content extraction job.",
	Args:    cobra.NoArgs,
	RunE:    withClient(extractRunCmdF),
}

var ExtractJobCmd = &cobra.Command{
	Use:   "job",
	Short: "List and show content extraction jobs",
}

var ExtractJobListCmd = &cobra.Command{
	Use:     "list",
	Example: "  extract job list",
	Short:   "List content extraction jobs",
	Aliases: []string{"ls"},
	Args:    cobra.NoArgs,
	RunE:    withClient(extractJobListCmdF),
}

var ExtractJobShowCmd = &cobra.Command{
	Use:     "show [extractJobID]",
	Example: " extract job show f3d68qkkm7n8xgsfxwuo498rah",
	Short:   "Show extract job",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(extractJobShowCmdF),
}

func init() {
	ExtractRunCmd.Flags().Int64("from", 0, "The timestamp of the earliest file to extract, expressed in seconds since the unix epoch.")
	ExtractRunCmd.Flags().Int64("to", 0, "The timestamp of the latest file to extract, expressed in seconds since the unix epoch. Defaults to the current time.")
	ExtractJobListCmd.Flags().Int("page", 0, "Page number to fetch for the list of extract jobs")
	ExtractJobListCmd.Flags().Int("per-page", 200, "Number of extract jobs to be fetched")
	ExtractJobListCmd.Flags().Bool("all", false, "Fetch all extract jobs. --page flag will be ignore if provided")
	ExtractJobCmd.AddCommand(
		ExtractJobListCmd,
		ExtractJobShowCmd,
	)
	ExtractCmd.AddCommand(
		ExtractRunCmd,
		ExtractJobCmd,
	)
	RootCmd.AddCommand(ExtractCmd)
}

func extractRunCmdF(c client.Client, command *cobra.Command, args []string) error {
	from, err := command.Flags().GetInt64("from")
	if err != nil {
		return err
	}
	to, err := command.Flags().GetInt64("to")
	if err != nil {
		return err
	}
	if to == 0 {
		to = model.GetMillis() / 1000
	}

	job, _, err := c.CreateJob(&model.Job{
		Type: model.JobTypeExtractContent,
		Data: map[string]string{
			"from": strconv.FormatInt(from, 10),
			"to":   strconv.FormatInt(to, 10),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create content extraction job: %w", err)
	}

	printer.PrintT("Content extraction job successfully created, ID: {{.Id}}", job)

	return nil
}

func extractJobShowCmdF(c client.Client, command *cobra.Command, args []string) error {
	job, _, err := c.GetJob(args[0])
	if err != nil {
		return fmt.Errorf("failed to get content extraction job: %w", err)
	}
	printExtractContentJob(job)
	return nil
}

func extractJobListCmdF(c client.Client, command *cobra.Command, args []string) error {
	return jobListCmdF(c, command, model.JobTypeExtractContent)
}

func printExtractContentJob(job *model.Job) {
	if job.StartAt > 0 {
		printer.PrintT(fmt.Sprintf("  ID: {{.Id}}\n  Status: {{.Status}}\n  Created: %s\n  Started: %s\n  Processed: %s\n  Errors: %s\n",
			time.Unix(job.CreateAt/1000, 0), time.Unix(job.StartAt/1000, 0), job.Data["processed"], job.Data["errors"]), job)
	} else {
		printer.PrintT(fmt.Sprintf("  ID: {{.Id}}\n  Status: {{.Status}}\n  Created: %s\n\n",
			time.Unix(job.CreateAt/1000, 0)), job)
	}
}
