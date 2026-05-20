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

	schedFreq := time.Duration(model.SafeDereference(jobServer.Config().ServiceSettings.BurnOnReadSchedulerFrequencySeconds)) * time.Second
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeDeleteExpiredPosts, schedFreq, isEnabled)
}
