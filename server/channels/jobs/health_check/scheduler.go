// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package health_check

import (
	"errors"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const schedFreq = time.Hour

// StaleInProgressAfter is how long an in-progress job may go without activity. A run takes
// minutes at most, so an older in-progress job belongs to a node that died mid-run. It is closed
// as failed so it neither blocks new runs nor shows as running for ever.
const StaleInProgressAfter = time.Hour

func isEnabled(cfg *model.Config) bool {
	return cfg.FeatureFlags.HealthDashboard
}

type Scheduler struct {
	*jobs.PeriodicScheduler
	jobServer   *jobs.JobServer
	licenseFunc func() *model.License
}

func MakeScheduler(jobServer *jobs.JobServer, licenseFunc func() *model.License) *Scheduler {
	return &Scheduler{
		PeriodicScheduler: jobs.NewPeriodicScheduler(jobServer, model.JobTypeHealthCheck, schedFreq, isEnabled),
		jobServer:         jobServer,
		licenseFunc:       licenseFunc,
	}
}

// ScheduleJob skips without an Enterprise license, as the run would only fail. The license is
// checked here rather than in Enabled, which the framework only re-reads on config changes, so
// a license added later still gets the next hourly run.
//
// It also keeps runs from overlapping, which the framework doesn't: it passes pendingJobs but
// PeriodicScheduler ignores it and creates a job every period. A job pending or in progress
// skips the run; CreateJobOnce checks again atomically as it saves.
func (s *Scheduler) ScheduleJob(rctx request.CTX, _ *model.Config, pendingJobs bool, _ *model.Job) (*model.Job, *model.AppError) {
	if !model.MinimumEnterpriseLicense(s.licenseFunc()) || pendingJobs {
		return nil, nil
	}

	running, appErr := RunningJob(rctx, s.jobServer)
	if appErr != nil {
		return nil, appErr
	}
	if running != nil {
		return nil, nil
	}

	return s.jobServer.CreateJobOnce(rctx, model.JobTypeHealthCheck, nil)
}

// RunningJob returns the health_check job in progress, or nil if there is none. A job in progress
// with no activity for StaleInProgressAfter belongs to a node that died mid-run: RunningJob closes
// it as failed and returns nil. The scheduler and on-demand runs share it, so neither can be
// blocked by a dead run.
func RunningJob(rctx request.CTX, jobServer *jobs.JobServer) (*model.Job, *model.AppError) {
	running, err := jobServer.Store.Job().GetNewestJobByStatusAndType(model.JobStatusInProgress, model.JobTypeHealthCheck)
	var nfErr *store.ErrNotFound
	if err != nil && !errors.As(err, &nfErr) {
		return nil, model.NewAppError("RunningJob", "app.job.get_newest_job_by_status_and_type.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if running == nil {
		return nil, nil
	}
	if time.Since(time.UnixMilli(running.LastActivityAt)) < StaleInProgressAfter {
		return running, nil
	}

	rctx.Logger().Warn("Health check job appears to be stuck, closing it as failed", jobs.JobLoggerFields(running)...)
	if appErr := jobServer.SetJobError(running, nil); appErr != nil {
		return nil, appErr
	}
	return nil, nil
}
