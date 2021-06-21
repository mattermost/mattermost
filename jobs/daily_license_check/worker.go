// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package daily_license_check

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

type DailyLicenseCheckWorker struct {
	name    string
	stop    chan bool
	stopped chan bool
	jobs    chan model.Job
	App     *app.App
}

func (dlc *DailyLicenseCheckJobInterfaceImpl) MakeWorker() model.Worker {
	worker := DailyLicenseCheckWorker{
		name:    DailyLicenseCheckJob,
		stop:    make(chan bool, 1),
		stopped: make(chan bool, 1),
		jobs:    make(chan model.Job),
		App:     dlc.App,
	}
	return &worker
}

func (dlcworker *DailyLicenseCheckWorker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", dlcworker.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", dlcworker.name))
		dlcworker.stopped <- true
	}()

	for {
		select {
		case <-dlcworker.stop:
			mlog.Debug("Worker received stop signal", mlog.String("worker", dlcworker.name))
			return
		case job := <-dlcworker.jobs:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", dlcworker.name))
			dlcworker.DoJob(&job)
		}
	}
}

func (dlcworker *DailyLicenseCheckWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", dlcworker.name))
	dlcworker.stop <- true
	<-dlcworker.stopped
}

func (dlcworker *DailyLicenseCheckWorker) JobChannel() chan<- model.Job {
	return dlcworker.jobs
}

func (dlcworker *DailyLicenseCheckWorker) DoJob(job *model.Job) {
	license := dlcworker.App.Srv().License()
	now := model.GetMillis()

	dif := license.ExpiresAt - now
	d, _ := time.ParseDuration(fmt.Sprint(dif) + "ms")
	days := d.Hours() / 24
	if days <= 60 && days >= 58 {
		// TODO: Send email
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LICENSE_AT_SIXTY_DAYS_TO_EXPIRATION, "", "", "", nil)
		dlcworker.App.Publish(message)
		dlcworker.setJobSuccess(job)
	}
}

func (dlcworker *DailyLicenseCheckWorker) setJobSuccess(job *model.Job) {
	if err := dlcworker.App.Srv().Jobs.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", dlcworker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		dlcworker.setJobError(job, err)
	}
}

func (dlcworker *DailyLicenseCheckWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := dlcworker.App.Srv().Jobs.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", dlcworker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}
