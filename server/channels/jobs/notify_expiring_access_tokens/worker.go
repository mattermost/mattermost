// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package notify_expiring_access_tokens warns the owners of personal access tokens (PATs)
// approaching expiry. "PAT" here refers to the same entity as model.UserAccessToken
// elsewhere in the codebase — the model, store, and most app-layer methods use the
// UserAccessToken name, while this job and its app-layer counterpart
// (app.NotifyPersonalAccessTokensExpiring) use the PAT/PersonalAccessToken name
// that matches the config setting and user-facing terminology.
package notify_expiring_access_tokens

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

// MakeWorker creates a worker that warns the owners of personal access tokens
// that are approaching expiry. The actual notification logic lives in the app
// layer and is passed in as notifyExpiring, mirroring the expirynotify job.
func MakeWorker(jobServer *jobs.JobServer, notifyExpiring func() error) *jobs.SimpleWorker {
	const workerName = "NotifyExpiringAccessTokens"

	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.EnableUserAccessTokens
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		return notifyExpiring()
	}
	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
