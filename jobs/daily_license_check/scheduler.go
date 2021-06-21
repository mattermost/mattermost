// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package daily_license_check

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const DailyLicenseCheckJob = "DailyLicenseCheckJob"

type DailyLicenseCheckScheduler struct {
	App *app.App
}

func (dlc *DailyLicenseCheckJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &DailyLicenseCheckScheduler{dlc.App}
}

func (s *DailyLicenseCheckScheduler) Name() string {
	return DailyLicenseCheckJob + "Scheduler"
}

func (s *DailyLicenseCheckScheduler) JobType() string {
	return model.JOB_TYPE_DAILY_LICENSE_CHECK
}

func (s *DailyLicenseCheckScheduler) Enabled(cfg *model.Config) bool {
	return true
}

func (s *DailyLicenseCheckScheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	t := time.Now().Add(23 * time.Hour)
	return &t
}

func (s *DailyLicenseCheckScheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	job, err := s.App.Srv().Jobs.CreateJob(model.JOB_TYPE_DAILY_LICENSE_CHECK, data)
	if err != nil {
		return nil, err
	}
	return job, nil
}
