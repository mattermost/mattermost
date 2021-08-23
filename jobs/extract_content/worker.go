// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package extract_content

import (
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/jobs"
	tjobs "github.com/mattermost/mattermost-server/v6/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

var ignoredFiles = map[string]bool{
	"png": true, "jpg": true, "jpeg": true, "gif": true, "wmv": true,
	"mpg": true, "mpeg": true, "mp3": true, "mp4": true, "ogg": true,
	"ogv": true, "mov": true, "apk": true, "svg": true, "webm": true,
	"mkv": true,
}

func init() {
	app.RegisterJobsExtractContentInterface(func(s *app.Server) tjobs.ExtractContentInterface {
		a := app.New(app.ServerConnector(s))
		return &ExtractContentInterfaceImpl{a}
	})
}

type ExtractContentInterfaceImpl struct {
	app *app.App
}

type ExtractContentWorker struct {
	name        string
	stopChan    chan struct{}
	stoppedChan chan struct{}
	jobsChan    chan model.Job
	jobServer   *jobs.JobServer
	app         *app.App
	appContext  *request.Context
}

func (i *ExtractContentInterfaceImpl) MakeWorker() model.Worker {
	return &ExtractContentWorker{
		name:        "ExtractContent",
		stopChan:    make(chan struct{}),
		stoppedChan: make(chan struct{}),
		jobsChan:    make(chan model.Job),
		jobServer:   i.app.Srv().Jobs,
		app:         i.app,
		appContext:  &request.Context{},
	}
}

func (w *ExtractContentWorker) JobChannel() chan<- model.Job {
	return w.jobsChan
}

func (w *ExtractContentWorker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", w.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", w.name))
		close(w.stoppedChan)
	}()

	for {
		select {
		case <-w.stopChan:
			mlog.Debug("Worker received stop signal", mlog.String("worker", w.name))
			return
		case job := <-w.jobsChan:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", w.name))
			w.doJob(&job)
		}
	}
}

func (w *ExtractContentWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", w.name))
	close(w.stopChan)
	<-w.stoppedChan
}

func (w *ExtractContentWorker) doJob(job *model.Job) {
	if claimed, err := w.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("Worker experienced an error while trying to claim job",
			mlog.String("worker", w.name),
			mlog.String("job_id", job.Id),
			mlog.String("error", err.Error()))
		return
	} else if !claimed {
		return
	}

	var err error
	var fromTS int64 = 0
	var toTS int64 = model.GetMillis()
	if fromStr, ok := job.Data["from"]; ok {
		if fromTS, err = strconv.ParseInt(fromStr, 10, 64); err != nil {
			w.setJobError(job, model.NewAppError("ExtractContentWorker", "extrac_content.worker.do_job.invalid_input.from", nil, "", http.StatusBadRequest))
			return
		}
		fromTS *= 1000
	}
	if toStr, ok := job.Data["to"]; ok {
		if toTS, err = strconv.ParseInt(toStr, 10, 64); err != nil {
			w.setJobError(job, model.NewAppError("ExtractContentWorker", "extrac_content.worker.do_job.invalid_input.to", nil, "", http.StatusBadRequest))
			return
		}
		toTS *= 1000
	}

	var nFiles int
	var nErrs int
	for {
		opts := model.GetFileInfosOptions{
			Since:          fromTS,
			SortBy:         model.FileinfoSortByCreated,
			IncludeDeleted: false,
		}
		fileInfos, err := w.app.Srv().Store.FileInfo().GetWithOptions(0, 1000, &opts)
		if err != nil {
			w.setJobError(job, model.NewAppError("ExtractContentWorker", "extract_content.worker.do_job.file_info", nil, err.Error(), http.StatusInternalServerError))
			return
		}
		if len(fileInfos) == 0 {
			break
		}
		for _, fileInfo := range fileInfos {
			if !ignoredFiles[fileInfo.Extension] {
				mlog.Debug("extracting file", mlog.String("filename", fileInfo.Name), mlog.String("filepath", fileInfo.Path))
				err = w.app.ExtractContentFromFileInfo(fileInfo)
				if err != nil {
					mlog.Warn("Failed to extract file content", mlog.Err(err), mlog.String("file_info_id", fileInfo.Id))
					nErrs++
				}
				nFiles++
			}
		}
		lastFileInfo := fileInfos[len(fileInfos)-1]
		if lastFileInfo.CreateAt > toTS {
			break
		}
		fromTS = lastFileInfo.CreateAt + 1
	}

	job.Data["errors"] = strconv.Itoa(nErrs)
	job.Data["processed"] = strconv.Itoa(nFiles)
	w.updateData(job)

	mlog.Info("Worker: Job is complete", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
	w.setJobSuccess(job)
}

func (w *ExtractContentWorker) setJobSuccess(job *model.Job) {
	if err := w.app.Srv().Jobs.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		w.setJobError(job, err)
	}
}

func (w *ExtractContentWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := w.app.Srv().Jobs.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}

func (w *ExtractContentWorker) updateData(job *model.Job) {
	if err := w.app.Srv().Jobs.UpdateInProgressJobData(job); err != nil {
		mlog.Error("Worker: Failed to update job data", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}
