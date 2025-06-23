// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
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
	Example: "compliance-export download o98rj3ur83dp5dppfyk5yk6osy",
	Short:   "Download compliance export file",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(complianceExportDownloadCmdF),
}

var ComplianceExportCreateCmd = &cobra.Command{
	Use:     "create [complianceExportType] --date \"2025-03-27 -0400\"",
	Example: "compliance-export create csv --date \"2025-03-27 -0400\"",
	Long: "Create a compliance export job, of type 'csv' or 'actiance' or 'globalrelay'. If --date is set, the job will run for one day, from 12am to 12am (minus one millisecond) inclusively, in the format with timezone offset: `\"YYYY-MM-DD -0000\"`. E.g., \"2024-10-21 -0400\" for Oct 21, 2024 EDT timezone. \"2023-11-01 +0000\" for Nov 01, 2024 UTC. If set, the 'start' and 'end' flags will be ignored.\n\n" +
		"Important: Running a compliance export job from mmctl will NOT affect the next scheduled job's batch_start_time. This means that if you run a compliance export job from mmctl, the next scheduled job will run from the batch_end_time of the previous scheduled job, as usual.",
	Short: "Create a compliance export job, of type 'csv' or 'actiance' or 'globalrelay'",
	Args:  cobra.MinimumNArgs(1),
	RunE:  withClient(complianceExportCreateCmdF),
}

func init() {
	ComplianceExportListCmd.Flags().Int("page", 0, "Page number to fetch for the list of compliance export jobs")
	ComplianceExportListCmd.Flags().Int("per-page", DefaultPageSize, "Number of compliance export jobs to be fetched")
	ComplianceExportListCmd.Flags().Bool("all", false, "Fetch all compliance export jobs. --page flag will be ignored if provided")

	ComplianceExportDownloadCmd.Flags().Int("num-retries", 5, "Number of retries if the download fails")

	ComplianceExportCreateCmd.Flags().String(
		"date",
		"",
		"Run the export for one day, from 12am to 12am (minus one millisecond) inclusively, in the format with timezone offset: `\"YYYY-MM-DD -0000\"`. E.g., `\"2024-10-21 -0400\"` for Oct 21, 2024 EDT timezone. `\"2023-11-01 +0000\"` for Nov 01, 2024 UTC. If set, the 'start' and 'end' flags will be ignored.",
	)
	ComplianceExportCreateCmd.Flags().Int(
		"start",
		0,
		"The start timestamp in unix milliseconds. Posts with updateAt >= start will be exported. If set, 'end' must be set as well. eg, `1743048000000` for 2025-03-27 EDT.",
	)
	ComplianceExportCreateCmd.Flags().Int(
		"end",
		0,
		"The end timestamp in unix milliseconds. Posts with updateAt <= end will be exported. If set, 'start' must be set as well. eg, `1743134400000` for 2025-03-28 EDT.",
	)

	ComplianceExportCmd.AddCommand(
		ComplianceExportListCmd,
		ComplianceExportShowCmd,
		ComplianceExportCancelCmd,
		ComplianceExportDownloadCmd,
		ComplianceExportCreateCmd,
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

	downloadFn := func(outFile *os.File) (string, error) {
		return c.DownloadComplianceExport(context.TODO(), jobID, outFile)
	}

	suggestedFilename, err := downloadFile(path, downloadFn, retries, "compliance export")
	if err != nil {
		return err
	}

	// If we didn't provide a path and got a suggested filename, rename the file
	if len(args) == 1 && suggestedFilename != "" && suggestedFilename != path {
		// If the suggested name already exists, don't overwrite
		if _, err := os.Stat(suggestedFilename); err == nil {
			printer.PrintWarning(fmt.Sprintf("File with the server's suggested name %q already exists, keeping %q", suggestedFilename, path))
		} else {
			if err := os.Rename(path, suggestedFilename); err != nil {
				printer.PrintWarning(fmt.Sprintf("Could not rename file to the server's suggested name %q: %v", suggestedFilename, err))
			} else {
				path = suggestedFilename
			}
		}
	}

	printer.Print(fmt.Sprintf("Compliance export file downloaded to %q", path))
	return nil
}

func complianceExportCreateCmdF(c client.Client, command *cobra.Command, args []string) error {
	exportType := args[0]
	if exportType != model.ComplianceExportTypeActiance &&
		exportType != model.ComplianceExportTypeCsv &&
		exportType != model.ComplianceExportTypeGlobalrelay {
		return fmt.Errorf("invalid export type: %s, must be one of: csv, actiance, globalrelay", exportType)
	}

	dateStr, err := command.Flags().GetString("date")
	if err != nil {
		return err
	}
	start, err := command.Flags().GetInt("start")
	if err != nil {
		return err
	}
	end, err := command.Flags().GetInt("end")
	if err != nil {
		return err
	}
	startTimestamp, endTimestamp, err := getStartAndEnd(dateStr, start, end)
	if err != nil {
		return err
	}
	startTime := strconv.FormatInt(startTimestamp, 10)
	endTime := strconv.FormatInt(endTimestamp, 10)
	exportDir := path.Join(model.ComplianceExportPath, fmt.Sprintf("%s-%s-%s", time.Now().Format(model.ComplianceExportDirectoryFormat), startTime, endTime))

	// If start and end are 0, we need to not set those keys in the job data.
	// This will make the job like a manual job (it will pick up where the previous job left off).
	data := model.StringMap{
		shared.JobDataInitiatedBy:  "mmctl",
		shared.JobDataExportType:   exportType,
		shared.JobDataBatchStartId: "",
		shared.JobDataJobStartId:   "",
	}
	if startTimestamp != 0 && endTimestamp != 0 {
		data[shared.JobDataBatchStartTime] = startTime
		data[shared.JobDataJobStartTime] = startTime
		data[shared.JobDataJobEndTime] = endTime
		data[shared.JobDataExportDir] = exportDir
	}

	job := &model.Job{
		Type: model.JobTypeMessageExport,
		Data: data,
	}

	if job, _, err = c.CreateJob(context.TODO(), job); err != nil {
		return fmt.Errorf("failed to create compliance export job: %w", err)
	}

	printer.Print(fmt.Sprintf("Compliance export job created with ID: %s", job.Id))

	return nil
}

// getStartAndEnd returns the start and end timestamps in unix milliseconds
func getStartAndEnd(dateStr string, start int, end int) (int64, int64, error) {
	if dateStr == "" && start == 0 && end == 0 {
		// return 0 so that the job will be like a manual job
		return 0, 0, nil
	}

	if dateStr != "" && (start > 0 || end > 0) {
		return 0, 0, errors.New("if date is used, start and end must not be set")
	}

	if dateStr != "" {
		t, err := time.Parse("2006-01-02 -0700", dateStr)
		if err != nil {
			return 0, 0, fmt.Errorf("could not parse date string: %s, use the format with time zone offset: YYYY-MM-DD -0700, eg for EDT: `2024-12-24 -0400`,  error details: %w", dateStr, err)
		}
		endTimestamp := t.AddDate(0, 0, 1).UnixMilli() - 1
		return t.UnixMilli(), endTimestamp, nil
	}
	if start <= 0 || end <= 0 || start >= end {
		return 0, 0, fmt.Errorf("if date is not used, start: %d and end: %d must both be > 0, and start must be < end", start, end)
	}
	return int64(start), int64(end), nil
}
