// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wiki_import

import (
	"archive/zip"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type AppIface interface {
	configservice.ConfigService
	RemoveFile(path string) *model.AppError
	FileExists(path string) (bool, *model.AppError)
	FileSize(path string) (int64, *model.AppError)
	FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError)
	BulkImport(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun bool, workers int) (int, *model.AppError)
	InvalidateCacheForWikiImport(rctx request.CTX, channelIds []string)
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "WikiImport"

	appContext := request.EmptyContext(jobServer.Logger())
	isEnabled := func(cfg *model.Config) bool {
		return true
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		importFileName, ok := job.Data[model.WikiJobDataKeyImportFile]
		if !ok || strings.TrimSpace(importFileName) == "" {
			return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.missing_file", nil, "", http.StatusBadRequest)
		}

		// Validate filename doesn't contain path traversal
		cleanedFilename := filepath.Clean(importFileName)
		if strings.Contains(cleanedFilename, "..") || filepath.IsAbs(cleanedFilename) {
			return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.invalid_path", map[string]any{"File": importFileName}, "path traversal attempt detected", http.StatusBadRequest)
		}

		var importFilePath string
		var importFile filestore.ReadCloseSeeker
		if job.Data[model.WikiJobDataKeyLocalMode] == "true" {
			// Read from local filesystem
			fileInfo, err := os.Stat(importFileName)
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.file_not_found", map[string]any{"File": importFileName}, "", http.StatusNotFound)
				}
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.stat_file", map[string]any{"File": importFileName}, err.Error(), http.StatusInternalServerError).Wrap(err)
			}

			if fileInfo.IsDir() {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.is_directory", map[string]any{"File": importFileName}, "", http.StatusBadRequest)
			}

			f, err := os.Open(importFileName)
			if err != nil {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.open_file", map[string]any{"File": importFileName}, err.Error(), http.StatusInternalServerError).Wrap(err)
			}
			defer f.Close()
			importFile = f
		} else {
			// Validate config before use
			if app.Config().ImportSettings.Directory == nil || *app.Config().ImportSettings.Directory == "" {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.config.nil_directory", nil, "", http.StatusInternalServerError)
			}

			importFilePath = filepath.Join(*app.Config().ImportSettings.Directory, cleanedFilename)

			// Additional path traversal check: ensure final path is within import directory
			absImportDir, err := filepath.Abs(*app.Config().ImportSettings.Directory)
			if err != nil {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.abs_path", map[string]any{"Path": *app.Config().ImportSettings.Directory}, "failed to resolve import directory", http.StatusInternalServerError).Wrap(err)
			}
			absImportPath, err := filepath.Abs(importFilePath)
			if err != nil {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.abs_path", map[string]any{"Path": importFilePath}, "failed to resolve import path", http.StatusInternalServerError).Wrap(err)
			}
			if !strings.HasPrefix(absImportPath, absImportDir) {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.invalid_path", map[string]any{"File": importFileName}, "path traversal attempt detected", http.StatusBadRequest)
			}

			if ok, err := app.FileExists(importFilePath); err != nil {
				return err
			} else if !ok {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.file_not_found", map[string]any{"File": importFilePath}, "", http.StatusNotFound)
			}

			var appErr *model.AppError
			importFile, appErr = app.FileReader(importFilePath)
			if appErr != nil {
				return appErr
			}
			defer importFile.Close()

			// Cancel any timeouts for long-running import
			type TimeoutCanceler interface{ CancelTimeout() bool }
			if tc, ok := importFile.(TimeoutCanceler); ok {
				tc.CancelTimeout()
			}
		}

		// Wiki imports use JSONL directly without a zip wrapper
		// Pass nil for attachmentsReader since wiki exports don't include attachments yet
		lineNumber, appErr := app.BulkImport(appContext, importFile, nil, false, 1)
		if appErr != nil {
			logger.Error("Wiki bulk import failed",
				mlog.Int("line_number", lineNumber),
				mlog.String("import_file", importFileName),
				mlog.Err(appErr))
			job.Data["line_number"] = strconv.Itoa(lineNumber)
			return appErr
		}

		// Clean up import file if not in local mode
		if job.Data[model.WikiJobDataKeyLocalMode] != "true" {
			if appErr := app.RemoveFile(importFilePath); appErr != nil {
				logger.Warn("Failed to remove import file", mlog.String("path", importFilePath), mlog.Err(appErr))
			}
		}

		// Invalidate caches to ensure all cluster nodes see imported data
		// Note: We don't have channel IDs from the import, so pass empty slice
		// to trigger a general cache clear
		app.InvalidateCacheForWikiImport(appContext, nil)

		return nil
	}

	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
