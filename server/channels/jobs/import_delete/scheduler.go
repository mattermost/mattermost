// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package import_delete

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/channels/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const schedFreq = 24 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ImportSettings.Directory != "" && *cfg.ImportSettings.RetentionDays > 0
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeImportDelete, schedFreq, isEnabled)
}
