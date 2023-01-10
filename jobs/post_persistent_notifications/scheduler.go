// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package post_persistent_notifications

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type Scheduler struct {
	*jobs.PeriodicScheduler
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := now.Add((time.Duration(*cfg.ServiceSettings.PersistentNotificationInterval) * time.Minute) / 2)
	mlog.Info("Scheduler post_persistent_notifications time", mlog.Time("now", now), mlog.Time("nextTime", nextTime))
	return &nextTime
}

func MakeScheduler(jobServer *jobs.JobServer, license *model.License, config *model.Config) model.Scheduler {
	isEnabled := func(_ *model.Config) bool {
		l := ""
		ls := ""
		if license != nil {
			l = license.SkuShortName
			ls = license.SkuName
		}
		e := license != nil && (license.SkuShortName == model.LicenseShortSkuProfessional || license.SkuShortName == model.LicenseShortSkuEnterprise)

		mlog.Info("Scheduler post_persistent_notifications", mlog.String("shortSKU", l), mlog.String("SKU", ls), mlog.Bool("enabled", e))
		return license != nil && (license.SkuShortName == model.LicenseShortSkuProfessional || license.SkuShortName == model.LicenseShortSkuEnterprise)
	}
	return &Scheduler{PeriodicScheduler: jobs.NewPeriodicScheduler(jobServer, model.JobTypePostPersistentNotifications, 0, isEnabled)}
}
