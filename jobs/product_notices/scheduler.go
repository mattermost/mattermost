// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product_notices

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

type Scheduler struct {
	App *app.App
}

func (m *ProductNoticesJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{m.App}
}

func (scheduler *Scheduler) Name() string {
	return JobName + "Scheduler"
}

func (scheduler *Scheduler) JobType() string {
	return model.JOB_TYPE_PRODUCT_NOTICES
}

func (scheduler *Scheduler) Enabled(cfg *model.Config) bool {
	// Only enabled when ExtendSessionLengthWithActivity is enabled.
	return *cfg.AnnouncementSettings.AdminNoticesEnabled || *cfg.AnnouncementSettings.UserNoticesEnabled
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(time.Duration(*cfg.AnnouncementSettings.NoticesFetchFrequency) * time.Second)
	return &nextTime
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	job, err := scheduler.App.Srv().Jobs.CreateJob(model.JOB_TYPE_PRODUCT_NOTICES, data)
	if err != nil {
		return nil, err
	}
	return job, nil
}
