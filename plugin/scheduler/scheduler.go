// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduler

import (
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const SchedFreqMinutes = 24 * 60

func MakeScheduler(jobServer *jobs.JobServer) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return true
	}
	return jobs.NewPeridicScheduler(jobServer, model.JobTypePlugins, SchedFreqMinutes, isEnabled)
}
