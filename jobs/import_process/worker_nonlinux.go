// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// +build !linux

package import_process

import (
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/utils"
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

	// TODO (MM-30187): improve this process by eliminating the need to unzip the import
	// file locally and instead do the whole bulk import process in memory by
	// streaming the import file.

	// create a temporary dir to extract the zipped import file.
	dir, err := ioutil.TempDir("", "import")
	if err != nil {
		appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.tmp_dir", nil, err.Error(), http.StatusInternalServerError)
		w.setJobError(job, appError)
		return
	}
	defer os.RemoveAll(dir)

	// extract the contents of the zipped file.
	paths, err := utils.UnzipToPath(importFile.(io.ReaderAt), importFileSize, dir)
	if err != nil {
		appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.unzip", nil, err.Error(), http.StatusInternalServerError)
		w.setJobError(job, appError)
		return
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
		appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.missing_jsonl", nil, "", http.StatusBadRequest)
		w.setJobError(job, appError)
		return
	}

	jsonFile, err := os.Open(jsonFilePath)
	if err != nil {
		appError := model.NewAppError("ImportProcessWorker", "import_process.worker.do_job.open_file", nil, err.Error(), http.StatusInternalServerError)
		w.setJobError(job, appError)
		return
	}

	// do the actual import.
	appErr, lineNumber := w.app.BulkImportWithPath(w.appContext, jsonFile, false, runtime.NumCPU(), filepath.Join(dir, app.ExportDataDir))
	if appErr != nil {
		job.Data["line_number"] = strconv.Itoa(lineNumber)
		w.setJobError(job, appErr)
		return
	}

	// remove import file when done.
	if appErr := w.app.RemoveFile(importFilePath); appErr != nil {
		w.setJobError(job, appErr)
		return
	}

	mlog.Info("Worker: Job is complete", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
	w.setJobSuccess(job)
}
