// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_desktop_tokens

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/configservice"
)

const jobName = "CleanupDesktopTokens"
const maxAge = 5 * time.Minute

type AppIface interface {
	configservice.ConfigService
	ListDirectory(path string) ([]string, *model.AppError)
	FileModTime(path string) (time.Time, *model.AppError)
	RemoveFile(path string) *model.AppError
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return true
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		return store.DesktopTokens().DeleteOlderThan(time.Now().Add(-maxAge).Unix())
	}
	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
