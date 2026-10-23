// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bot_events_cleanup

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const schedFreq = 10 * time.Minute

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(_ *model.Config) bool {
		return true
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeBotEventsCleanup, schedFreq, isEnabled)
}
