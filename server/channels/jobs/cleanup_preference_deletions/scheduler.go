// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_preference_deletions

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const schedFreq = 24 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(_ *model.Config) bool { return true }
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeCleanupPreferenceDeletions, schedFreq, isEnabled)
}
