// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package cloud

import (
	"math"
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

func (worker *Worker) LogAndSetJobSuccess(job *model.Job) {
	mlog.Info("Worker: Job is complete", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
	worker.setJobSuccess(job)
}

func (worker *Worker) ForgivenessCheck(userDifference int) bool {

	systemValue, err := worker.app.Srv().Store.System().GetByName(model.OVER_USER_LIMIT_FORGIVEN_COUNT)

	if err != nil {
		mlog.Error("Error getting days over limit from system store", mlog.String("worker", worker.name), mlog.String("error", err.Error()))
	}

	forgivenessCount := 0
	if systemValue != nil {
		forgivenessCount, err = strconv.Atoi(systemValue.Value)
	}

	if forgivenessCount >= 3 {
		// There's no forgiving someone who's broken our hearts 3 or more times
		return false
	}

	forgivenessCount++
	sysVar := &model.System{Name: model.OVER_USER_LIMIT_FORGIVEN_COUNT, Value: strconv.Itoa(forgivenessCount)}
	err = worker.app.Srv().Store.System().SaveOrUpdate(sysVar)
	if err != nil {
		mlog.Error("Unable to save OVER_USER_LIMIT_FORGIVEN_COUNT", mlog.String("worker", worker.name), mlog.String("error", err.Error()))
	}

	_, err = worker.app.Srv().Store.System().PermanentDeleteByName(model.USER_LIMIT_OVERAGE_CYCLE_END_DATE)
	if err != nil {
		mlog.Error("Unable to reset USER_LIMIT_OVERAGE_CYCLE_END_DATE", mlog.String("worker", worker.name), mlog.String("error", err.Error()))
	}

	// Forgiven!
	return true
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

	if worker.app.Srv().License() == nil || (worker.app.Srv().License() != nil && !*worker.app.Srv().License().Features.Cloud) {
		mlog.Error("Attempt to run cloud job in non-cloud environment", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
		return
	}

	cloudUserLimit := *worker.app.Config().ExperimentalSettings.CloudUserLimit

	var subscription *model.Subscription
	var subErr *model.AppError
	if worker.app.Srv().License() != nil && *worker.app.Srv().License().Features.Cloud {
		subscription, subErr = worker.app.Cloud().GetSubscription()

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

	// If the subscription hasn't been paid for, the Status will be "past_due" or "incomplete". Active is only for good financial standing.
	if subscription != nil && subscription.IsPaidTier == "true" && subscription.Status == "active" {
		// The subscription is no longer in arrears, reset values and exit
		_, valErr := worker.app.Srv().Store.System().PermanentDeleteByName(model.USER_LIMIT_OVERAGE_CYCLE_END_DATE)
		if valErr != nil {
			mlog.Error("Unable to reset USER_LIMIT_OVERAGE_CYCLE_END_DATE", mlog.String("worker", worker.name), mlog.String("error", valErr.Error()))
		}
		worker.LogAndSetJobSuccess(job)
		return
	}

	count, err := worker.app.Srv().Store.User().Count(model.UserCountOptions{IncludeDeleted: false})

	if err != nil {
		mlog.Error("Worker: Failed to get active user count", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		return
	}

	userDifference := cloudUserLimit - count

	overageEndDateSystemValue, nErr := worker.app.Srv().Store.System().GetByName(model.USER_LIMIT_OVERAGE_CYCLE_END_DATE)
	dateLayout := "2006-01-02"

	if nErr != nil {
		mlog.Error("Error getting USER_LIMIT_OVERAGE_CYCLE_END_DATE from system store", mlog.String("worker", worker.name), mlog.String("error", nErr.Error()))
	}

	if overageEndDateSystemValue == nil {
		if userDifference >= 0 {
			// Under user limit, so no need to start tracking yet.
			worker.LogAndSetJobSuccess(job)
			return
		}
		// Our row doesn't exist, so create it and get it from the store
		subCycleEndDate := time.Unix((subscription.EndAt / 1000), 0)
		sysVar := &model.System{Name: model.USER_LIMIT_OVERAGE_CYCLE_END_DATE, Value: subCycleEndDate.Format(dateLayout)}
		err := worker.app.Srv().Store.System().SaveOrUpdate(sysVar)
		if err != nil {
			mlog.Error("Unable to save USER_LIMIT_OVERAGE_CYCLE_END_DATE count", mlog.String("worker", worker.name), mlog.String("error", nErr.Error()))
		}

		worker.LogAndSetJobSuccess(job)
		return
	}

	// If we've reached this point, we know at some time the installation was over the limit

	subCycleEndDate, err := time.Parse(dateLayout, overageEndDateSystemValue.Value)
	if err != nil {
		mlog.Error("Unable to parse USER_LIMIT_OVERAGE_CYCLE_END_DATE", mlog.String("worker", worker.name), mlog.String("error", err.Error()))
	}

	now := time.Now()

	daysDifference := int64(math.Floor(now.Sub(subCycleEndDate).Hours() / 24)) // Get the difference in days between now and cycle end date

	// Get admin users for emailing
	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SYSTEM_ADMIN_ROLE_ID,
		Inactive: false,
	}
	sysAdmins, err := worker.app.GetUsers(userOptions)
	switch daysDifference {
	case 7:
		forgiven := worker.ForgivenessCheck(int(userDifference))
		if forgiven {
			worker.LogAndSetJobSuccess(job)
			return
		}

		for admin := range sysAdmins {
			worker.app.Srv().EmailService.SendOverUserSevenDayWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *worker.app.Config().ServiceSettings.SiteURL)
		}
	case 14:
		forgiven := worker.ForgivenessCheck(int(userDifference))
		if forgiven {
			worker.LogAndSetJobSuccess(job)
			return
		}

		for admin := range sysAdmins {
			worker.app.Srv().EmailService.SendOverUserFourteenDayWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *worker.app.Config().ServiceSettings.SiteURL)
		}
	case 30:
		forgiven := worker.ForgivenessCheck(int(userDifference))
		if forgiven {
			worker.LogAndSetJobSuccess(job)
			return
		}

		// TODO cc support@mattermost.com for one of the emails
		for admin := range sysAdmins {
			worker.app.Srv().EmailService.SendOverUserLimitThirtyDayWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *worker.app.Config().ServiceSettings.SiteURL)
		}
	case 90:
		overLimitDate, _ := worker.app.Srv().Store.System().GetByName(model.OVER_USER_LIMIT_DATE)
		for admin := range sysAdmins {
			worker.app.Srv().EmailService.SendOverUserLimitNinetyDayWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *worker.app.Config().ServiceSettings.SiteURL, overLimitDate.Value)
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
