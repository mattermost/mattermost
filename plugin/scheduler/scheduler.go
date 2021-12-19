// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduler

import (
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const SchedFreqMinutes = 24 * 60

type Scheduler struct {
	App *app.App
}

func (m *PluginsJobInterfaceImpl) MakeScheduler() model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return true
	}
	return jobs.NewPeridicScheduler(m.App.Srv().Jobs, model.JobTypePlugins, SchedFreqMinutes, isEnabled)
}
