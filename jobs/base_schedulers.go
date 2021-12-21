// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
)

type PeriodicScheduler struct {
	jobs        *JobServer
	minutes     int
	jobType     string
	enabledFunc func(cfg *model.Config) bool
}

func NewPeridicScheduler(jobs *JobServer, jobType string, minutes int, enabledFunc func(cfg *model.Config) bool) *PeriodicScheduler {
	return &PeriodicScheduler{
		minutes:     minutes,
		jobType:     jobType,
		enabledFunc: enabledFunc,
		jobs:        jobs,
	}
}

func (scheduler *PeriodicScheduler) Enabled(cfg *model.Config) bool {
	return scheduler.enabledFunc(cfg)
}

func (scheduler *PeriodicScheduler) NextScheduleTime(_ *model.Config, _ time.Time, _ bool, _ *model.Job) *time.Time {
	nextTime := time.Now().Add(time.Duration(scheduler.minutes) * time.Minute)
	return &nextTime
}

func (scheduler *PeriodicScheduler) ScheduleJob(_ *model.Config, _ bool, _ *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	job, err := scheduler.jobs.CreateJob(scheduler.jobType, data)
	if err != nil {
		return nil, err
	}
	return job, nil
}
