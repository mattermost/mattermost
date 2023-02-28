// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package last_accessible_file

import (
	"github.com/mattermost/mattermost-server/v6/channels/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	JobName = "LastAccessibleFile"
)

type AppIface interface {
	ComputeLastAccessibleFileTime() error
}

func MakeWorker(jobServer *jobs.JobServer, license *model.License, app AppIface) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		return license != nil && *license.Features.Cloud
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		return app.ComputeLastAccessibleFileTime()
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
