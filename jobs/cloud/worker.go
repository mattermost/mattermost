// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package cloud

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/jobs"
	tjobs "github.com/mattermost/mattermost-server/v5/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	JobName = "Cloud"
)

type Worker struct {
	name      string
	stop      chan bool
	stopped   chan bool
	jobs      chan model.Job
	jobServer *jobs.JobServer
	app       *app.App
}

func init() {
	app.RegisterJobsCloudInterface(func(a *app.App) tjobs.CloudJobInterface {
		return &CloudJobInterfaceImpl{a}
	})
}

type CloudJobInterfaceImpl struct {
	App *app.App
}

func (m *CloudJobInterfaceImpl) MakeWorker() model.Worker {
	worker := Worker{
		name:      JobName,
		stop:      make(chan bool, 1),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: m.App.Srv().Jobs,
		app:       m.App,
	}
	return &worker
}

func (worker *Worker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", worker.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", worker.name))
		worker.stopped <- true
	}()

	for {
		select {
		case <-worker.stop:
			mlog.Debug("Worker received stop signal", mlog.String("worker", worker.name))
			return
		case job := <-worker.jobs:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", worker.name))
			worker.DoJob(&job)
		}
	}
}

func (worker *Worker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", worker.name))
	worker.stop <- true
	<-worker.stopped
}

func (worker *Worker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *Worker) DoJob(job *model.Job) {
	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("Worker experienced an error while trying to claim job",
			mlog.String("worker", worker.name),
			mlog.String("job_id", job.Id),
			mlog.String("error", err.Error()))
		return
	} else if !claimed {
		return
	}

	cloudUserLimit := *worker.app.Config().ExperimentalSettings.CloudUserLimit

	var subscription *model.Subscription
	if worker.app.Srv().License() != nil && *worker.app.Srv().License().Features.Cloud {
		subscription, subErr := worker.app.Cloud().GetSubscription()
		if subErr != nil {
			mlog.Error("Worker: Failed to retrieve subscription", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", subErr.Error()))
			worker.setJobError(job, subErr)
			return
		}

		if subscription == nil {
			mlog.Error("Worker: Failed to retrieve subscription", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
			return
		}
	}

	if subscription != nil && subscription.IsPaidTier == "true" {
		mlog.Info("On Paid Tier, exiting", mlog.String("worker", worker.name))
		return
	}

	count, err := worker.app.Srv().Store.User().Count(model.UserCountOptions{IncludeDeleted: false})

	if err != nil {
		mlog.Error("Worker: Failed to get active user count", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		return
	}

	userDifference := cloudUserLimit - count
	if userDifference >= 0 {
		mlog.Info("Under user limit, exiting", mlog.String("worker", worker.name))
		return
	}

	systemValue, nErr := worker.app.Srv().Store.System().GetByName(model.DAYS_OVER_USER_LIMIT)

	if nErr != nil {
		mlog.Error("Error getting days over limit from system store", mlog.String("worker", worker.name), mlog.String("error", nErr.Error()))
	}

	if systemValue == nil {
		// Our row doesn't exist, so create it and get it from the store
		sysVar := &model.System{Name: model.DAYS_OVER_USER_LIMIT, Value: "0"}
		err := worker.app.Srv().Store.System().SaveOrUpdate(sysVar)
		if err != nil {
			mlog.Error("Unable to save DAYS_OVER_USER_LIMIT count", mlog.String("worker", worker.name), mlog.String("error", nErr.Error()))
		}

		systemValue, _ = worker.app.Srv().Store.System().GetByName(model.DAYS_OVER_USER_LIMIT)

		// Store today's date (first day over limit) so we can reference it later
		t := time.Now()
		firstDayOverVar := &model.System{Name: model.OVER_USER_LIMIT_DATE, Value: t.Format("2006-01-02")}
		err = worker.app.Srv().Store.System().SaveOrUpdate(firstDayOverVar)
		if err != nil {
			mlog.Error("Unable to save DAYS_OVER_USER_LIMIT count", mlog.String("worker", worker.name), mlog.String("error", nErr.Error()))
		}
	}

	daysOverLimit, err := strconv.ParseInt(systemValue.Value, 10, 64)

	// Bump up the number of days over limit and save to db
	daysOverLimit = daysOverLimit + 1
	systemValue.Value = strconv.FormatInt(daysOverLimit, 10)
	err = worker.app.Srv().Store.System().SaveOrUpdate(systemValue)
	if err != nil {
		mlog.Error("Unable to save DAYS_OVER_USER_LIMIT count", mlog.String("worker", worker.name), mlog.String("error", nErr.Error()))
	}

	// Get admin users for emailing
	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SYSTEM_ADMIN_ROLE_ID,
		Inactive: false,
	}
	sysAdmins, err := worker.app.GetUsers(userOptions)
	switch daysOverLimit {
	case 30:
		// TODO cc support@mattermost.com for one of the emails
		mlog.Info("30 DAYS OVER LIMIT")
		for admin := range sysAdmins {
			worker.app.Srv().EmailService.SendOverUserLimitThirtyDayWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *worker.app.Config().ServiceSettings.SiteURL)
		}
	case 90:
		mlog.Info("90 DAYS OVER LIMIT")
		// TODO cc support@mattermost.com for one of the emails
		overLimitDate, _ := worker.app.Srv().Store.System().GetByName(model.OVER_USER_LIMIT_DATE)
		for admin := range sysAdmins {
			worker.app.Srv().EmailService.SendOverUserLimitNinetyDayWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *worker.app.Config().ServiceSettings.SiteURL, overLimitDate.Value)
		}
	case 91:
		mlog.Info("91 DAYS OVER LIMIT")
		// TODO cc support@mattermost.com for one of the emails
		for admin := range sysAdmins {
			worker.app.Srv().EmailService.SendOverUserLimitWorkspaceSuspendedWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *worker.app.Config().ServiceSettings.SiteURL)
		}
	}

	mlog.Info("Worker: Job is complete", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
	worker.setJobSuccess(job)
}

func (worker *Worker) setJobSuccess(job *model.Job) {
	if err := worker.app.Srv().Jobs.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		worker.setJobError(job, err)
	}
}

func (worker *Worker) setJobError(job *model.Job, appError *model.AppError) {
	if err := worker.app.Srv().Jobs.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}
