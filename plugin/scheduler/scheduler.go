// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduler

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const pluginsJobInterval = 24 * 60 * 60 * time.Second

type Scheduler struct {
	App *app.App
}

func (m *PluginsJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{m.App}
}

func (scheduler *Scheduler) Name() string {
	return "PluginsScheduler"
}

func (scheduler *Scheduler) JobType() string {
	return model.JOB_TYPE_PLUGINS
}

func (scheduler *Scheduler) Enabled(cfg *model.Config) bool {
	return true
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(pluginsJobInterval)
	return &nextTime
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	mlog.Debug("Scheduling Job", mlog.String("scheduler", scheduler.Name()))

	job, err := scheduler.App.Srv.Jobs.CreateJob(model.JOB_TYPE_PLUGINS, nil)
	if err != nil {
		return nil, err
	}

	return job, nil
}
