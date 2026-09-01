// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package extract_content

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const schedFreq = 1 * time.Hour

type Scheduler struct {
	*jobs.PeriodicScheduler
	jobServer *jobs.JobServer
}

func MakeScheduler(jobServer *jobs.JobServer) *Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.FileSettings.ExtractContent
	}
	return &Scheduler{
		PeriodicScheduler: jobs.NewPeriodicScheduler(jobServer, model.JobTypeExtractContent, schedFreq, isEnabled),
		jobServer:         jobServer,
	}
}

func (scheduler *Scheduler) ScheduleJob(rctx request.CTX, cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	return scheduler.jobServer.CreateJob(rctx, model.JobTypeExtractContent, map[string]string{
		catchupJobDataKey: "true",
	})
}
