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
	Use:   "list",
	Short: "List the latest jobs",
	Example: `  job list
	job list --ids jobID1,jobID2
	job list --type ldap_sync --status success
	job list --type ldap_sync --status success --page 0 --per-page 10`,
	Args: cobra.NoArgs,
	RunE: withClient(listJobsCmdF),
}

var updateJobCmd = &cobra.Command{
	Use:   "update [job] [status]",
	Short: "Update the status of a job",
	Long: `Update the status of a job. The following restrictions are in place:
	- in_progress -> pending
	- in_progress | pending -> cancel_requested
	- cancel_requested -> canceled
	
	Those restriction can be bypassed with --force=true but the only statuses you can go to are: pending, cancel_requested and canceled. This can have unexpected consequences and should be used with caution.`,
	Example: `  job update myJobID pending
	job update myJobID pending --force true
	job update myJobID canceled --force true`,
	Args: cobra.MinimumNArgs(2),
	RunE: withClient(updateJobCmdF),
}

func init() {
	listJobsCmd.Flags().Int("page", 0, "Page number to fetch for the list of import jobs")
	listJobsCmd.Flags().Int("per-page", 5, "Number of import jobs to be fetched")
	listJobsCmd.Flags().Bool("all", false, "Fetch all import jobs. --page flag will be ignored if provided")
	listJobsCmd.Flags().StringSlice("ids", nil, "Comma-separated list of job IDs to which the operation will be applied. All other flags are ignored")
	listJobsCmd.Flags().String("status", "", "Filter by job status")
	listJobsCmd.Flags().String("type", "", "Filter by job type")

	updateJobCmd.Flags().Bool("force", false, "Setting a job status is restricted to certain statuses. You can overwrite these restrictions by using --force. This might cause unexpected behaviour on your Mattermost Server. Use this option with caution.")

	JobCmd.AddCommand(
		listJobsCmd,
		updateJobCmd,
	)

	RootCmd.AddCommand(JobCmd)
}

func listJobsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	ids, err := cmd.Flags().GetStringSlice("ids")
	if err != nil {
		return err
	}
	jobType, err := cmd.Flags().GetString("type")
	if err != nil {
		return err
	}
	status, err := cmd.Flags().GetString("status")
	if err != nil {
		return err
	}

	if len(ids) > 0 {
		jobs := make([]*model.Job, 0, len(ids))
		var result *multierror.Error
		for _, id := range ids {
			isValidId := model.IsValidId(id)
			if !isValidId {
				result = multierror.Append(result, fmt.Errorf("invalid job ID: %s", id))
				continue
			}

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
	force, err := cmd.Flags().GetBool("force")
	if err != nil {
		return err
	}

	jobId := args[0]
	if !model.IsValidId(jobId) {
		return fmt.Errorf("invalid job ID: %s", jobId)
	}
	status := args[1]
	if !model.IsValidJobStatus(status) {
		return fmt.Errorf("invalid job status: %s", status)
	}

	_, err = c.UpdateJobStatus(context.TODO(), jobId, status, force)
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

	if jobType != "" && !model.IsValidJobType(jobType) {
		return fmt.Errorf("invalid job type: %s", jobType)
	}

	if status != "" && !model.IsValidJobStatus(status) {
		return fmt.Errorf("invalid job status: %s", status)
	}

	for {
		jobs, _, err := c.GetJobs(context.TODO(), jobType, status, page, perPage)
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
