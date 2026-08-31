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
	interval := (time.Duration(*cfg.ServiceSettings.PersistentNotificationIntervalMinutes) * time.Minute) / 2
	// Cap at 30s: half the minimum selectable per-post interval (1 min).
	// Without this, a 5-min global default would make the scheduler wake every 2.5 min,
	// causing posts with a 1-min per-post interval to fire late.
	const maxInterval = 30 * time.Second
	if interval > maxInterval {
		interval = maxInterval
	}
	nextTime := time.Now().Add(interval)
	return &nextTime
}

func MakeScheduler(jobServer *jobs.JobServer, licenseFunc func() *model.License) *Scheduler {
	enabledFunc := func(_ *model.Config) bool {
		return model.MinimumProfessionalLicense(licenseFunc())
	}
	return &Scheduler{jobs.NewPeriodicScheduler(jobServer, model.JobTypePostPersistentNotifications, 0, enabledFunc)}
}
