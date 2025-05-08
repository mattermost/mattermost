// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package user_deletion

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const jobName = "UserDeletion"

type AppIface interface {
	GetUser(userID string) (*model.User, *model.AppError)
	PermanentDeleteUser(rctx request.CTX, user *model.User) *model.AppError
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return true // Enabled for all configurations
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		// Extract user ID from job data
		userId := job.Data["user_id"]
		if userId == "" {
			return errors.New("user_id missing from job data")
		}

		// Get user
		user, appErr := app.GetUser(userId)
		if appErr != nil {
			return fmt.Errorf("failed to get user %s: %v", userId, appErr)
		}

		rctx := request.EmptyContext(logger)

		// Perform the actual user deletion
		appErr = app.PermanentDeleteUser(rctx, user)
		if appErr != nil {
			return fmt.Errorf("failed to permanently delete user %s: %v", userId, appErr)
		}
		return nil
	}

	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
