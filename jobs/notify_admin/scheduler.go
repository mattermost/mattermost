// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notify_admin

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"

	"github.com/mattermost/mattermost-server/v6/jobs"
)

const schedFreq = 1 * time.Minute

func MakeScheduler(jobServer *jobs.JobServer, license *model.License, jobType string) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		enabled := license != nil && *license.Features.Cloud
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(enabled), mlog.String("scheduler", jobType))
		return true // testing for self-hosted. undo afterwards
	}
	return jobs.NewPeriodicScheduler(jobServer, jobType, schedFreq, isEnabled)
}
