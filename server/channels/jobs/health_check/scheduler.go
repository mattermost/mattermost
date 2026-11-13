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

// A run can't hang: collecting diagnostics is capped by healthCollectTimeout (3 minutes, in the
// app package), and every later step is a database query bounded by SqlSettings.QueryTimeout, or
// in-memory work. A run therefore ends within a few minutes, and an in-progress job older than this
// belongs to a node that died mid-run. It is closed as failed so it neither blocks new runs nor
// shows as running for ever. Keep this well above healthCollectTimeout if that is raised: closing a
// run that is still going would let a second run start alongside it.
const staleInProgressAfter = 15 * time.Minute

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

	running, err := s.jobServer.Store.Job().GetNewestJobByStatusAndType(model.JobStatusInProgress, model.JobTypeHealthCheck)
	var nfErr *store.ErrNotFound
	if err != nil && !errors.As(err, &nfErr) {
		return nil, model.NewAppError("ScheduleJob", "app.job.get_newest_job_by_status_and_type.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if running != nil {
		if time.Since(time.UnixMilli(running.LastActivityAt)) < staleInProgressAfter {
			return nil, nil
		}
		rctx.Logger().Warn("Health check job appears to be stuck, closing it as failed", jobs.JobLoggerFields(running)...)
		if appErr := s.jobServer.SetJobError(running, nil); appErr != nil {
			return nil, appErr
		}
	}

	return s.jobServer.CreateJobOnce(rctx, model.JobTypeHealthCheck, nil)
}
