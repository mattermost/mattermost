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
	Use:     "export",
	Short:   "Export data from Mattermost",
	Long:    "Export data from Mattermost in a format suitable for import into a third-party application",
	Example: "export --format=actiance --exportFrom=12345",
	RunE:    messageExportCmdF,
}

func init() {
	MessageExportCmd.Flags().String("format", "actiance", "The format to export data in")
	MessageExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	MessageExportCmd.Flags().Int("timeoutSeconds", -1, "The maximum number of seconds to wait for the job to complete before timing out.")
	RootCmd.AddCommand(MessageExportCmd)
}

func messageExportCmdF(command *cobra.Command, args []string) error {
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
