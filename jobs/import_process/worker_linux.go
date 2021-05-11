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
	"sync"
	"syscall"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

func (w *ImportProcessWorker) doJob(job *model.Job) {
	if claimed, err := w.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("Worker experienced an error while trying to claim job",
			mlog.String("worker", w.name),
			mlog.String("job_id", job.Id),
			mlog.String("error", err.Error()))
		return
	} else if !claimed {
		return
	}

	importFileName, ok := job.Data["import_file"]
	if !ok {
		appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.missing_file", nil, "", http.StatusBadRequest)
		w.setJobError(job, appError)
		return
	}

	importFilePath := filepath.Join(*w.app.Config().ImportSettings.Directory, importFileName)
	if ok, err := w.app.FileExists(importFilePath); err != nil {
		w.setJobError(job, err)
		return
	} else if !ok {
		appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, "", http.StatusBadRequest)
		w.setJobError(job, appError)
		return
	}

	importFileSize, appErr := w.app.FileSize(importFilePath)
	if appErr != nil {
		w.setJobError(job, appErr)
		return
	}

	importFile, appErr := w.app.FileReader(importFilePath)
	if appErr != nil {
		w.setJobError(job, appErr)
		return
	}
	defer importFile.Close()

	// extract the contents of the zipped file.
	zipReader, err := zip.NewReader(importFile.(io.ReaderAt), importFileSize)
	if err != nil {
		appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, err.Error(), http.StatusBadRequest)
		w.setJobError(job, appError)
		return
	}

	var jsonFile io.ReadCloser
	var wg sync.WaitGroup
	for _, zipFile := range zipReader.File {
		if jsonFile == nil && filepath.Ext(zipFile.Name) == ".jsonl" {
			mlog.Warn("XXX found JSONL file")
			jsonFile, err = zipFile.Open()
			if err != nil {
				appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, err.Error(), http.StatusBadRequest)
				w.setJobError(job, appError)
				return
			}
			continue
		}

		mlog.Warn("XXX Opening pipe", mlog.String("file", zipFile.Name))
		wg.Add(1)
		err := syscall.Mknod(zipFile.Name, syscall.S_IFIFO|0666, 0)
		if err != nil {
			panic(err)
		}

		go func(wg *sync.WaitGroup, zipFile *zip.File) {
			mlog.Warn("XXX waiting for file to be read", mlog.String("file", zipFile.Name))
			defer wg.Done()
			namedPipe, err := os.OpenFile(zipFile.Name, os.O_WRONLY, 0666)
			if err != nil {
				appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, err.Error(), http.StatusBadRequest)
				w.setJobError(job, appError)
				return
			}
			defer namedPipe.Close()

			fileAttachment, err := zipFile.Open()
			if err != nil {
				appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, err.Error(), http.StatusBadRequest)
				w.setJobError(job, appError)
				return
			}

			defer fileAttachment.Close()
			defer os.Remove(zipFile.Name)

			_, err = io.Copy(namedPipe, fileAttachment)
			if err != nil {
				appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.file_exists", nil, err.Error(), http.StatusBadRequest)
				w.setJobError(job, appError)
				return
			}

			mlog.Warn("XXX done with file", mlog.String("file", zipFile.Name))
		}(&wg, zipFile)
	}

	// do the actual import.
	appErr, lineNumber := w.app.BulkImport(w.appContext, jsonFile, false, runtime.NumCPU())
	if appErr != nil {
		job.Data["line_number"] = strconv.Itoa(lineNumber)
		w.setJobError(job, appErr)
		return
	}

	wg.Wait()
	mlog.Info("Worker: Job is complete", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
	w.setJobSuccess(job)
}
