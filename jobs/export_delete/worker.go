// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_delete

import (
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/configservice"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type AppIface interface {
	ListDirectory(path string) ([]string, *model.AppError)
	FileModTime(path string) (time.Time, *model.AppError)
	RemoveFile(path string) *model.AppError
}

type ExportDeleteWorker struct {
	name          string
	stopChan      chan struct{}
	stoppedChan   chan struct{}
	jobsChan      chan model.Job
	jobServer     *jobs.JobServer
	configService configservice.ConfigService
	app           AppIface
}

func MakeWorker(jobServer *jobs.JobServer, configService configservice.ConfigService, app AppIface) model.Worker {
	return &ExportDeleteWorker{
		name:          "ExportDelete",
		stopChan:      make(chan struct{}),
		stoppedChan:   make(chan struct{}),
		jobsChan:      make(chan model.Job),
		jobServer:     jobServer,
		configService: configService,
		app:           app,
	}
}

func (w *ExportDeleteWorker) JobChannel() chan<- model.Job {
	return w.jobsChan
}

func (w *ExportDeleteWorker) IsEnabled(cfg *model.Config) bool {
	return *cfg.ExportSettings.Directory != "" && *cfg.ExportSettings.RetentionDays > 0
}

func (w *ExportDeleteWorker) Run() {
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

func (w *ExportDeleteWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", w.name))
	close(w.stopChan)
	<-w.stoppedChan
}

func (w *ExportDeleteWorker) doJob(job *model.Job) {
	if claimed, err := w.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("Worker experienced an error while trying to claim job",
			mlog.String("worker", w.name),
			mlog.String("job_id", job.Id),
			mlog.String("error", err.Error()))
		return
	} else if !claimed {
		return
	}

	exportPath := *w.configService.Config().ExportSettings.Directory
	retentionTime := time.Duration(*w.configService.Config().ExportSettings.RetentionDays) * 24 * time.Hour
	exports, appErr := w.app.ListDirectory(exportPath)
	if appErr != nil {
		w.setJobError(job, appErr)
		return
	}

	var hasErrs bool
	for i := range exports {
		filename := filepath.Base(exports[i])
		modTime, appErr := w.app.FileModTime(filepath.Join(exportPath, filename))
		if appErr != nil {
			mlog.Debug("Worker: Failed to get file modification time",
				mlog.Err(appErr), mlog.String("export", exports[i]))
			hasErrs = true
			continue
		}

		if time.Now().After(modTime.Add(retentionTime)) {
			// remove file data from storage.
			if appErr := w.app.RemoveFile(exports[i]); appErr != nil {
				mlog.Debug("Worker: Failed to remove file",
					mlog.Err(appErr), mlog.String("export", exports[i]))
				hasErrs = true
				continue
			}
		}
	}

	if hasErrs {
		mlog.Warn("Worker: errors occurred")
	}

	mlog.Info("Worker: Job is complete", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
	w.setJobSuccess(job)
}

func (w *ExportDeleteWorker) setJobSuccess(job *model.Job) {
	if err := w.jobServer.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		w.setJobError(job, err)
	}
}

func (w *ExportDeleteWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := w.jobServer.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}
