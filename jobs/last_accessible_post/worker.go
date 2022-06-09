// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package last_accessible_post

import (
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	JobName = "LastAccessiblePost"
)

type AppIface interface {
	GetLastAccessiblePostTime(useCache bool) (int64, *model.AppError)
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) model.Worker {
	isEnabled := func(cfg *model.Config) bool {
		return cfg.FeatureFlags != nil && cfg.FeatureFlags.CloudFree
	}
	execute := func(job *model.Job) error {
		_, appErr := app.GetLastAccessiblePostTime(false)
		if appErr != nil {
			mlog.Error("Worker: Failed at GetLastAccessiblePostTime", mlog.String("worker", model.JobTypeLastAccessiblePost), mlog.String("job_id", job.Id), mlog.Err(appErr))
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
