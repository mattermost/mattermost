// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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
	return scheduler.jobs.CreateJob(scheduler.jobType, nil)
}

type DailyScheduler struct {
	jobs        *JobServer
	timeConfig  func(cfg *model.Config) string
	jobType     string
	enabledFunc func(cfg *model.Config) bool
}

func NewDailyScheduler(jobs *JobServer, jobType string, timeConfig func(cfg *model.Config) string, enabledFunc func(cfg *model.Config) bool) *DailyScheduler {
	return &DailyScheduler{
		timeConfig:  timeConfig,
		jobType:     jobType,
		enabledFunc: enabledFunc,
		jobs:        jobs,
	}
}

func (scheduler *DailyScheduler) Enabled(cfg *model.Config) bool {
	return scheduler.enabledFunc(cfg)
}

func (scheduler *DailyScheduler) NextScheduleTime(cfg *model.Config, now time.Time, _ bool, _ *model.Job) *time.Time {
	parsedTime, err := time.Parse("15:04", scheduler.timeConfig(cfg))
	if err != nil {
		mlog.Error("Cannot determine next schedule time for message export job. DailyRunTime config value is invalid.")
		return nil
	}

	return GenerateNextStartDateTime(now, parsedTime)
}

func (scheduler *DailyScheduler) ScheduleJob(_ *model.Config, _ bool, _ *model.Job) (*model.Job, *model.AppError) {
	return scheduler.jobs.CreateJob(scheduler.jobType, nil)
}
