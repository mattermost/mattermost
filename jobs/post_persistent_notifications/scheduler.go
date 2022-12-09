// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package post_persistent_notifications

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

func MakeScheduler(jobServer *jobs.JobServer, license *model.License, config *model.Config) model.Scheduler {
	isEnabled := func(_ *model.Config) bool {
		return license != nil && (license.SkuShortName == model.LicenseShortSkuProfessional || license.SkuShortName == model.LicenseShortSkuEnterprise)
	}
	schedFreq := (time.Duration(*config.ServiceSettings.PersistentNotificationInterval) * time.Minute) / 2
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypePostPersistentNotifications, schedFreq, isEnabled)
}
