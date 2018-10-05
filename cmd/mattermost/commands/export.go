// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"
	"os"

	"context"

	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/spf13/cobra"
)

var ExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export data from Mattermost",
	Long:  "Export data from Mattermost in a format suitable for import into a third-party application or another Mattermost instance",
}

var ScheduleExportCmd = &cobra.Command{
	Use:     "schedule",
	Short:   "Schedule an export data job in Mattermost",
	Long:    "Schedule an export data job in Mattermost (this will run asynchronously via a background worker)",
	Example: "export schedule --format=actiance --exportFrom=12345 --timeoutSeconds=12345",
	RunE:    scheduleExportCmdF,
}

var CsvExportCmd = &cobra.Command{
	Use:     "csv",
	Short:   "Export data from Mattermost in CSV format",
	Long:    "Export data from Mattermost in CSV format",
	Example: "export csv --exportFrom=12345",
	RunE:    buildExportCmdF("csv"),
}

var ActianceExportCmd = &cobra.Command{
	Use:     "actiance",
	Short:   "Export data from Mattermost in Actiance format",
	Long:    "Export data from Mattermost in Actiance format",
	Example: "export actiance --exportFrom=12345",
	RunE:    buildExportCmdF("actiance"),
}

var BulkExportCmd = &cobra.Command{
	Use:     "bulk [file]",
	Short:   "Export bulk data.",
	Long:    "Export data to a file compatible with the Mattermost Bulk Import format.",
	Example: "  export bulk bulk_data.json",
	RunE:    bulkExportCmdF,
	Args:    cobra.ExactArgs(1),
}

func init() {
	ScheduleExportCmd.Flags().String("format", "actiance", "The format to export data")
	ScheduleExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	ScheduleExportCmd.Flags().Int("timeoutSeconds", -1, "The maximum number of seconds to wait for the job to complete before timing out.")

	CsvExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")

	ActianceExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")

	BulkExportCmd.Flags().Bool("all-teams", false, "Export all teams from the server.")

	ExportCmd.AddCommand(ScheduleExportCmd)
	ExportCmd.AddCommand(CsvExportCmd)
	ExportCmd.AddCommand(ActianceExportCmd)
	ExportCmd.AddCommand(BulkExportCmd)

	RootCmd.AddCommand(ExportCmd)
}

func scheduleExportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if !*a.Config().MessageExportSettings.EnableExport {
		return errors.New("ERROR: The message export feature is not enabled")
	}

	// for now, format is hard-coded to actiance. In time, we'll have to support other formats and inject them into job data
	format, err := command.Flags().GetString("format")
	if err != nil {
		return errors.New("format flag error")
	}
	if format != "actiance" {
		return errors.New("unsupported export format")
	}

	startTime, err := command.Flags().GetInt64("exportFrom")
	if err != nil {
		return errors.New("exportFrom flag error")
	}
	if startTime < 0 {
		return errors.New("exportFrom must be a positive integer")
	}

	timeoutSeconds, err := command.Flags().GetInt("timeoutSeconds")
	if err != nil {
		return errors.New("timeoutSeconds error")
	}
	if timeoutSeconds < 0 {
		return errors.New("timeoutSeconds must be a positive integer")
	}

	if messageExportI := a.MessageExport; messageExportI != nil {
		ctx := context.Background()
		if timeoutSeconds > 0 {
			var cancel context.CancelFunc
			ctx, cancel = context.WithTimeout(ctx, time.Second*time.Duration(timeoutSeconds))
			defer cancel()
		}

		job, err := messageExportI.StartSynchronizeJob(ctx, startTime)
		if err != nil || job.Status == model.JOB_STATUS_ERROR || job.Status == model.JOB_STATUS_CANCELED {
			CommandPrintErrorln("ERROR: Message export job failed. Please check the server logs")
		} else {
			CommandPrettyPrintln("SUCCESS: Message export job complete")
		}
	}

	return nil
}

func buildExportCmdF(format string) func(command *cobra.Command, args []string) error {
	return func(command *cobra.Command, args []string) error {
		a, err := InitDBCommandContextCobra(command)
		if err != nil {
			return err
		}
		defer a.Shutdown()

		startTime, err := command.Flags().GetInt64("exportFrom")
		if err != nil {
			return errors.New("exportFrom flag error")
		}
		if startTime < 0 {
			return errors.New("exportFrom must be a positive integer")
		}

		if a.MessageExport == nil {
			CommandPrettyPrintln("MessageExport feature not available")
		}

		err2 := a.MessageExport.RunExport(format, startTime)
		if err2 != nil {
			return err2
		}
		CommandPrettyPrintln("SUCCESS: Your data was exported.")

		return nil
	}
}

func bulkExportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	allTeams, err := command.Flags().GetBool("all-teams")
	if err != nil {
		return errors.New("Apply flag error")
	}

	if !allTeams {
		return errors.New("Nothing to export. Please specify the --all-teams flag to export all teams.")
	}

	fileWriter, err := os.Create(args[0])
	if err != nil {
		return err
	}
	defer fileWriter.Close()

	if err := a.BulkExport(fileWriter); err != nil {
		CommandPrettyPrintln(err.Error())
		return err
	}

	return nil
}
