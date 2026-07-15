// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pat_expiry_notify

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

// MakeWorker creates a worker that warns the owners of personal access tokens
// that are approaching expiry. The actual notification logic lives in the app
// layer and is passed in as notifyExpiring, mirroring the expirynotify job.
func MakeWorker(jobServer *jobs.JobServer, notifyExpiring func() error) *jobs.SimpleWorker {
	const workerName = "PatExpiryNotify"

	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.EnableUserAccessTokens
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		return notifyExpiring()
	}
	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
