// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package health_check

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const workerName = "HealthCheck"

func MakeWorker(jobServer *jobs.JobServer, runHealthCheck func(rctx request.CTX) error) *jobs.SimpleWorker {
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		return runHealthCheck(request.EmptyContext(logger))
	}
	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}

// MakeWorkers returns a worker set holding only the health-check worker, with its own watcher
// that polls only pending health_check jobs, and only while the worker is enabled.
func MakeWorkers(jobServer *jobs.JobServer, configService configservice.ConfigService, worker model.Worker) *jobs.Workers {
	workers := jobs.NewWorkers(configService)
	workers.AddWorker(model.JobTypeHealthCheck, worker)
	workers.Watcher = jobServer.MakeJobTypeWatcher(workers, jobs.DefaultWatcherPollingInterval, model.JobTypeHealthCheck)
	return workers
}
