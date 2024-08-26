// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	getPendingScheduledPostsPageSize = 100
)

func (a *App) ProcessScheduledPosts(rctx request.CTX) {
	rctx = rctx.WithLogger(rctx.Logger().With(mlog.String("component", "scheduled_post_job")))
	rctx.Logger().Info("ProcessScheduledPosts called...")

	now := model.GetMillis()
	lastScheduledPostId := ""

	for {
		// TODO add logic to skip postys which have been tried the max umber of allowed attempts times and amrk them as errored.
		scheduledPostsBatch, err := a.Srv().Store().ScheduledPost().GetScheduledPosts(now, lastScheduledPostId, getPendingScheduledPostsPageSize)
		if err != nil {
			rctx.Logger().Error(
				"ProcessScheduledPosts: failed to fetch pending scheduled posts page from database",
				mlog.Int("now", now),
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

		if appErr := a.processScheduledPostBatch(rctx, scheduledPostsBatch); appErr != nil {
			rctx.Logger().Error(
				"ProcessScheduledPosts: failed to process scheduled posts batch",
				mlog.Int("now", now),
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

func (a *App) processScheduledPostBatch(rctx request.CTX, scheduledPosts []*model.ScheduledPost) *model.AppError {
	for _, scheduledPost := range scheduledPosts {

	}
}
