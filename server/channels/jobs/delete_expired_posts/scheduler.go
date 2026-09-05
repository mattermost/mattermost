// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delete_expired_posts

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		featureFlagEnabled := cfg.FeatureFlags.BurnOnRead
		serviceSettingEnabled := model.SafeDereference(cfg.ServiceSettings.EnableBurnOnRead)

		return featureFlagEnabled && serviceSettingEnabled
	}

	// FEATURE: Dynamic frequency interval. 
	// Instead of a static duration, this closure fetches the latest frequency 
	// from the config every time the scheduler evaluates its next run.
	getSchedFreq := func(cfg *model.Config) time.Duration {
		seconds := model.SafeDereference(cfg.ServiceSettings.BurnOnReadSchedulerFrequencySeconds)
		return time.Duration(seconds) * time.Second
	}

	return jobs.NewDynamicPeriodicScheduler(jobServer, model.JobTypeDeleteExpiredPosts, getSchedFreq, isEnabled)
}
