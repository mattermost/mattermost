// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package expirynotify

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	FREQ_MINUTES = 1 // TODO: 60 minutes
)

type Scheduler struct {
	App *app.App
}

func (m *ExpiryNotifyJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{m.App}
}

func (scheduler *Scheduler) Name() string {
	return "NotifyExpiryScheduler"
}

func (scheduler *Scheduler) JobType() string {
	return model.JOB_TYPE_EXPIRY_NOTIFY
}

func (scheduler *Scheduler) Enabled(cfg *model.Config) bool {
	return true
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {

	nextTime := time.Now().Add(FREQ_MINUTES * time.Minute)
	return &nextTime
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	if job, err := scheduler.App.Srv().Jobs.CreateJob(model.JOB_TYPE_EXPIRY_NOTIFY, data); err != nil {
		return nil, err
	} else {
		return job, nil
	}
}
