// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package health_check

import (
	"github.com/mattermost/mattermost/server/public/model"
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
// that polls only pending health_check jobs, and only while the worker is enabled and the server
// has a Professional license. The license gates the polling, not the worker: the framework only
// starts and stops workers on config changes, so a license added later would find no worker
// running.
func MakeWorkers(jobServer *jobs.JobServer, worker model.Worker, licenseFunc func() *model.License) *jobs.Workers {
	workers := jobs.NewWorkers(jobServer.ConfigService)
	workers.AddWorker(model.JobTypeHealthCheck, worker)
	workers.Watcher = jobServer.MakeJobTypeWatcher(workers, jobs.DefaultWatcherPollingInterval, model.JobTypeHealthCheck, func() bool {
		return model.MinimumProfessionalLicense(licenseFunc())
	})
	return workers
}
