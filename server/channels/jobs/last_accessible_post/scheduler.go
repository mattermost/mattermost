// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package last_accessible_post

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const schedFreq = 30 * time.Minute

func MakeScheduler(jobServer *jobs.JobServer, license *model.License) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		// Enable for any license with post history limits (i.e. Entry SKU)
		enabled := license != nil && license.Limits != nil && license.Limits.PostHistory > 0
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(enabled), mlog.String("scheduler", model.JobTypeLastAccessiblePost))
		return enabled
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeLastAccessiblePost, schedFreq, isEnabled)
}
