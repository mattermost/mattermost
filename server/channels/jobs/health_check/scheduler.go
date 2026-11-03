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

// A run takes minutes at most, so an older in-progress job belongs to a node that died
// mid-run and must not block new runs.
const staleInProgressAfter = time.Hour

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

// ScheduleJob skips without an Enterprise license: the run would be a no-op, yet its job would
// succeed and report the server as evaluated. The license is checked here rather than in
// Enabled, which the framework only re-reads on config changes, so a license added later still
// gets the next hourly run. It also skips while a health_check job is pending or in progress,
// so runs never overlap: the framework passes pendingJobs but PeriodicScheduler ignores it,
// creating a job every period whatever is pending or running. pendingJobs is checked as well
// as the newest job, which can be a newer stale in-progress job hiding an older pending one.
func (s *Scheduler) ScheduleJob(rctx request.CTX, cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	if !model.MinimumEnterpriseLicense(s.licenseFunc()) || pendingJobs {
		return nil, nil
	}

	job, err := s.jobServer.Store.Job().GetNewestJobByStatusesAndType([]string{model.JobStatusPending, model.JobStatusInProgress}, model.JobTypeHealthCheck)
	var nfErr *store.ErrNotFound
	if err != nil && !errors.As(err, &nfErr) {
		return nil, model.NewAppError("ScheduleJob", "app.job.get_newest_job_by_status_and_type.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if job != nil && (job.Status == model.JobStatusPending || time.Since(time.UnixMilli(job.LastActivityAt)) < staleInProgressAfter) {
		return nil, nil
	}

	return s.PeriodicScheduler.ScheduleJob(rctx, cfg, pendingJobs, lastSuccessfulJob)
}
