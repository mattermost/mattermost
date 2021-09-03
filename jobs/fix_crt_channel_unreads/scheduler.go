// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package fix_crt_channel_unreads

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
)

type Scheduler struct {
	App *app.App
}

func (ji *FixCRTChannelUnreadsJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{ji.App}
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
	nextTime := time.Now().Add(30 * time.Minute)

	// if we have don't have pending jobs then schedule earlier
	if !pendingJobs {
		nextTime = time.Now().Add(5 * time.Minute)
	}
	return &nextTime
}

func (s *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	// if we have pending jobs then don't create a job
	if pendingJobs {
		return nil, nil
	}

	job, err := s.App.Srv().Jobs.CreateJob(model.JobTypeFixChannelUnreadsForCRT, map[string]string{})
	if err != nil {
		return nil, err
	}
	return job, nil
}
