// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package refresh_post_stats

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const jobName = "RefreshPostStats"

func MakeWorker(jobServer *jobs.JobServer, sqlDriverName string) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return sqlDriverName == model.DatabaseDriverPostgres
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		return jobServer.Store.User().RefreshPostStatsForUsers()
	}
	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
