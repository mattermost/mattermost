// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package last_accessible_post

import (
	"strconv"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const (
	JobName = "LastAccessiblePost"
)

type AppIface interface {
	GetLastAccessiblePostTime() (int64, *model.AppError)
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface, store store.Store) model.Worker {
	isEnabled := func(cfg *model.Config) bool {
		return cfg.FeatureFlags != nil && cfg.FeatureFlags.CloudFree
	}
	execute := func(job *model.Job) error {
		createdAt, appErr := app.GetLastAccessiblePostTime()
		if appErr != nil {
			mlog.Error("Worker: Failed at GetLastAccessiblePostTime", mlog.String("worker", model.JobTypeLastAccessiblePost), mlog.String("job_id", job.Id), mlog.Err(appErr))
			return appErr
		}
		mlog.Debug("Worker: GetLastAccessiblePostTime returned: "+strconv.FormatInt(createdAt, 10), mlog.String("worker", model.JobTypeLastAccessiblePost), mlog.String("job_id", job.Id))

		err := store.System().SaveOrUpdate(&model.System{
			Name:  model.SystemLastAccessiblePostTime,
			Value: strconv.FormatInt(createdAt, 10),
		})
		if err != nil {
			mlog.Error("Worker: Failed at SaveOrUpdate", mlog.String("worker", model.JobTypeLastAccessiblePost), mlog.String("job_id", job.Id), mlog.Err(err))
			return err
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
