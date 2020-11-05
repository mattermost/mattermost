// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package cloud

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	SchedFreqMinutes = 2 // 1 day
)

type Scheduler struct {
	App *app.App
}

func (m *CloudJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{m.App}
}

func (scheduler *Scheduler) Name() string {
	return JobName + "Scheduler"
}

func (scheduler *Scheduler) JobType() string {
	return model.JOB_TYPE_CLOUD
}

func (scheduler *Scheduler) Enabled(cfg *model.Config) bool {
	// If CloudUserLimit is non-zero we're in a cloud installation
	return *cfg.ExperimentalSettings.CloudUserLimit > 0 && cfg.FeatureFlags.CloudEmailJobsEnabledMM29999
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(SchedFreqMinutes * time.Second)
	return &nextTime
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	if job, err := scheduler.App.Srv().Jobs.CreateJob(model.JOB_TYPE_CLOUD, data); err != nil {
		return nil, err
	} else {
		return job, nil
	}
}
