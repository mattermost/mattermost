// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package merge_users

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type AppIface interface {
	configservice.ConfigService
	MergeUsers(ctx request.CTX, job *model.Job, opts model.UserMergeOpts) *model.AppError
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "MergeUsers"

	isEnabled := func(cfg *model.Config) bool { return true }
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		fromUserID, ok := job.Data["from_user_id"]
		if !ok {
			return model.NewAppError("MergeUserWorker", "merge_user.worker.do_job.missing_from_user_id", nil, "", http.StatusBadRequest)
		}

		toUserID, ok := job.Data["to_user_id"]
		if !ok {
			return model.NewAppError("MergeUserWorker", "merge_user.worker.do_job.missing_to_user_id", nil, "", http.StatusBadRequest)
		}

		opts := model.UserMergeOpts{
			FromUserId: fromUserID,
			ToUserId:   toUserID,
		}

		appErr := app.MergeUsers(request.EmptyContext(logger), job, opts)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
