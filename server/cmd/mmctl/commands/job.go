// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"time"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

var JobCmd = &cobra.Command{
	Use:   "job",
	Short: "Management of jobs",
}

var listJobsCmd = &cobra.Command{
	Use:     "list",
	Short:   "List jobs",
	Example: "  job list",
	Args:    cobra.NoArgs,
	RunE:    withClient(listJobsCmdF),
}

var updateJobCmd = &cobra.Command{
	Use:     "update [job] [status]",
	Short:   "Update the status of a job",
	Example: "  job update pending",
	Args:    cobra.MinimumNArgs(2),
	RunE:    withClient(updateJobCmdF),
}

func init() {
	listJobsCmd.Flags().Int("page", 0, "Page number to fetch for the list of import jobs")
	listJobsCmd.Flags().Int("per-page", 5, "Number of import jobs to be fetched")
	listJobsCmd.Flags().Bool("all", false, "Fetch all import jobs. --page flag will be ignored if provided")
	listJobsCmd.Flags().StringSlice("ids", nil, "Comma-separated list of job IDs to which the operation will be applied. All other flags are ignored")
	listJobsCmd.Flags().String("status", "", "Job status")
	listJobsCmd.Flags().String("type", "", "Job type")

	updateJobCmd.Flags().Bool("force", false, "We generally restrict what statuses you can set but using --force will give you more freedom")

	JobCmd.AddCommand(
		listJobsCmd,
		updateJobCmd,
	)

	RootCmd.AddCommand(JobCmd)
}

func listJobsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	ids, _ := cmd.Flags().GetStringSlice("ids")
	jobType, _ := cmd.Flags().GetString("type")
	status, _ := cmd.Flags().GetString("status")

	if len(ids) > 0 {
		jobs := make([]*model.Job, 0, len(ids))
		var result *multierror.Error
		for _, id := range ids {
			job, _, err := c.GetJob(context.TODO(), id)
			if err != nil {
				result = multierror.Append(result, err)
				continue
			}
			jobs = append(jobs, job)
		}
		for _, job := range jobs {
			printJob(job)
		}
		return result.ErrorOrNil()
	}

	return jobListCmdF(c, cmd, jobType, status)
}

func updateJobCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	force, _ := cmd.Flags().GetBool("force")

	jobId := args[0]
	status := args[1]

	_, err := c.UpdateJobStatus(context.TODO(), jobId, status, force)
	if err != nil {
		return err
	}

	return nil
}

func jobListCmdF(c client.Client, command *cobra.Command, jobType string, status string) error {
	page, err := command.Flags().GetInt("page")
	if err != nil {
		return err
	}
	perPage, err := command.Flags().GetInt("per-page")
	if err != nil {
		return err
	}
	showAll, err := command.Flags().GetBool("all")
	if err != nil {
		return err
	}

	if showAll {
		page = 0
	}

	for {
		jobs, _, err := c.GetJobs(context.TODO(), page, perPage, jobType, status)
		if err != nil {
			return fmt.Errorf("failed to get jobs: %w", err)
		}

		if len(jobs) == 0 {
			if !showAll || page == 0 {
				printer.Print("No jobs found")
			}
			return nil
		}

		for _, job := range jobs {
			printJob(job)
		}

		if !showAll {
			break
		}

		page++
	}

	return nil
}

func printJob(job *model.Job) {
	if job.StartAt > 0 {
		printer.PrintT(fmt.Sprintf(`  ID: {{.Id}}
  Type: {{.Type}}
  Status: {{.Status}}
  Created: %s
  Started: %s
  Data: {{.Data}}
`,
			time.Unix(job.CreateAt/1000, 0), time.Unix(job.StartAt/1000, 0)), job)
	} else {
		printer.PrintT(fmt.Sprintf(`  ID: {{.Id}}
  Status: {{.Status}}
  Created: %s
`,
			time.Unix(job.CreateAt/1000, 0)), job)
	}
}
