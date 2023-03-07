// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package active_users

import (
	"github.com/mattermost/mattermost-server/server/v7/channels/einterfaces"
	"github.com/mattermost/mattermost-server/server/v7/channels/jobs"
	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

const (
	JobName = "ActiveUsers"
)

func MakeWorker(jobServer *jobs.JobServer, store store.Store, getMetrics func() einterfaces.MetricsInterface) model.Worker {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.MetricsSettings.Enable
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		count, err := store.User().Count(model.UserCountOptions{IncludeDeleted: false})
		if err != nil {
			return err
		}

		if getMetrics() != nil {
			getMetrics().ObserveEnabledUsers(count)
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
