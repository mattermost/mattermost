// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package last_accessible_post

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type AppIface interface {
	ComputeLastAccessiblePostTime() error
}

func MakeWorker(jobServer *jobs.JobServer, license *model.License, app AppIface) *jobs.SimpleWorker {
	const workerName = "LastAccessiblePost"

	isEnabled := func(_ *model.Config) bool {
		// Enable for any license with post history limits (i.e. Entry SKU)
		return license != nil && license.Limits != nil && license.Limits.PostHistory > 0
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		return app.ComputeLastAccessiblePostTime()
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
