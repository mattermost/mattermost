// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_delete

import (
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	SchedFreqMinutes = 24 * 60
)

func (m *ExportDeleteInterfaceImpl) MakeScheduler() model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ExportSettings.Directory != "" && *cfg.ExportSettings.RetentionDays > 0
	}
	return jobs.NewPeridicScheduler(m.app.Srv().Jobs, model.JobTypeExportDelete, SchedFreqMinutes, isEnabled)
}
