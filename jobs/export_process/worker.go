// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_process

import (
	"context"
	"io"
	"path/filepath"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/configservice"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const jobName = "ExportProcess"

type AppIface interface {
	configservice.ConfigService
	WriteFile(fr io.Reader, path string) (int64, *model.AppError)
	WriteFileContext(ctx context.Context, fr io.Reader, path string) (int64, *model.AppError)
	BulkExport(ctx request.CTX, writer io.Writer, outPath string, opts model.BulkExportOpts) *model.AppError
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

		errCh := make(chan *model.AppError, 1)
		go func() {
			defer close(errCh)
			// Try to write without a timeout
			_, appErr := app.WriteFileContext(context.Background(), rd, filepath.Join(outPath, exportFilename))
			errCh <- appErr
		}()

		appErr := app.BulkExport(request.EmptyContext(app.Log()), wr, outPath, opts)
		if err := wr.Close(); err != nil {
			mlog.Warn("Worker: error closing writer")
		}

		if appErr != nil {
			return appErr
		}

		if appErr := <-errCh; appErr != nil {
			return appErr
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
