// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delete_expired_posts

import (
	"encoding/json"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	expiredPostsBatchSize        = 100
	expiredPostsJobBatchWaitTime = 100 * time.Millisecond
)

type AppIface interface {
	DeletePost(rctx request.CTX, postID, deleteByID string) (*model.Post, *model.AppError)
	PermanentDeletePostDataRetainStub(rctx request.CTX, post *model.Post, deleteByID string) *model.AppError
	GetSinglePost(rctx request.CTX, postID string, includeDeleted bool) (*model.Post, *model.AppError)
	GetPostsByIds(postIDs []string) ([]*model.Post, int64, *model.AppError)
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store, app AppIface) *jobs.SimpleWorker {
	const workerName = "DeleteExpiredPosts"

	isEnabled := func(cfg *model.Config) bool {
		return model.SafeDereference(cfg.ServiceSettings.EnableBurnOnRead)
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		if job.Data == nil {
			job.Data = make(model.StringMap)
		}

		deletedPostIDs := make([]string, 0)
		lastPostId := ""
		for {
			time.Sleep(expiredPostsJobBatchWaitTime)
			postIDs, err := store.TemporaryPost().GetExpiredPosts(request.EmptyContext(logger), lastPostId, expiredPostsBatchSize)
			if err != nil {
				return err
			}

			if len(postIDs) == 0 {
				break
			}

			lastPostId = postIDs[len(postIDs)-1]

			expiredPosts, _, appErr := app.GetPostsByIds(postIDs)
			if appErr != nil {
				logger.Error("Failed to get expired posts by IDs", mlog.Err(appErr))
				return appErr
			}

			for _, post := range expiredPosts {
				appErr = app.PermanentDeletePostDataRetainStub(request.EmptyContext(logger), post, "")
				if appErr != nil {
					logger.Error("Failed to delete expired post", mlog.Err(appErr), mlog.String("post_id", post.Id))
					continue
				}
				deletedPostIDs = append(deletedPostIDs, post.Id)
			}
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
