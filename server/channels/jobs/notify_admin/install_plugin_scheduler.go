// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notify_admin

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/jobs"
	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
)

const installPluginSchedFreq = 1 * time.Minute

func MakeInstallPluginScheduler(jobServer *jobs.JobServer, license *model.License, jobType string) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		enabled := jobType == model.JobTypeInstallPluginNotifyAdmin
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(enabled), mlog.String("scheduler", jobType))
		return enabled
	}
	return jobs.NewPeriodicScheduler(jobServer, jobType, installPluginSchedFreq, isEnabled)

}
