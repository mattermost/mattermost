// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package import_process

import (
	"archive/zip"
	"io"
	"net/http"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v6/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/channels/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/services/configservice"
	"github.com/mattermost/mattermost-server/v6/platform/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const jobName = "ImportProcess"

type AppIface interface {
	configservice.ConfigService
	RemoveFile(path string) *model.AppError
	FileExists(path string) (bool, *model.AppError)
	FileSize(path string) (int64, *model.AppError)
	FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError)
	BulkImportWithPath(c *request.Context, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun bool, workers int, importPath string) (*model.AppError, int)
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) model.Worker {
	appContext := request.EmptyContext(app.Log())
	isEnabled := func(cfg *model.Config) bool {
		return true
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		importFileName, ok := job.Data["import_file"]
		if !ok {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.missing_file", nil, "", http.StatusBadRequest)
		}

		importFilePath := filepath.Join(*app.Config().ImportSettings.Directory, importFileName)
		if ok, err := app.FileExists(importFilePath); err != nil {
			return err
		} else if !ok {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, "", http.StatusBadRequest)
		}

		importFileSize, appErr := app.FileSize(importFilePath)
		if appErr != nil {
			return appErr
		}

		importFile, appErr := app.FileReader(importFilePath)
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

		// do the actual import.
		appErr, lineNumber := app.BulkImportWithPath(appContext, jsonFile, importZipReader, false, runtime.NumCPU(), model.ExportDataDir)
		if appErr != nil {
			job.Data["line_number"] = strconv.Itoa(lineNumber)
			return appErr
		}

		// remove import file when done.
		if appErr := app.RemoveFile(importFilePath); appErr != nil {
			return appErr
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
