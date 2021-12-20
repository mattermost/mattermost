// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package import_delete

import (
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	SchedFreqMinutes = 24 * 60
)

func MakeScheduler(jobServer *jobs.JobServer) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ImportSettings.Directory != "" && *cfg.ImportSettings.RetentionDays > 0
	}
	return jobs.NewPeridicScheduler(jobServer, model.JobTypeImportDelete, SchedFreqMinutes, isEnabled)
}
