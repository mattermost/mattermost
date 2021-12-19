// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package expirynotify

import (
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	SchedFreqMinutes = 10
)

func (m *ExpiryNotifyJobInterfaceImpl) MakeScheduler() model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.ExtendSessionLengthWithActivity
	}
	return jobs.NewPeridicScheduler(m.App.Srv().Jobs, model.JobTypeExpiryNotify, SchedFreqMinutes, isEnabled)
}
