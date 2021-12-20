// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package fix_crt_channel_unreads

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

type Scheduler struct {
	jobServer *jobs.JobServer
	store     store.Store
}

func MakeScheduler(jobServer *jobs.JobServer, store store.Store) model.Scheduler {
	return &Scheduler{jobServer, store}
}

func (s *Scheduler) Enabled(cfg *model.Config) bool {
	if _, err := s.store.System().GetByName(model.MigrationKeyFixCRTChannelUnreads); err == nil {
		return false
	}
	return true
}

func (s *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(1 * time.Minute)

	runningJobs, err := s.store.Job().GetCountByStatusAndType(model.JobStatusInProgress, model.JobTypeFixChannelUnreadsForCRT)
	if err != nil {
		mlog.Error("Failed to get running jobs", mlog.Err(err))
		runningJobs = 1
	}
	// if we have have pending or running jobs then schedule later
	if pendingJobs || runningJobs > 0 {
		nextTime = time.Now().Add(30 * time.Minute)
	}
	return &nextTime
}

func (s *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	// if we have pending or running jobs then don't create a job
	runningJobs, sErr := s.store.Job().GetCountByStatusAndType(model.JobStatusInProgress, model.JobTypeFixChannelUnreadsForCRT)
	if sErr != nil {
		mlog.Error("Failed to get running jobs", mlog.Err(sErr))
	}
	if pendingJobs || runningJobs > 0 {
		return nil, nil
	}

	job, err := s.jobServer.CreateJob(model.JobTypeFixChannelUnreadsForCRT, map[string]string{})
	if err != nil {
		return nil, err
	}
	return job, nil
}
