// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_expired_access_tokens

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const schedFreq = 1 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.EnableUserAccessTokens
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeCleanupExpiredAccessTokens, schedFreq, isEnabled)
}
