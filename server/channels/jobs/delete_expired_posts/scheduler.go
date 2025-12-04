// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delete_expired_posts

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const schedFreq = 10 * time.Minute

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		return model.SafeDereference(cfg.ServiceSettings.EnableBurnOnRead)
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeDeleteExpiredPosts, schedFreq, isEnabled)
}
