// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/pkg/errors"
)

const (
	getPendingScheduledPostsPageSize = 10
)

func (a *App) ProcessScheduledPosts(rctx request.CTX) {
	rctx = rctx.WithLogger(rctx.Logger().With(mlog.String("component", "scheduled_post_job")))
	rctx.Logger().Info("ProcessScheduledPosts called...")

	beforeTime := model.GetMillis()
	lastScheduledPostId := ""

	for {
		// TODO add logic to skip posts which have been tried the max umber of allowed attempts times and amrk them as errored.

		// TODO add some delay here to not slam the database with multiple requests back after one another.
		scheduledPostsBatch, err := a.Srv().Store().ScheduledPost().GetScheduledPosts(beforeTime, lastScheduledPostId, getPendingScheduledPostsPageSize)
		if err != nil {
			rctx.Logger().Error(
				"App.ProcessScheduledPosts: failed to fetch pending scheduled posts page from database",
				mlog.Int("before_time", beforeTime),
				mlog.String("last_scheduled_post_id", lastScheduledPostId),
				mlog.Int("items_per_page", getPendingScheduledPostsPageSize),
				mlog.Err(err),
			)

			// break the loop if we can't fetch the page.
			// Missed posts will be processed in job's next round
			return
		}

		if len(scheduledPostsBatch) == 0 {
			// break loop if there are no more scheduled posts
			return
		}

		// Saving the last item
		lastScheduledPostId = scheduledPostsBatch[len(scheduledPostsBatch)-1].Id
		beforeTime = scheduledPostsBatch[len(scheduledPostsBatch)-1].ScheduledAt

		if appErr := a.processScheduledPostBatch(rctx, scheduledPostsBatch); appErr != nil {
			rctx.Logger().Error(
				"App.ProcessScheduledPosts: failed to process scheduled posts batch",
				mlog.Int("before_time", beforeTime),
				mlog.String("last_scheduled_post_id", lastScheduledPostId),
				mlog.Int("items_per_page", getPendingScheduledPostsPageSize),
				mlog.Err(appErr),
			)

			// failure to process one batch doesn't mean other batches will fail as well.
			// Continue processing next batch. The posts that failed in this batch will be picked
			// up when the job runs next.
			continue
		}
	}
}

func (a *App) processScheduledPostBatch(rctx request.CTX, scheduledPosts []*model.ScheduledPost) error {
	var failedScheduledPostIDs []string
	var successfulScheduledPostIDs []string

	for _, scheduledPost := range scheduledPosts {
		// we'll process scheduled posts one by one.
		// If an error occurs, we'll log it and move onto the next scheduled post

		post, err := scheduledPost.ToPost()
		if err != nil {
			rctx.Logger().Error("App.processScheduledPostBatch: failed to convert scheduled post job to a post", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.Err(err))

			failedScheduledPostIDs = append(failedScheduledPostIDs, scheduledPost.Id)
			continue
		}

		channel, appErr := a.GetChannel(rctx, post.ChannelId)
		if appErr != nil {
			rctx.Logger().Error("App.processScheduledPostBatch: failed to get channel for scheduled post", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.String("channel_id", scheduledPost.ChannelId), mlog.Err(appErr))

			failedScheduledPostIDs = append(failedScheduledPostIDs, scheduledPost.Id)
			continue
		}

		_, appErr = a.CreatePost(rctx, post, channel, true, false)
		if appErr != nil {
			rctx.Logger().Error("App.processScheduledPostBatch: failed to post scheduled post", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.String("channel_id", scheduledPost.ChannelId), mlog.Err(appErr))

			failedScheduledPostIDs = append(failedScheduledPostIDs, scheduledPost.Id)
			continue
		}

		successfulScheduledPostIDs = append(successfulScheduledPostIDs, scheduledPost.Id)
	}

	if len(successfulScheduledPostIDs) > 0 {
		err := a.Srv().Store().ScheduledPost().PermanentlyDeleteScheduledPosts(successfulScheduledPostIDs)
		if err != nil {
			rctx.Logger().Error("App.processScheduledPostBatch: failed to delete successfully posted scheduled posts", mlog.Int("successfully_posted_count", len(successfulScheduledPostIDs)), mlog.Err(err))
			return errors.Wrap(err, "App.processScheduledPostBatch: failed to delete successfully posted scheduled posts")
		}
	}

	return nil
}
