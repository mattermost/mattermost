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

var createJobCmd = &cobra.Command{
	Use:   "create [type]",
	Short: "Create a new job",
	Long:  "Create a new job of the given type. Use --data to pass type-specific options as key=value pairs.",
	Example: `  job create ldap_sync
	job create data_retention
	job create message_export --data batch_size=1000`,
	Args:              cobra.ExactArgs(1),
	ValidArgsFunction: jobTypeCompletionF,
	RunE:              withClient(createJobCmdF),
}

var showJobCmd = &cobra.Command{
	Use:               "show [job]",
	Short:             "Show a job",
	Example:           "  job show jobID",
	Args:              cobra.ExactArgs(1),
	ValidArgsFunction: validateArgsWithClient(jobCompletionF),
	RunE:              withClient(showJobCmdF),
}

var cancelJobCmd = &cobra.Command{
	Use:               "cancel [job]",
	Short:             "Cancel a job",
	Example:           "  job cancel jobID",
	Args:              cobra.ExactArgs(1),
	ValidArgsFunction: validateArgsWithClient(jobCompletionF),
	RunE:              withClient(cancelJobCmdF),
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
	listJobsCmd.Flags().Int("page", 0, "Page number to fetch for the list of jobs")
	listJobsCmd.Flags().Int("per-page", 5, "Number of jobs to be fetched")
	listJobsCmd.Flags().Bool("all", false, "Fetch all jobs. --page flag will be ignored if provided")
	listJobsCmd.Flags().StringSlice("ids", nil, "Comma-separated list of job IDs to which the operation will be applied. All other flags are ignored")
	listJobsCmd.Flags().String("status", "", "Filter by job status")
	listJobsCmd.Flags().String("type", "", "Filter by job type")

	createJobCmd.Flags().StringToString("data", nil, "Comma-separated list of key=value pairs passed to the job as type-specific options")

	updateJobCmd.Flags().Bool("force", false, "Setting a job status is restricted to certain statuses. You can overwrite these restrictions by using --force. This might cause unexpected behaviour on your Mattermost Server. Use this option with caution.")

	JobCmd.AddCommand(
		listJobsCmd,
		createJobCmd,
		showJobCmd,
		cancelJobCmd,
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

func createJobCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	jobType := args[0]

	data, err := cmd.Flags().GetStringToString("data")
	if err != nil {
		return err
	}

	job, _, err := c.CreateJob(context.TODO(), &model.Job{
		Type: jobType,
		Data: data,
	})
	if err != nil {
		return fmt.Errorf("failed to create job: %w", err)
	}

	printer.PrintT("Job successfully created, ID: {{.Id}}", job)

	return nil
}

func showJobCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	jobId := args[0]
	if !model.IsValidId(jobId) {
		return fmt.Errorf("invalid job ID: %s", jobId)
	}

	job, _, err := c.GetJob(context.TODO(), jobId)
	if err != nil {
		return fmt.Errorf("failed to get job: %w", err)
	}

	printJob(job)

	return nil
}

func cancelJobCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	jobId := args[0]
	if !model.IsValidId(jobId) {
		return fmt.Errorf("invalid job ID: %s", jobId)
	}

	if _, err := c.CancelJob(context.TODO(), jobId); err != nil {
		return fmt.Errorf("failed to cancel job: %w", err)
	}

	return nil
}

func jobTypeCompletionF(_ *cobra.Command, args []string, _ string) ([]string, cobra.ShellCompDirective) {
	if len(args) > 0 {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}
	return model.AllJobTypes[:], cobra.ShellCompDirectiveNoFileComp
}

func jobCompletionF(ctx context.Context, c client.Client, cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	return fetchAndComplete(
		func(ctx context.Context, c client.Client, page, perPage int) ([]*model.Job, *model.Response, error) {
			return c.GetJobs(ctx, "", "", page, perPage)
		},
		func(j *model.Job) []string { return []string{j.Id} },
	)(ctx, c, cmd, args, toComplete)
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
