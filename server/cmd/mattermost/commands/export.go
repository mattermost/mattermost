// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/channels/audit"

	"github.com/pkg/errors"
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

var GlobalRelayZipExportCmd = &cobra.Command{
	Use:     "global-relay-zip",
	Short:   "Export data from Mattermost into a zip file containing emails to send to Global Relay for debug and testing purposes only.",
	Long:    "Export data from Mattermost into a zip file containing emails to send to Global Relay for debug and testing purposes only. This does not archive any information in Global Relay.",
	Example: "export global-relay-zip --exportFrom=12345",
	RunE:    buildExportCmdF("globalrelay-zip"),
}

var BulkExportCmd = &cobra.Command{
	Use:     "bulk [file]",
	Short:   "Export bulk data.",
	Long:    "Export data to a file compatible with the Mattermost Bulk Import format.",
	Example: "export bulk bulk_data.json",
	RunE:    bulkExportCmdF,
	Args:    cobra.ExactArgs(1),
}

func init() {
	ScheduleExportCmd.Flags().String("format", "actiance", "The format to export data")
	ScheduleExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	ScheduleExportCmd.Flags().Int("timeoutSeconds", -1, "The maximum number of seconds to wait for the job to complete before timing out.")

	CsvExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	CsvExportCmd.Flags().Int("limit", -1, "The number of posts to export. The default of -1 means no limit.")

	ActianceExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	ActianceExportCmd.Flags().Int("limit", -1, "The number of posts to export. The default of -1 means no limit.")

	GlobalRelayZipExportCmd.Flags().Int64("exportFrom", -1, "The timestamp of the earliest post to export, expressed in seconds since the unix epoch.")
	GlobalRelayZipExportCmd.Flags().Int("limit", -1, "The number of posts to export. The default of -1 means no limit.")

	BulkExportCmd.Flags().Bool("all-teams", true, "Export all teams from the server.")
	BulkExportCmd.Flags().Bool("with-archived-channels", false, "Also exports archived channels.")
	BulkExportCmd.Flags().Bool("attachments", false, "Also export file attachments.")
	BulkExportCmd.Flags().Bool("archive", false, "Outputs a single archive file.")

	ExportCmd.AddCommand(ScheduleExportCmd)
	ExportCmd.AddCommand(CsvExportCmd)
	ExportCmd.AddCommand(ActianceExportCmd)
	ExportCmd.AddCommand(GlobalRelayZipExportCmd)
	ExportCmd.AddCommand(BulkExportCmd)

	RootCmd.AddCommand(ExportCmd)
}

func scheduleExportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command, app.SkipPostInitialization())
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

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

	if messageExportI := a.MessageExport(); messageExportI != nil {
		ctx := context.Background()
		if timeoutSeconds > 0 {
			var cancel context.CancelFunc
			ctx, cancel = context.WithTimeout(ctx, time.Second*time.Duration(timeoutSeconds))
			defer cancel()
		}

		job, err := messageExportI.StartSynchronizeJob(ctx, startTime)
		if err != nil || job.Status == model.JobStatusError || job.Status == model.JobStatusCanceled {
			CommandPrintErrorln("ERROR: Message export job failed. Please check the server logs")
		} else {
			CommandPrettyPrintln("SUCCESS: Message export job complete")

			auditRec := a.MakeAuditRecord("scheduleExport", audit.Success)
			auditRec.AddMeta("format", format)
			auditRec.AddMeta("start", startTime)
			a.LogAuditRec(auditRec, nil)
		}
	}
	return nil
}

func buildExportCmdF(format string) func(command *cobra.Command, args []string) error {
	return func(command *cobra.Command, args []string) error {
		a, err := InitDBCommandContextCobra(command, app.SkipPostInitialization())
		license := a.Srv().License()
		if err != nil {
			return err
		}
		defer a.Srv().Shutdown()

		startTime, err := command.Flags().GetInt64("exportFrom")
		if err != nil {
			return errors.New("exportFrom flag error")
		}
		if startTime < 0 {
			return errors.New("exportFrom must be a positive integer")
		}

		limit, err := command.Flags().GetInt("limit")
		if err != nil {
			return errors.New("limit flag error")
		}

		if a.MessageExport() == nil || license == nil || !*license.Features.MessageExport {
			return errors.New("message export feature not available")
		}

		warningsCount, appErr := a.MessageExport().RunExport(format, startTime, limit)
		if appErr != nil {
			return appErr
		}
		if warningsCount == 0 {
			CommandPrettyPrintln("SUCCESS: Your data was exported.")
		} else {
			if format == model.ComplianceExportTypeGlobalrelay || format == model.ComplianceExportTypeGlobalrelayZip {
				CommandPrettyPrintln(fmt.Sprintf("WARNING: %d warnings encountered, see logs for details.", warningsCount))
			} else {
				CommandPrettyPrintln(fmt.Sprintf("WARNING: %d warnings encountered, see warning.txt for details.", warningsCount))
			}
		}

		auditRec := a.MakeAuditRecord("buildExport", audit.Success)
		auditRec.AddMeta("format", format)
		auditRec.AddMeta("start", startTime)
		a.LogAuditRec(auditRec, nil)

		return nil
	}
}

func bulkExportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command, app.SkipPostInitialization())
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	allTeams, err := command.Flags().GetBool("all-teams")
	if err != nil {
		return errors.Wrap(err, "all-teams flag error")
	}
	if !allTeams {
		return errors.New("Nothing to export. Please specify the --all-teams flag to export all teams.")
	}

	attachments, err := command.Flags().GetBool("attachments")
	if err != nil {
		return errors.Wrap(err, "attachments flag error")
	}

	archive, err := command.Flags().GetBool("archive")
	if err != nil {
		return errors.Wrap(err, "archive flag error")
	}

	withArchivedChannels, err := command.Flags().GetBool("with-archived-channels")
	if err != nil {
		return errors.Wrap(err, "with-archived-channels flag error")
	}

	fileWriter, err := os.Create(args[0])
	if err != nil {
		return err
	}
	defer fileWriter.Close()

	outPath, err := filepath.Abs(args[0])
	if err != nil {
		return err
	}

	var opts model.BulkExportOpts
	opts.IncludeAttachments = attachments
	opts.CreateArchive = archive
	opts.IncludeArchivedChannels = withArchivedChannels
	if err := a.BulkExport(request.EmptyContext(a.Log()), fileWriter, filepath.Dir(outPath), nil /* nil job since it's spawned from CLI */, opts); err != nil {
		CommandPrintErrorln(err.Error())
		return err
	}

	auditRec := a.MakeAuditRecord("bulkExport", audit.Success)
	auditRec.AddMeta("all_teams", allTeams)
	auditRec.AddMeta("file", args[0])
	a.LogAuditRec(auditRec, nil)

	return nil
}
