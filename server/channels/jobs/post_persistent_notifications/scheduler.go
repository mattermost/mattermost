// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package post_persistent_notifications

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type Scheduler struct {
	*jobs.PeriodicScheduler
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, _ time.Time, _ bool, _ *model.Job) *time.Time {
	nextTime := time.Now().Add((time.Duration(*cfg.ServiceSettings.PersistentNotificationIntervalMinutes) * time.Minute) / 2)
	return &nextTime
}

func MakeScheduler(jobServer *jobs.JobServer, licenseFunc func() *model.License) *Scheduler {
	enabledFunc := func(_ *model.Config) bool {
		return model.MinimumProfessionalLicense(licenseFunc())
	}
	return &Scheduler{jobs.NewPeriodicScheduler(jobServer, model.JobTypePostPersistentNotifications, 0, enabledFunc)}
}
