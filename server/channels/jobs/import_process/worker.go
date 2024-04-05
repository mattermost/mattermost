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
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/platform/services/configservice"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type AppIface interface {
	configservice.ConfigService
	RemoveFile(path string) *model.AppError
	FileExists(path string) (bool, *model.AppError)
	FileSize(path string) (int64, *model.AppError)
	FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError)
	BulkImportWithPath(c request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun, extractContent bool, workers int, importPath string) (*model.AppError, int)
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
				return fmt.Errorf("file %s doesn't exist.", importFile)
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
		var jsonFile io.ReadCloser
		for _, f := range importZipReader.File {
			if filepath.Ext(f.Name) != ".jsonl" {
				continue
			}
			// avoid "zip slip"
			if strings.Contains(f.Name, "..") {
				return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, "jsonFilePath contains path traversal", http.StatusForbidden)
			}

			jsonFile, err = f.Open()
			if err != nil {
				return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			defer jsonFile.Close()
			break
		}

		if jsonFile == nil {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.missing_jsonl", nil, "jsonFile was nil", http.StatusBadRequest)
		}

		extractContent := job.Data["extract_content"] == "true"
		// do the actual import.
		appErr, lineNumber := app.BulkImportWithPath(appContext, jsonFile, importZipReader, false, extractContent, runtime.NumCPU(), model.ExportDataDir)
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
