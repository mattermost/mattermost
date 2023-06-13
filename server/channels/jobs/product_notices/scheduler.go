// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product_notices

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type Scheduler struct {
	*jobs.PeriodicScheduler
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(time.Duration(*cfg.AnnouncementSettings.NoticesFetchFrequency) * time.Second)
	return &nextTime
}

func MakeScheduler(jobServer *jobs.JobServer) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.AnnouncementSettings.AdminNoticesEnabled || *cfg.AnnouncementSettings.UserNoticesEnabled
	}
	return &Scheduler{PeriodicScheduler: jobs.NewPeriodicScheduler(jobServer, model.JobTypeProductNotices, 0, isEnabled)}
}
