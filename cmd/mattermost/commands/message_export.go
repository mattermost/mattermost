// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"

	"context"

	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/spf13/cobra"
)

var MessageExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export data from Mattermost",
	Long:  "Export data from Mattermost in a format suitable for import into a third-party application",
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

var GlobalRelayExportCmd = &cobra.Command{
	Use:     "global-relay",
	Short:   "Export data from Mattermost in Global Relay format",
	Long:    "Export data from Mattermost in Global Relay format",
	Example: "export global-relay --exportFrom=12345",
	RunE:    buildExportCmdF("globalrelay"),
}

func init() {
	ScheduleExportCmd.Flags().String("format", "actiance", "The format to export data")
	ScheduleExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	ScheduleExportCmd.Flags().Int("timeoutSeconds", -1, "The maximum number of seconds to wait for the job to complete before timing out.")
	CsvExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	ActianceExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	GlobalRelayExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	MessageExportCmd.AddCommand(ScheduleExportCmd)
	MessageExportCmd.AddCommand(CsvExportCmd)
	MessageExportCmd.AddCommand(ActianceExportCmd)
	MessageExportCmd.AddCommand(GlobalRelayExportCmd)
	RootCmd.AddCommand(MessageExportCmd)
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
	if format, err := command.Flags().GetString("format"); err != nil {
		return errors.New("format flag error")
	} else if format != "actiance" {
		return errors.New("unsupported export format")
	}

	startTime, err := command.Flags().GetInt64("exportFrom")
	if err != nil {
		return errors.New("exportFrom flag error")
	} else if startTime < 0 {
		return errors.New("exportFrom must be a positive integer")
	}

	timeoutSeconds, err := command.Flags().GetInt("timeoutSeconds")
	if err != nil {
		return errors.New("timeoutSeconds error")
	} else if timeoutSeconds < 0 {
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
		} else if startTime < 0 {
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
