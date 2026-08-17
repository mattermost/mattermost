// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package import_process

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type AppIface interface {
	configservice.ConfigService
	RemoveFile(path string) *model.AppError
	FileExists(path string) (bool, *model.AppError)
	FileSize(path string) (int64, *model.AppError)
	FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError)
	BulkImportWithPath(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun, extractContent bool, workers int, importPath string) (int, *model.AppError)
	BulkImportWithPathAndOpts(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun, extractContent bool, workers int, importPath string, opts model.BulkImportOpts) (int, *model.AppError)
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "ImportProcess"

	appContext := request.EmptyContext(jobServer.Logger())
	isEnabled := func(cfg *model.Config) bool {
		return true
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		importFileName, ok := job.Data["import_file"]
		if !ok {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.missing_file", nil, "", http.StatusBadRequest)
		}

		var importFilePath string
		var importFileSize int64
		var importFile filestore.ReadCloseSeeker
		if job.Data["local_mode"] == "true" {
			// We simply read the file from the local filesystem.
			info, err := os.Stat(importFileName)
			if errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("file %s doesn't exist.", importFileName)
			}

			importFileSize = info.Size()

			importFile, err = os.Open(importFileName)
			if err != nil {
				return err
			}
			defer importFile.Close()
		} else {
			importFilePath = filepath.Join(*app.Config().ImportSettings.Directory, importFileName)
			if ok, err := app.FileExists(importFilePath); err != nil {
				return err
			} else if !ok {
				return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, "", http.StatusBadRequest)
			}

			var appErr *model.AppError
			importFileSize, appErr = app.FileSize(importFilePath)
			if appErr != nil {
				return appErr
			}

			importFile, appErr = app.FileReader(importFilePath)
			if appErr != nil {
				return appErr
			}
			defer importFile.Close()

			// The import is a long running operation, try to cancel any timeouts attached to the reader.
			type TimeoutCanceler interface{ CancelTimeout() bool }
			if tc, ok := importFile.(TimeoutCanceler); ok {
				if !tc.CancelTimeout() {
					appContext.Logger().Warn("Could not cancel the timeout for the file reader. The import may fail due to a timeout.")
				}
			}
		}

		importZipReader, err := zip.NewReader(importFile.(io.ReaderAt), importFileSize)
		if err != nil {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		// find JSONL import file.
		var jsonZipFile *zip.File
		for _, f := range importZipReader.File {
			if imports.IsRootJsonlFile(f.Name) {
				jsonZipFile = f
				break
			}
		}
		if jsonZipFile == nil {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.missing_jsonl", nil, "jsonFile was nil", http.StatusBadRequest)
		}

		// avoid "zip slip"
		if strings.Contains(jsonZipFile.Name, "..") {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, "jsonFilePath contains path traversal", http.StatusForbidden)
		}

		jsonFile, err := jsonZipFile.Open()
		if err != nil {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		defer jsonFile.Close()

		extractContent := job.Data["extract_content"] == "true"

		numWorkers := runtime.NumCPU()
		if workersStr, ok := job.Data["workers"]; ok {
			if n, err := strconv.Atoi(workersStr); err == nil && n > 0 {
				numWorkers = n
			}
		}

		// Resolve resume checkpoint if the job was previously interrupted.
		resumeFromLine := 0
		if checkpoint, ok := job.Data["checkpoint"]; ok && checkpoint != "" {
			if n, err := strconv.Atoi(checkpoint); err == nil {
				// Only resume if the file identity matches — a different file would
				// make the stored line number meaningless.
				if job.Data["checkpoint_file"] == importFileName {
					resumeFromLine = n
					logger.Info("Resuming import from checkpoint",
						mlog.Int("resume_from_line", resumeFromLine),
						mlog.String("import_file", importFileName))
				} else {
					logger.Warn("Import file changed since last checkpoint; starting from beginning",
						mlog.String("checkpoint_file", job.Data["checkpoint_file"]),
						mlog.String("current_file", importFileName))
				}
			}
		}

		// Enable checkpointing for large imports so a failure can be resumed
		// without restarting from line 1. Use the uncompressed JSONL size since
		// zip compression can reduce a large import to a fraction of its actual size.
		const checkpointThresholdBytes = 1 * 1024 * 1024 // 1 MB uncompressed (lowered for testing; restore to 100 MB for production)
		jsonlUncompressedSize := int64(jsonZipFile.UncompressedSize64)
		var onCheckpoint func(int)
		if jsonlUncompressedSize >= checkpointThresholdBytes {
			onCheckpoint = func(lineNumber int) {
				if lineNumber < 0 {
					// Negative signals total line count from pre-creation pass —
					// store separately so resume can show percentage progress.
					job.Data["total_lines"] = strconv.Itoa(-lineNumber)
				} else {
					job.Data["checkpoint"] = strconv.Itoa(lineNumber)
					job.Data["checkpoint_file"] = importFileName
				}
				if _, uErr := jobServer.Store.Job().UpdateOptimistically(job, model.JobStatusInProgress); uErr != nil {
					logger.Warn("Failed to persist import checkpoint", mlog.Err(uErr))
				}
			}
		}

		// do the actual import.
		importOpts := model.BulkImportOpts{
			DestinationTeamName: job.Data["destination_team_name"],
			SkipPreflight:   job.Data["skip_preflight"] == "true",
			ResumeFromLine:  resumeFromLine,
			OnCheckpoint:    onCheckpoint,
		}
		lineNumber, appErr := app.BulkImportWithPathAndOpts(appContext, jsonFile, importZipReader, false, extractContent, numWorkers, model.ExportDataDir, importOpts)
		if appErr != nil {
			job.Data["line_number"] = strconv.Itoa(lineNumber)
			return appErr
		}

		// No need to remove the file in local mode.
		if job.Data["local_mode"] != "true" {
			// remove import file when done.
			if appErr := app.RemoveFile(importFilePath); appErr != nil {
				return appErr
			}
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
