// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_process

import (
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
	BulkExport(ctx request.CTX, zipWriter, logWriter io.Writer, outPath string, opts model.BulkExportOpts) *model.AppError
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) model.Worker {
	isEnabled := func(cfg *model.Config) bool { return true }
	execute := func(job *model.Job) error {
		opts := model.BulkExportOpts{
			CreateArchive: true,
		}

		includeAttachments, ok := job.Data["include_attachments"]
		if ok && includeAttachments == "true" {
			opts.IncludeAttachments = true
		}

		outPath := *app.Config().ExportSettings.Directory
		id := model.NewId()
		exportZipFilename := id + "_export.zip"
		exportLogFilename := id + "_export.log"
		zipReader, zipWriter := io.Pipe()
		logReader, logWriter := io.Pipe()

		errCh := make(chan *model.AppError, 2)
		defer close(errCh)

		go func() {
			_, appErr := app.WriteFile(zipReader, filepath.Join(outPath, exportZipFilename))
			errCh <- appErr
		}()

		go func() {
			_, appErr := app.WriteFile(logReader, filepath.Join(outPath, exportLogFilename))
			errCh <- appErr
		}()

		appErr := app.BulkExport(request.EmptyContext(app.Log()), zipWriter, logWriter, outPath, opts)
		if err := zipWriter.Close(); err != nil {
			mlog.Warn("Worker: error closing zip writer")
		}

		if err := logWriter.Close(); err != nil {
			mlog.Warn("Worker: error closing log writer")
		}

		if appErr != nil {
			return appErr
		}

		for i := 0; i < 2; i++ {
			appErr := <-errCh
			if appErr != nil {
				return appErr
			}
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
