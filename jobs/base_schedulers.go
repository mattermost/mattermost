// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"crypto/rand"
	"math/big"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
)

type PeriodicScheduler struct {
	jobs        *JobServer
	period      time.Duration
	jobType     string
	enabledFunc func(cfg *model.Config) bool
}

func NewPeriodicScheduler(jobs *JobServer, jobType string, period time.Duration, enabledFunc func(cfg *model.Config) bool) *PeriodicScheduler {
	return &PeriodicScheduler{
		period:      period,
		jobType:     jobType,
		enabledFunc: enabledFunc,
		jobs:        jobs,
	}
}

func (scheduler *PeriodicScheduler) Enabled(cfg *model.Config) bool {
	return scheduler.enabledFunc(cfg)
}

func (scheduler *PeriodicScheduler) NextScheduleTime(_ *model.Config, _ time.Time /* pendingJobs */, _ bool /* lastSuccessfulJob */, _ *model.Job) *time.Time {
	nextTime := time.Now().Add(getRandomDelay(jitterRange)).Add(scheduler.period)
	return &nextTime
}

func (scheduler *PeriodicScheduler) ScheduleJob(_ *model.Config /* pendingJobs */, _ bool /* lastSuccessfulJob */, _ *model.Job) (*model.Job, *model.AppError) {
	return scheduler.jobs.CreateJob(scheduler.jobType, nil)
}

type DailyScheduler struct {
	jobs          *JobServer
	startTimeFunc func(cfg *model.Config) *time.Time
	jobType       string
	enabledFunc   func(cfg *model.Config) bool
}

func NewDailyScheduler(jobs *JobServer, jobType string, startTimeFunc func(cfg *model.Config) *time.Time, enabledFunc func(cfg *model.Config) bool) *DailyScheduler {
	return &DailyScheduler{
		startTimeFunc: startTimeFunc,
		jobType:       jobType,
		enabledFunc:   enabledFunc,
		jobs:          jobs,
	}
}

func (scheduler *DailyScheduler) Enabled(cfg *model.Config) bool {
	return scheduler.enabledFunc(cfg)
}

func (scheduler *DailyScheduler) NextScheduleTime(cfg *model.Config, now time.Time /* pendingJobs */, _ bool /* lastSuccessfulJob */, _ *model.Job) *time.Time {
	scheduledTime := scheduler.startTimeFunc(cfg)
	if scheduledTime == nil {
		return nil
	}

	return GenerateNextStartDateTime(now, *scheduledTime)
}

func (scheduler *DailyScheduler) ScheduleJob(_ *model.Config /* pendingJobs */, _ bool /* lastSuccessfulJob */, _ *model.Job) (*model.Job, *model.AppError) {
	return scheduler.jobs.CreateJob(scheduler.jobType, nil)
}

const jitterRange = 2000 // milliseconds

func getRandomDelay(limit int64) time.Duration {
	num, err := rand.Int(rand.Reader, big.NewInt(limit))
	if err != nil {
		return time.Millisecond
	}
	return time.Millisecond*time.Duration(num.Int64())
}