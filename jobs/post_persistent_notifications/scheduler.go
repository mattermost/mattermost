// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package post_persistent_notifications

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

func MakeScheduler(jobServer *jobs.JobServer, config *model.Config) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		// enabled := cfg != nil && cfg.FeatureFlags != nil && cfg.FeatureFlags.PostPriority && cfg.ServiceSettings.PostPriority != nil && *cfg.ServiceSettings.PostPriority
		// mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(enabled), mlog.String("scheduler", model.JobTypePostPersistentNotifications))
		// return enabled
		return true
	}
	// schedFreq := config.ServiceSettings.PersistenceNotificationInterval / 2
	schedFreq := 30 * time.Second
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypePostPersistentNotifications, schedFreq, isEnabled)
}
