// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package expirynotify

import (
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	JobName = "ExpiryNotify"
)

type AppIface interface {
	NotifySessionsExpired(request.CTX) error
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) model.Worker {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.ExtendSessionLengthWithActivity
	}
	execute := func(job *model.Job) error {
		return app.NotifySessionsExpired(request.EmptyContext(app.Log()))
	}
	return jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
}
