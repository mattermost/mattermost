// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package expirynotify

import (
	"time"

	"github.com/mattermost/mattermost-server/server/v7/channels/jobs"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

const schedFreq = 10 * time.Minute

func MakeScheduler(jobServer *jobs.JobServer) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.ExtendSessionLengthWithActivity
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeExpiryNotify, schedFreq, isEnabled)
}
