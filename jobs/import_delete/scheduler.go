// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package import_delete

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	jobName        = "ImportDelete"
	schedFrequency = 24 * time.Hour
)

type Scheduler struct {
	app *app.App
}

func (i *ImportDeleteInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{i.app}
}

func (scheduler *Scheduler) Name() string {
	return jobName + "Scheduler"
}

func (scheduler *Scheduler) JobType() string {
	return model.JobTypeImportDelete
}

func (scheduler *Scheduler) Enabled(cfg *model.Config) bool {
	return *cfg.ImportSettings.Directory != "" && *cfg.ImportSettings.RetentionDays > 0
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(schedFrequency)
	return &nextTime
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	job, err := scheduler.app.Srv().Jobs.CreateJob(model.JobTypeImportDelete, data)
	if err != nil {
		return nil, err
	}
	return job, nil
}
