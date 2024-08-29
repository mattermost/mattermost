// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/pkg/errors"
	"net/http"
)

const (
	getPendingScheduledPostsPageSize = 10
)

func (a *App) ProcessScheduledPosts(rctx request.CTX) {
	rctx = rctx.WithLogger(rctx.Logger().With(mlog.String("component", "scheduled_post_job")))
	rctx.Logger().Debug("ProcessScheduledPosts called...")

	beforeTime := model.GetMillis()
	lastScheduledPostId := ""

	for {
		// TODO add logic to skip posts which have been tried the max umber of allowed attempts times and amrk them as errored.
		// TODO add some delay here to not slam the database with multiple requests back after one another.
		// TODO: dont fetch posts that have an error code set
		rctx.Logger().Debug("ProcessScheduledPosts: fetching page of pending scheduled posts...")

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

		rctx.Logger().Debug("ProcessScheduledPosts: entries found in page of pending scheduled posts", mlog.Int("entries", len(scheduledPostsBatch)))
		if len(scheduledPostsBatch) == 0 {
			rctx.Logger().Debug("ProcessScheduledPosts: skipping as there are no pending scheduled")
			// break loop if there are no more scheduled posts
			return
		}

		// Saving the last item to use as marker for next page
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

		rctx.Logger().Debug("ProcessScheduledPosts: finished processing a page of pending scheduled posts.")
	}
}

func (a *App) processScheduledPostBatch(rctx request.CTX, scheduledPosts []*model.ScheduledPost) error {
	rctx.Logger().Debug("processScheduledPostBatch called...")
	var failedScheduledPosts []*model.ScheduledPost
	var successfulScheduledPostIDs []string

	for i := range scheduledPosts {
		scheduledPost, appErr := a.postScheduledPost(rctx, scheduledPosts[i])
		if appErr != nil {
			failedScheduledPosts = append(failedScheduledPosts, scheduledPost)
			continue
		}

		successfulScheduledPostIDs = append(successfulScheduledPostIDs, scheduledPost.Id)
	}

	if err := a.handleSuccessfulScheduledPosts(rctx, successfulScheduledPostIDs); err != nil {
		return errors.Wrap(err, "App.processScheduledPostBatch: failed to handle successfully posted scheduled posts")
	}

	a.handleFailedScheduledPosts(rctx, failedScheduledPosts)
	return nil
}

func (a *App) postScheduledPost(rctx request.CTX, rawScheduledPost *model.ScheduledPost) (*model.ScheduledPost, error) {
	// we'll process scheduled posts one by one.
	// If an error occurs, we'll log it and move onto the next scheduled post

	channel, appErr := a.GetChannel(rctx, rawScheduledPost.ChannelId)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			rawScheduledPost.ErrorCode = model.ScheduledPostErrorCodeChannelNotFound
		} else {
			rctx.Logger().Error(
				"App.processScheduledPostBatch: failed to get channel for scheduled post",
				mlog.String("scheduled_post_id", rawScheduledPost.Id),
				mlog.String("channel_id", rawScheduledPost.ChannelId),
				mlog.Err(appErr),
			)
		}

		return rawScheduledPost, appErr
	}

	scheduledPost, canPost, err := a.canPostScheduledPost(rctx, rawScheduledPost, channel)
	if err != nil {
		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to check if scheduled post can be posted",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.Err(err),
		)

		return scheduledPost, appErr
	}

	if !canPost {
		rctx.Logger().Warn(
			"App.processScheduledPostBatch: skipping posting a scheduled post as `can post` check failed",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.String("error_code", scheduledPost.ErrorCode),
		)

		return scheduledPost, appErr
	}

	post, err := scheduledPost.ToPost()
	if err != nil {
		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to convert scheduled post job to a post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.Err(err),
		)

		return scheduledPost, appErr
	}

	_, appErr = a.CreatePost(rctx, post, channel, true, false)
	if appErr != nil {
		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to post scheduled post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.Err(appErr),
		)

		return scheduledPost, appErr
	}

	return scheduledPost, nil
}

func (a *App) canPostScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost, channel *model.Channel) (*model.ScheduledPost, bool, error) {
	user, appErr := a.GetUser(scheduledPost.UserId)
	if appErr != nil {
		if appErr.Id == MissingAccountError {
			scheduledPost.ErrorCode = model.ScheduledPostErrorCodeUserDoesNotExist
			return scheduledPost, false, nil
		}

		rctx.Logger().Error(
			"App.canPostScheduledPost: failed to get user from database",
			mlog.String("user_id", scheduledPost.UserId),
			mlog.Err(appErr),
		)
		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, false, errors.Wrapf(appErr, "App.canPostScheduledPost: failed to get user from database, userId: %s", scheduledPost.UserId)
	}

	if user.DeleteAt != 0 {
		scheduledPost.ErrorCode = model.ScheduledPostErrorCodeUserDeleted
		return scheduledPost, false, nil
	}

	if channel.DeleteAt != 0 {
		scheduledPost.ErrorCode = model.ScheduledPostErrorCodeChannelArchived
		return scheduledPost, false, nil
	}

	_, appErr = a.GetChannelMember(rctx, scheduledPost.ChannelId, scheduledPost.UserId)
	if appErr != nil {
		if appErr.Id == MissingChannelMemberError {
			scheduledPost.ErrorCode = model.ScheduledPostErrorNoChannelMember
			return scheduledPost, false, nil
		}

		rctx.Logger().Error(
			"App.canPostScheduledPost: failed to get channel member",
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.Err(appErr),
		)
		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, false, errors.Wrapf(appErr, "App.canPostScheduledPost: failed to get user from database, userId: %s", scheduledPost.UserId)
	}

	hasPermission := a.HasPermissionToChannel(rctx, scheduledPost.UserId, scheduledPost.ChannelId, model.PermissionCreatePost)
	if !hasPermission {
		scheduledPost.ErrorCode = model.ScheduledPostErrorCodeNoChannelPermission
		return scheduledPost, false, nil
	}

	return scheduledPost, true, nil
}

func (a *App) handleSuccessfulScheduledPosts(rctx request.CTX, successfulScheduledPostIDs []string) error {
	if len(successfulScheduledPostIDs) > 0 {
		// Successfully posted scheduled posts can be safely permanently deleted as no data is lost.
		// The data is moved into the posts table.
		err := a.Srv().Store().ScheduledPost().PermanentlyDeleteScheduledPosts(successfulScheduledPostIDs)
		if err != nil {
			rctx.Logger().Error(
				"App.handleSuccessfulScheduledPosts: failed to delete successfully posted scheduled posts",
				mlog.Int("successfully_posted_count", len(successfulScheduledPostIDs)),
				mlog.Err(err),
			)
			return errors.Wrap(err, "App.handleSuccessfulScheduledPosts: failed to delete successfully posted scheduled posts")
		}
	}

	return nil
}

func (a *App) handleFailedScheduledPosts(rctx request.CTX, failedScheduledPosts []*model.ScheduledPost) {
	for _, failedScheduledPost := range failedScheduledPosts {
		if failedScheduledPost.ErrorCode == "" {
			failedScheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		}

		err := a.Srv().Store().ScheduledPost().UpdatedScheduledPost(failedScheduledPost)
		if err != nil {
			// we intentionally don't stop on error as its possible to continue updating other scheduled posts
			rctx.Logger().Error(
				"App.processScheduledPostBatch: failed to updated failed scheduled posts",
				mlog.String("scheduled_post_id", failedScheduledPost.Id),
				mlog.Err(err),
			)
		}
	}
}
