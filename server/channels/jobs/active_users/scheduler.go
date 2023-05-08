// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package active_users

import (
	"time"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/jobs"
)

const schedFreq = 10 * time.Minute

func MakeScheduler(jobServer *jobs.JobServer) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.MetricsSettings.Enable
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeActiveUsers, schedFreq, isEnabled)
}
