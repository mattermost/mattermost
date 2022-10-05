// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_delete

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const schedFreq = 24 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ExportSettings.Directory != "" && *cfg.ExportSettings.RetentionDays > 0
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeExportDelete, schedFreq, isEnabled)
}
