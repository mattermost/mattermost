// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_process

import (
	"context"
	"io"
	"path/filepath"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/channels/jobs"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/configservice"
)

const jobName = "ExportProcess"

type AppIface interface {
	configservice.ConfigService
	WriteFile(fr io.Reader, path string) (int64, *model.AppError)
	WriteFileContext(ctx context.Context, fr io.Reader, path string) (int64, *model.AppError)
	BulkExport(ctx request.CTX, writer io.Writer, outPath string, job *model.Job, opts model.BulkExportOpts) *model.AppError
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) model.Worker {
	isEnabled := func(cfg *model.Config) bool { return true }
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		opts := model.BulkExportOpts{
			CreateArchive: true,
		}

		includeAttachments, ok := job.Data["include_attachments"]
		if ok && includeAttachments == "true" {
			opts.IncludeAttachments = true
		}

		outPath := *app.Config().ExportSettings.Directory
		exportFilename := job.Id + "_export.zip"

		rd, wr := io.Pipe()

		go func() {
			_, appErr := app.WriteFileContext(context.Background(), rd, filepath.Join(outPath, exportFilename))
			if appErr != nil {
				// we close the reader here to prevent a deadlock when the bulk exporter tries to
				// write into the pipe while app.WriteFile has already returned. The error will be
				// returned by the writer part of the pipe when app.BulkExport tries to call
				// wr.Write() on it.
				rd.CloseWithError(appErr) // CloseWithError never returns an error
			}
		}()

		logger := app.Log().With(mlog.String("job_id", job.Id))
		appErr := app.BulkExport(request.EmptyContext(logger), wr, outPath, job, opts)
		wr.Close() // Close never returns an error

		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
