// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/pkg/errors"
)

const (
	getPendingScheduledPostsPageSize = 10
	scheduledPostBatchWaitTime       = 1 * time.Second
)

func (a *App) ProcessScheduledPosts(rctx request.CTX) {
	rctx = rctx.WithLogger(rctx.Logger().With(mlog.String("component", "scheduled_post_job")))
	rctx.Logger().Debug("ProcessScheduledPosts called...")

	if !*a.Config().ServiceSettings.ScheduledPosts {
		rctx.Logger().Debug("ProcessScheduledPosts exiting as the feature is turned off via ServiceSettings.ScheduledPosts setting...")
		return
	}

	beforeTime := model.GetMillis()
	lastScheduledPostId := ""

	for {
		// we wait some time before processing each batch to avoid hammering the database with too many requests.
		time.Sleep(scheduledPostBatchWaitTime)
		rctx.Logger().Debug("ProcessScheduledPosts: fetching page of pending scheduled posts...")

		scheduledPostsBatch, err := a.Srv().Store().ScheduledPost().GetPendingScheduledPosts(beforeTime, lastScheduledPostId, getPendingScheduledPostsPageSize)
		if err != nil {
			rctx.Logger().Error(
				"App.ProcessScheduledPosts: failed to fetch pending scheduled posts page from database",
				mlog.Int("before_time", beforeTime),
				mlog.String("last_scheduled_post_id", lastScheduledPostId),
				mlog.Int("items_per_page", getPendingScheduledPostsPageSize),
				mlog.Err(err),
			)

			// Break the loop if we can't fetch the page.
			// Missed posts will be processed in job's next round.
			// Since we don't know any item's details, we can't fetch the next page as well.
			// We could retry here but that's the same as trying in job's next round.
			break
		}

		rctx.Logger().Debug("ProcessScheduledPosts: entries found in page of pending scheduled posts", mlog.Int("entries", len(scheduledPostsBatch)))
		if len(scheduledPostsBatch) == 0 {
			rctx.Logger().Debug("ProcessScheduledPosts: skipping as there are no pending scheduled")
			// break loop if there are no more scheduled posts
			break
		}

		// Saving the last item to use as marker for next page
		lastScheduledPostId = scheduledPostsBatch[len(scheduledPostsBatch)-1].Id
		beforeTime = scheduledPostsBatch[len(scheduledPostsBatch)-1].ScheduledAt

		if err := a.processScheduledPostBatch(rctx, scheduledPostsBatch); err != nil {
			rctx.Logger().Error(
				"App.ProcessScheduledPosts: failed to process scheduled posts batch",
				mlog.Int("before_time", beforeTime),
				mlog.String("last_scheduled_post_id", lastScheduledPostId),
				mlog.Int("items_per_page", getPendingScheduledPostsPageSize),
				mlog.Err(err),
			)

			// failure to process one batch doesn't mean other batches will fail as well.
			// Continue processing next batch. The posts that failed in this batch will be picked
			// up when the job next runs.
			continue
		}

		rctx.Logger().Debug("ProcessScheduledPosts: finished processing a page of pending scheduled posts.")

		if len(scheduledPostsBatch) < getPendingScheduledPostsPageSize {
			// if we got less than page size worth of scheduled posts, it indicates
			// that we have no more pending scheduled posts. So, we can break instead of making
			// an additional database call as we know there are going to be no records in there.
			break
		}
	}
}

// processScheduledPostBatch processes one batch
func (a *App) processScheduledPostBatch(rctx request.CTX, scheduledPosts []*model.ScheduledPost) error {
	rctx.Logger().Debug("processScheduledPostBatch called...")
	var failedScheduledPosts []*model.ScheduledPost
	var successfulScheduledPostIDs []string

	for i := range scheduledPosts {
		scheduledPost, err := a.postScheduledPost(rctx, scheduledPosts[i])
		if err != nil {
			failedScheduledPosts = append(failedScheduledPosts, scheduledPost)
			continue
		}

		successfulScheduledPostIDs = append(successfulScheduledPostIDs, scheduledPost.Id)
	}

	if err := a.handleSuccessfulScheduledPosts(rctx, successfulScheduledPostIDs); err != nil {
		return errors.Wrap(err, "App.processScheduledPostBatch: failed to handle successfully posted scheduled posts")
	}

	a.handleFailedScheduledPosts(rctx, failedScheduledPosts)
	rctx.Logger().Debug("processScheduledPostBatch finished...")
	return nil
}

// postScheduledPost processes an individual scheduled post
func (a *App) postScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, error) {
	// we'll process scheduled posts one by one.
	// If an error occurs, we'll log it and move onto the next scheduled post

	channel, appErr := a.GetChannel(rctx, scheduledPost.ChannelId)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			scheduledPost.ErrorCode = model.ScheduledPostErrorCodeChannelNotFound
			return scheduledPost, nil
		}

		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to get channel for scheduled post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.Err(appErr),
		)

		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, appErr
	}

	errorCode, err := a.canPostScheduledPost(rctx, scheduledPost, channel)
	scheduledPost.ErrorCode = errorCode
	if err != nil {
		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to check if scheduled post can be posted",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.Err(err),
		)

		return scheduledPost, err
	}

	if scheduledPost.ErrorCode != "" {
		rctx.Logger().Warn(
			"App.processScheduledPostBatch: skipping posting a scheduled post as `can post` check failed",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.String("error_code", scheduledPost.ErrorCode),
		)

		return scheduledPost, fmt.Errorf("App.processScheduledPostBatch: skipping posting a scheduled post as `can post` check failed, error_code: %s", scheduledPost.ErrorCode)
	}

	post, err := scheduledPost.ToPost()
	if err != nil {
		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to convert scheduled post job to a post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.Err(err),
		)

		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, err
	}

	_, appErr = a.CreatePost(rctx, post, channel, true, false)
	if appErr != nil {
		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to post scheduled post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.Err(appErr),
		)

		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, appErr
	}

	return scheduledPost, nil
}

// canPostScheduledPost checks whether the scheduled post be created based on permissions and other checks.
func (a *App) canPostScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost, channel *model.Channel) (string, error) {
	user, appErr := a.GetUser(scheduledPost.UserId)
	if appErr != nil {
		if appErr.Id == MissingAccountError {
			return model.ScheduledPostErrorCodeUserDoesNotExist, nil
		}

		rctx.Logger().Error(
			"App.canPostScheduledPost: failed to get user from database",
			mlog.String("user_id", scheduledPost.UserId),
			mlog.Err(appErr),
		)
		return model.ScheduledPostErrorUnknownError, errors.Wrapf(appErr, "App.canPostScheduledPost: failed to get user from database, userId: %s", scheduledPost.UserId)
	}

	if user.DeleteAt != 0 {
		return model.ScheduledPostErrorCodeUserDeleted, nil
	}

	if channel.DeleteAt != 0 {
		return model.ScheduledPostErrorCodeChannelArchived, nil
	}

	_, appErr = a.GetChannelMember(rctx, scheduledPost.ChannelId, scheduledPost.UserId)
	if appErr != nil {
		if appErr.Id == MissingChannelMemberError {
			return model.ScheduledPostErrorNoChannelMember, nil
		}

		rctx.Logger().Error(
			"App.canPostScheduledPost: failed to get channel member",
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.Err(appErr),
		)
		return model.ScheduledPostErrorUnknownError, errors.Wrapf(appErr, "App.canPostScheduledPost: failed to get user from database, userId: %s", scheduledPost.UserId)
	}

	if scheduledPost.RootId != "" {
		rootPosts, _, appErr := a.GetPostsByIds([]string{scheduledPost.RootId})
		if appErr != nil {
			if appErr.StatusCode == http.StatusNotFound {
				return model.ScheduledPostErrorThreadDeleted, nil
			}

			rctx.Logger().Error(
				"App.canPostScheduledPost: failed to get root post",
				mlog.String("scheduled_post_id", scheduledPost.Id),
				mlog.String("root_post_id", scheduledPost.RootId),
				mlog.Err(appErr),
			)

			return model.ScheduledPostErrorUnknownError, errors.Wrapf(appErr, "App.canPostScheduledPost: failed to get root post, scheduled_post_id: %s, root_post_id: %s", scheduledPost.Id, scheduledPost.RootId)
		}

		// you do get deleted posts from `GetPostsByIds`, so need to validate that as well
		if len(rootPosts) == 1 && rootPosts[0].Id == scheduledPost.RootId && rootPosts[0].DeleteAt != 0 {
			return model.ScheduledPostErrorThreadDeleted, nil
		}
	}

	hasPermission := a.HasPermissionToChannel(rctx, scheduledPost.UserId, scheduledPost.ChannelId, model.PermissionCreatePost)
	if !hasPermission {
		return model.ScheduledPostErrorCodeNoChannelPermission, nil
	}

	return "", nil
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
