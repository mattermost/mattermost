// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package expirynotify

import (
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	JobName = "ExpiryNotify"
)

func MakeWorker(c request.CTX, jobServer *jobs.JobServer, notifySessionsExpired func(request.CTX) error) model.Worker {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.ExtendSessionLengthWithActivity
	}
	execute := func(job *model.Job) error {
		return notifySessionsExpired(c)
	}
	return jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
}
