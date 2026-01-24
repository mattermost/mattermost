// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wiki_export

import (
	"context"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type AppIface interface {
	configservice.ConfigService
	WriteExportFileContext(ctx context.Context, fr io.Reader, path string) (int64, *model.AppError)
	WikiBulkExport(rctx request.CTX, writer io.Writer, job *model.Job, opts model.WikiBulkExportOpts) *model.AppError
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "WikiExport"

	appContext := request.EmptyContext(jobServer.Logger())
	isEnabled := func(cfg *model.Config) bool {
		return true
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		opts := model.WikiBulkExportOpts{}

		// Parse channel IDs if specified
		if channelIds, ok := job.Data[model.WikiJobDataKeyChannelIds]; ok && channelIds != "" {
			opts.ChannelIds = strings.Split(channelIds, ",")
		}

		// Parse include_comments option
		if includeComments, ok := job.Data[model.WikiJobDataKeyIncludeComments]; ok && includeComments == "true" {
			opts.IncludeComments = true
		}

		// Parse include_attachments option
		if includeAttachments, ok := job.Data[model.WikiJobDataKeyIncludeAttachments]; ok && includeAttachments == "true" {
			opts.IncludeAttachments = true
		}

		// Validate config before use
		if app.Config().ExportSettings.Directory == nil || *app.Config().ExportSettings.Directory == "" {
			return model.NewAppError("WikiExportWorker", "wiki_export.worker.config.nil_directory", nil, "", http.StatusInternalServerError)
		}
		outPath := *app.Config().ExportSettings.Directory
		exportFilename := job.Id + model.WikiExportFileSuffix

		rd, wr := io.Pipe()

		// Channel to capture error from writer goroutine
		writerErrChan := make(chan error, 1)
		go func() {
			_, appErr := app.WriteExportFileContext(context.Background(), rd, filepath.Join(outPath, exportFilename))
			if appErr != nil {
				rd.CloseWithError(appErr)
				writerErrChan <- appErr
			} else {
				rd.Close()
				writerErrChan <- nil
			}
		}()

		appErr := app.WikiBulkExport(appContext, wr, job, opts)
		wr.Close()

		// Wait for writer goroutine to complete
		writerErr := <-writerErrChan

		if appErr != nil {
			return appErr
		}
		if writerErr != nil {
			return model.NewAppError("WikiExportWorker", "wiki_export.worker.write_file.error", nil, "", http.StatusInternalServerError).Wrap(writerErr)
		}

		// Mark export as downloadable
		job.Data[model.WikiJobDataKeyIsDownloadable] = "true"
		job.Data[model.WikiJobDataKeyExportDir] = outPath
		job.Data[model.WikiJobDataKeyExportFile] = exportFilename

		return nil
	}

	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
