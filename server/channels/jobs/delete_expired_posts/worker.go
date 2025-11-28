// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delete_expired_posts

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type AppIface interface {
	DeletePost(rctx request.CTX, postID, deleteByID string) (*model.Post, *model.AppError)
	PermanentDeletePost(rctx request.CTX, postID, deleteByID string) *model.AppError
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store, app AppIface) *jobs.SimpleWorker {
	const workerName = "DeleteExpiredPosts"

	isEnabled := func(cfg *model.Config) bool {
		return model.SafeDereference(cfg.ServiceSettings.EnableBurnOnRead)
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		ids, err := store.TemporaryPost().GetExpiredPosts(request.EmptyContext(logger))
		if err != nil {
			return err
		}
		deletedPostIDs := make([]string, 0)
		for _, id := range ids {
			appErr := app.PermanentDeletePost(request.EmptyContext(logger), id, "")
			if appErr != nil {
				logger.Error("Failed to delete expired post", mlog.Err(appErr), mlog.String("post_id", id))
				continue
			}
			deletedPostIDs = append(deletedPostIDs, id)
		}
		if job.Data == nil {
			job.Data = make(model.StringMap)
		}
		deletedPostIDsJSON, err := json.Marshal(deletedPostIDs)
		if err != nil {
			logger.Error("Failed to marshal deleted post IDs", mlog.Err(err))
			return err
		}
		job.Data["deleted_post_ids"] = string(deletedPostIDsJSON)
		return nil
	}
	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
