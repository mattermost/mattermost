// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// ResetWedgedJobs marks in-progress jobs of the given type as errored when they have shown
// no activity for longer than the given timeout. Both LastActivityAt and StartAt must be
// stale, and the transition is optimistic so a concurrently completed job is not clobbered.
// It returns only jobs whose transition committed.
func (srv *JobServer) ResetWedgedJobs(rctx request.CTX, jobType string, timeout time.Duration) ([]*model.Job, *model.AppError) {
	jobs, appErr := srv.GetJobsByTypeAndStatus(rctx, jobType, model.JobStatusInProgress)
	if appErr != nil {
		return nil, appErr
	}

	cutoff := model.GetMillis() - timeout.Milliseconds()
	var resetJobs []*model.Job
	for _, job := range jobs {
		if job.LastActivityAt >= cutoff || job.StartAt >= cutoff {
			continue
		}

		logger := rctx.Logger().With(JobLoggerFields(job)...)
		logger.Warn("Job appears to be wedged. Marking it as errored.",
			mlog.Millis("last_activity_at", job.LastActivityAt),
			mlog.Millis("start_at", job.StartAt),
			mlog.Duration("wedged_timeout", timeout),
		)

		wedgedErr := model.NewAppError("ResetWedgedJobs", "app.job.wedged.app_error", nil,
			fmt.Sprintf("no job activity for longer than %s; last_activity_at=%d start_at=%d",
				timeout, job.LastActivityAt, job.StartAt),
			http.StatusInternalServerError)
		if setErr := srv.SetJobError(job, wedgedErr); setErr != nil {
			logger.Warn("Could not mark wedged job as errored; it is likely no longer in progress",
				mlog.Err(setErr))
			continue
		}
		resetJobs = append(resetJobs, job)
	}

	return resetJobs, nil
}
