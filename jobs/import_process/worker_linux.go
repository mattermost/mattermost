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

	countFiles := len(zipReader.File) - 1 // -1 because the JSONL file is handled differently
	errors := make(chan *model.AppError, countFiles)

	jsonFile, appErr := w.unzipToPipes(zipReader, unpackDirectory, errors)
	if appErr != nil {
		return appErr
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

func (w *ImportProcessWorker) unzipToPipes(zipReader *zip.Reader, unpackDirectory string, errors chan *model.AppError) (io.ReadCloser, *model.AppError) {
	var jsonFile io.ReadCloser
	var err error
	for _, zipFile := range zipReader.File {
		if jsonFile == nil && filepath.Ext(zipFile.Name) == ".jsonl" {
			jsonFile, err = zipFile.Open()
			if err != nil {
				return nil, model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.unzip", nil, err.Error(), http.StatusBadRequest)
			}
			continue
		}
		zipFileName, err := filepath.Abs(zipFile.Name)
		if err != nil {
			return nil, model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.unzip", nil, err.Error(), http.StatusBadRequest)
		}
		if strings.Contains(zipFileName, "..") {
			// this check is required to avoid a "zip slip" vulnerability
			// https://cwe.mitre.org/data/definitions/22.html
			return nil, model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.unzip", nil, "illegal .. found in zipfile file path", http.StatusBadRequest)
		}
		namedPipePath := filepath.Join(unpackDirectory, zipFileName)
		err = os.MkdirAll(filepath.Dir(namedPipePath), 0700)
		if err != nil {
			return nil, model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.tmp_dir", nil, err.Error(), http.StatusBadRequest)
		}
		mlog.Debug("Opening pipe", mlog.String("pipe", namedPipePath))
		err = syscall.Mkfifo(namedPipePath, 0666)
		if err != nil {
			return nil, model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, err.Error(), http.StatusBadRequest)
		}

		go func(zipFile *zip.File, namedPipePath string, errors chan<- *model.AppError) {
			namedPipe, err := os.OpenFile(namedPipePath, os.O_WRONLY, 0666)
			if err != nil {
				errors <- model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, err.Error(), http.StatusBadRequest)
				return
			}
			defer namedPipe.Close()
			defer os.Remove(namedPipePath)

			fileAttachment, err := zipFile.Open()
			if err != nil {
				errors <- model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, err.Error(), http.StatusBadRequest)
				return
			}

			defer fileAttachment.Close()

			mlog.Debug("Waiting for file to be read", mlog.String("pipe", namedPipePath))
			_, err = io.Copy(namedPipe, fileAttachment)
			if err != nil {
				errors <- model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.write_file", nil, err.Error(), http.StatusBadRequest)
				return
			}

			errors <- nil
			mlog.Debug("Done with pipe", mlog.String("pipe", namedPipePath))
		}(zipFile, namedPipePath, errors)
	}
	return jsonFile, nil
}
