// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// +build linux

package import_process

import (
	"archive/zip"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/filestore"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

func (w *ImportProcessWorker) unzipAndImport(job *model.Job, unpackDirectory string, importFile filestore.ReadCloseSeeker, importFileSize int64, _ string) *model.AppError {
	// extract the contents of the zipped file.
	zipReader, err := zip.NewReader(importFile.(io.ReaderAt), importFileSize)
	if err != nil {
		appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, err.Error(), http.StatusBadRequest)
		return appError
	}

	var jsonFile io.ReadCloser
	countFiles := len(zipReader.File)
	errors := make(chan *model.AppError, countFiles)
	for _, zipFile := range zipReader.File {
		if jsonFile == nil && filepath.Ext(zipFile.Name) == ".jsonl" {
			jsonFile, err = zipFile.Open()
			if err != nil {
				return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.unzip", nil, err.Error(), http.StatusBadRequest)
			}
			continue
		}
		zipFileName, err := filepath.Abs(zipFile.Name)
		if err != nil {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.unzip", nil, err.Error(), http.StatusBadRequest)
		}
		if strings.Contains(zipFileName, "..") {
			// this check is required to avoid a "zip slip" vulnerability
			// https://cwe.mitre.org/data/definitions/22.html
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.unzip", nil, "illegal .. found in zipfile file path", http.StatusBadRequest)
		}
		namedPipePath := filepath.Join(unpackDirectory, zipFileName)
		err = os.MkdirAll(filepath.Dir(namedPipePath), 0700)
		if err != nil {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.tmp_dir", nil, err.Error(), http.StatusBadRequest)
		}
		mlog.Debug("Opening pipe", mlog.String("pipe", namedPipePath))
		err = syscall.Mknod(namedPipePath, syscall.S_IFIFO|0666, 0)
		if err != nil {
			return model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, err.Error(), http.StatusBadRequest)
		}

		go func(zipFile *zip.File, namedPipePath string, errors chan<- *model.AppError) {
			mlog.Debug("Waiting for file to be read", mlog.String("pipe", namedPipePath))
			namedPipe, err := os.OpenFile(namedPipePath, os.O_WRONLY, 0666)
			if err != nil {
				appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, err.Error(), http.StatusBadRequest)
				errors <- appError
				return
			}
			defer namedPipe.Close()

			fileAttachment, err := zipFile.Open()
			if err != nil {
				appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, err.Error(), http.StatusBadRequest)
				errors <- appError
				return
			}

			defer fileAttachment.Close()
			defer os.Remove(namedPipePath)

			_, err = io.Copy(namedPipe, fileAttachment)
			if err != nil {
				appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.write_file", nil, err.Error(), http.StatusBadRequest)
				errors <- appError
				return
			}

			errors <- nil
			mlog.Debug("Done with pipe", mlog.String("pipe", namedPipePath))
		}(zipFile, namedPipePath, errors)
	}

	// do the actual import.
	appErr, lineNumber := w.app.BulkImportWithPath(w.appContext, jsonFile, false, runtime.NumCPU(), filepath.Join(unpackDirectory, app.ExportDataDir))
	if appErr != nil {
		job.Data["line_number"] = strconv.Itoa(lineNumber)
		return appErr
	}

	for completed := 0; completed < countFiles; completed++ {
		appErr := <-errors
		if appErr != nil {
			return appErr
		}
	}
	return nil
}
