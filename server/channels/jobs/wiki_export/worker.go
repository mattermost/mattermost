// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wiki_export

import (
	"archive/zip"
	"context"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
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
	WikiBulkExport(rctx request.CTX, writer io.Writer, job *model.Job, opts model.WikiBulkExportOpts) (*model.WikiExportResult, *model.AppError)
	ExportFileToWriter(rctx request.CTX, filePath string, zipWr *zip.Writer) error
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

		// Initialize job.Data if nil (can happen if job was created without data)
		// Must be done before WikiBulkExport so it can set stats like pages_exported
		if job.Data == nil {
			job.Data = make(map[string]string)
		}

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
		exportDir := *app.Config().ExportSettings.Directory

		// Determine export filename - use .zip when including attachments, .jsonl otherwise
		var exportFilename string
		if opts.IncludeAttachments {
			exportFilename = job.Id + "_wiki_export.zip"
		} else {
			exportFilename = job.Id + model.WikiExportFileSuffix
		}

		rd, wr := io.Pipe()

		// Channel to capture error from writer goroutine
		writerErrChan := make(chan error, 1)

		// Start the file writer goroutine - same for both zip and jsonl exports
		go func() {
			_, appErr := app.WriteExportFileContext(context.Background(), rd, filepath.Join(exportDir, exportFilename))
			if appErr != nil {
				rd.CloseWithError(appErr)
				writerErrChan <- appErr
			} else {
				rd.Close()
				writerErrChan <- nil
			}
		}()

		if opts.IncludeAttachments {
			// Create zip writer
			zipWr := zip.NewWriter(wr)

			// Create the JSONL file inside the zip
			jsonlWriter, err := zipWr.Create("data/import.jsonl")
			if err != nil {
				wr.CloseWithError(err)
				<-writerErrChan
				return model.NewAppError("WikiExportWorker", "wiki_export.worker.create_zip_entry.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			// Run the export to the JSONL writer inside the zip
			result, appErr := app.WikiBulkExport(appContext, jsonlWriter, job, opts)
			if appErr != nil {
				zipWr.Close()
				wr.CloseWithError(appErr)
				<-writerErrChan
				return appErr
			}

			// Write attachment files to zip
			attachmentsExported := 0
			var failedAttachments []string
			for _, attachment := range result.Attachments {
				if attachment.Path != "" {
					if err := app.ExportFileToWriter(appContext, attachment.Path, zipWr); err != nil {
						logger.Warn("Failed to export attachment",
							mlog.String("path", attachment.Path),
							mlog.Err(err))
						failedAttachments = append(failedAttachments, attachment.Path)
					} else {
						attachmentsExported++
					}
				}
			}
			job.Data[model.WikiJobDataKeyAttachmentsTotal] = strconv.Itoa(len(result.Attachments))
			job.Data[model.WikiJobDataKeyAttachmentsExported] = strconv.Itoa(attachmentsExported)
			if len(failedAttachments) > 0 {
				job.Data[model.WikiJobDataKeyFailedAttachments] = strings.Join(failedAttachments, ",")
			}

			// Close zip writer
			if err := zipWr.Close(); err != nil {
				wr.CloseWithError(err)
				<-writerErrChan
				return model.NewAppError("WikiExportWorker", "wiki_export.worker.close_zip.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			wr.Close()

			// Wait for file write to complete
			if writerErr := <-writerErrChan; writerErr != nil {
				return model.NewAppError("WikiExportWorker", "wiki_export.worker.write_file.error", nil, "", http.StatusInternalServerError).Wrap(writerErr)
			}
		} else {
			// Simple JSONL export without attachments
			_, appErr := app.WikiBulkExport(appContext, wr, job, opts)
			wr.Close()

			// Wait for writer goroutine to complete
			writerErr := <-writerErrChan

			if appErr != nil {
				return appErr
			}
			if writerErr != nil {
				return model.NewAppError("WikiExportWorker", "wiki_export.worker.write_file.error", nil, "", http.StatusInternalServerError).Wrap(writerErr)
			}
		}

		// Only mark export as downloadable if pages were actually exported
		pagesExported, _ := strconv.Atoi(job.Data[model.WikiJobDataKeyPagesExported])
		if pagesExported > 0 {
			job.Data[model.WikiJobDataKeyIsDownloadable] = "true"
			job.Data[model.WikiJobDataKeyExportDir] = exportDir
			job.Data[model.WikiJobDataKeyExportFile] = exportFilename
		}

		return nil
	}

	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
