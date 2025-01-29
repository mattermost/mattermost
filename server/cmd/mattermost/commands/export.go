// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
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

	BulkExportCmd.Flags().Bool("all-teams", true, "Export all teams from the server.")
	BulkExportCmd.Flags().Bool("with-archived-channels", false, "Also exports archived channels.")
	BulkExportCmd.Flags().Bool("with-profile-pictures", false, "Also exports profile pictures.")
	BulkExportCmd.Flags().Bool("attachments", false, "Also export file attachments.")
	BulkExportCmd.Flags().Bool("archive", false, "Outputs a single archive file.")

	ExportCmd.AddCommand(ScheduleExportCmd)
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

	var rctx request.CTX = request.EmptyContext(a.Log())

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

		rctx = rctx.WithContext(ctx)

		job, err := messageExportI.StartSynchronizeJob(rctx, startTime)
		if err != nil || job.Status == model.JobStatusError || job.Status == model.JobStatusCanceled {
			CommandPrintErrorln("ERROR: Message export job failed. Please check the server logs")
		} else {
			CommandPrettyPrintln("SUCCESS: Message export job complete")

			auditRec := a.MakeAuditRecord(rctx, "scheduleExport", audit.Success)
			auditRec.AddMeta("format", format)
			auditRec.AddMeta("start", startTime)
			a.LogAuditRec(rctx, auditRec, nil)
		}
	}
	return nil
}

func bulkExportCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command, app.SkipPostInitialization())
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	rctx := request.EmptyContext(a.Log())

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

	includeProfilePictures, err := command.Flags().GetBool("with-profile-pictures")
	if err != nil {
		return errors.Wrap(err, "with-profile-pictures flag error")
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
	opts.IncludeProfilePictures = includeProfilePictures
	if err := a.BulkExport(rctx, fileWriter, filepath.Dir(outPath), nil /* nil job since it's spawned from CLI */, opts); err != nil {
		CommandPrintErrorln(err.Error())
		return err
	}

	auditRec := a.MakeAuditRecord(rctx, "bulkExport", audit.Success)
	auditRec.AddMeta("all_teams", allTeams)
	auditRec.AddMeta("file", args[0])
	a.LogAuditRec(rctx, auditRec, nil)

	return nil
}
