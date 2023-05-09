// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notify_admin

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/jobs"
)

const schedFreq = 24 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer, license *model.License, jobType string) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		enabled := license != nil && *license.Features.Cloud
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(enabled), mlog.String("scheduler", jobType))
		return enabled
	}
	return jobs.NewPeriodicScheduler(jobServer, jobType, schedFreq, isEnabled)

}
