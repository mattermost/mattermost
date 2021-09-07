// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package fix_crt_channel_unreads

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type Scheduler struct {
	App *app.App
}

func (i *FixCRTChannelUnreadsJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{i.App}
}

func (s *Scheduler) Name() string {
	return JobName + "Scheduler"
}

func (s *Scheduler) JobType() string {
	return model.JobTypeFixChannelUnreadsForCRT
}

func (s *Scheduler) Enabled(cfg *model.Config) bool {
	if _, err := s.App.Srv().Store.System().GetByName(model.MigrationKeyFixCRTChannelUnreads); err == nil {
		return false
	}
	return true
}

func (s *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(1 * time.Minute)

	runningJobs, err := s.App.Srv().Store.Job().GetCountByStatusAndType(model.JobStatusInProgress, s.JobType())
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
	runningJobs, sErr := s.App.Srv().Store.Job().GetCountByStatusAndType(model.JobStatusInProgress, s.JobType())
	if sErr != nil {
		mlog.Error("Failed to get running jobs", mlog.Err(sErr))
	}
	if pendingJobs || runningJobs > 0 {
		return nil, nil
	}

	job, err := s.App.Srv().Jobs.CreateJob(model.JobTypeFixChannelUnreadsForCRT, map[string]string{})
	if err != nil {
		return nil, err
	}
	return job, nil
}
