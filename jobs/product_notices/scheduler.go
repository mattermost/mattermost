// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product_notices

import (
	"github.com/mattermost/mattermost-server/v5/mlog"
	"strconv"
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
	freq, err := strconv.ParseInt(app.NOTICES_JSON_FETCH_FREQUENCY_SECONDS, 10, 32)
	if err != nil {
		mlog.Debug("Invalid NOTICES_JSON_FETCH_FREQUENCY_SECONDS variable provided!", mlog.String("value", app.NOTICES_JSON_FETCH_FREQUENCY_SECONDS))
		freq = 3600
	}
	nextTime := time.Now().Add(time.Duration(freq) * time.Second)
	return &nextTime
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	if job, err := scheduler.App.Srv().Jobs.CreateJob(model.JOB_TYPE_PRODUCT_NOTICES, data); err != nil {
		return nil, err
	} else {
		return job, nil
	}
}
