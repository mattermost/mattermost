// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_process

import (
	"context"
	"io"
	"path/filepath"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type AppIface interface {
	configservice.ConfigService
	WriteExportFileContext(ctx context.Context, fr io.Reader, path string) (int64, *model.AppError)
	BulkExport(ctx request.CTX, writer io.Writer, outPath string, job *model.Job, opts model.BulkExportOpts) *model.AppError
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "ExportProcess"

	isEnabled := func(cfg *model.Config) bool { return true }
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		opts := model.BulkExportOpts{
			CreateArchive: true,
		}

		includeAttachments, ok := job.Data["include_attachments"]
		if ok && includeAttachments == "true" {
			opts.IncludeAttachments = true
		}

		includeArchivedChannels, ok := job.Data["include_archived_channels"]
		if ok && includeArchivedChannels == "true" {
			opts.IncludeArchivedChannels = true
		}

		includeProfilePictures, ok := job.Data["include_profile_pictures"]
		if ok && includeProfilePictures == "true" {
			opts.IncludeProfilePictures = true
		}

		includeRolesAndSchemes, ok := job.Data["include_roles_and_schemes"]
		if ok && includeRolesAndSchemes == "true" {
			opts.IncludeRolesAndSchemes = true
		}

		outPath := *app.Config().ExportSettings.Directory
		exportFilename := job.Id + "_export.zip"

		rd, wr := io.Pipe()

		go func() {
			_, appErr := app.WriteExportFileContext(context.Background(), rd, filepath.Join(outPath, exportFilename))
			if appErr != nil {
				// we close the reader here to prevent a deadlock when the bulk exporter tries to
				// write into the pipe while app.WriteFile has already returned. The error will be
				// returned by the writer part of the pipe when app.BulkExport tries to call
				// wr.Write() on it.
				rd.CloseWithError(appErr) // CloseWithError never returns an error
			}
		}()

		appErr := app.BulkExport(request.EmptyContext(logger), wr, outPath, job, opts)
		wr.Close() // Close never returns an error

		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
