// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package expirynotify

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/jobs"
)

const (
	JobName = "ExpiryNotify"
)

func MakeWorker(jobServer *jobs.JobServer, notifySessionsExpired func() error) model.Worker {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.ExtendSessionLengthWithActivity
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		return notifySessionsExpired()
	}
	return jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
}
