// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package post_persistent_notifications

import (
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	JobName = "PostPersistentNotifications"
)

type AppIface interface {
	SendPersistentNotifications() error
}

func MakeWorker(jobServer *jobs.JobServer, license *model.License, app AppIface) model.Worker {
	isEnabled := func(cfg *model.Config) bool {
		// return cfg != nil && cfg.FeatureFlags != nil && cfg.FeatureFlags.PostPriority && cfg.ServiceSettings.PostPriority != nil && *cfg.ServiceSettings.PostPriority
		return true
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		return app.SendPersistentNotifications()
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
