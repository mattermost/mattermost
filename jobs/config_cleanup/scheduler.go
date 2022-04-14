// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_cleanup

import (
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const schedFreq = 6 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer, configStore *config.Store) model.Scheduler {
	isEnabled := func(_ *model.Config) bool {
		dbs := configStore.String()
		return !strings.HasPrefix(dbs, "file://")
	}

	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeCleanupOldConfigurations, schedFreq, isEnabled)
}
