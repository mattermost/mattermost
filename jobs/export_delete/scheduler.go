// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_delete

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	jobName        = "ExportDelete"
	schedFrequency = 24 * time.Hour
)

type Scheduler struct {
	app *app.App
}

func (i *ExportDeleteInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{i.app}
}

func (scheduler *Scheduler) Name() string {
	return jobName + "Scheduler"
}

func (scheduler *Scheduler) JobType() string {
	return model.JOB_TYPE_EXPORT_DELETE
}

func (scheduler *Scheduler) Enabled(cfg *model.Config) bool {
	return *cfg.ExportSettings.Directory != "" && *cfg.ExportSettings.RetentionDays > 0
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(schedFrequency)
	return &nextTime
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	job, err := scheduler.app.Srv().Jobs.CreateJob(model.JOB_TYPE_EXPORT_DELETE, data)
	if err != nil {
		return nil, err
	}
	return job, nil
}
