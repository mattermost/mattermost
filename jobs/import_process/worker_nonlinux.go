// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// +build !linux

package import_process

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/filestore"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func (w *ImportProcessWorker) unzipAndImport(job *model.Job, unpackDirectory string, importFile filestore.ReadCloseSeeker, importFileSize int64, importFilePath string) *model.AppError {
	// TODO (MM-30187): improve this process by eliminating the need to unzip the import
	// file locally and instead do the whole bulk import process in memory by
	// streaming the import file.

	// extract the contents of the zipped file.
	paths, err := utils.UnzipToPath(importFile.(io.ReaderAt), importFileSize, unpackDirectory)
	if err != nil {
		return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.unzip", nil, err.Error(), http.StatusInternalServerError)
	}

	// find JSONL import file.
	var jsonFilePath string
	for _, path := range paths {
		if filepath.Ext(path) == ".jsonl" {
			jsonFilePath = path
			break
		}
	}

	if jsonFilePath == "" {
		return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.missing_jsonl", nil, "", http.StatusBadRequest)
	}

	jsonFile, err := os.Open(jsonFilePath)
	if err != nil {
		return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, err.Error(), http.StatusInternalServerError)
	}

	// do the actual import.
	appErr, lineNumber := w.app.BulkImportWithPath(w.appContext, jsonFile, false, runtime.NumCPU(), filepath.Join(unpackDirectory, app.ExportDataDir))
	if appErr != nil {
		job.Data["line_number"] = strconv.Itoa(lineNumber)
		return appErr
	}

	return nil
}
