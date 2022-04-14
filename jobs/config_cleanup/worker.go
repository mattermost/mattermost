// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_cleanup

import (
	"strings"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	JobName = "ConfigCleanup"
)

func MakeWorker(jobServer *jobs.JobServer, configStore *config.Store) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		dbs := configStore.String()
		return !strings.HasPrefix(dbs, "file://")
	}

	execute := func(_ *model.Job) error {
		return configStore.CleanUp()
	}

	return jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
}
