// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package post_persistent_notifications

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type AppIface interface {
	SendPersistentNotifications() error
	IsPersistentNotificationsEnabled() bool
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) model.Worker {
	const workerName = "PostPersistentNotifications"

	isEnabled := func(_ *model.Config) bool {
		return app.IsPersistentNotificationsEnabled()
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)
		return app.SendPersistentNotifications()
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
