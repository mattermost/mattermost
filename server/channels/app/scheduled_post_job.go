// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/pkg/errors"
)

const (
	getPendingScheduledPostsPageSize = 100
	scheduledPostBatchWaitTime       = 1 * time.Second
)

func (a *App) ProcessScheduledPosts(rctx request.CTX) {
	rctx = rctx.WithLogger(rctx.Logger().With(mlog.String("component", "scheduled_post_job")))

	if !*a.Config().ServiceSettings.ScheduledPosts {
		rctx.Logger().Debug("Scheduled posts feature is disabled, skipping job execution")
		return
	}

	if a.License() == nil {
		rctx.Logger().Info("No license found, skipping job execution")
		return
	}

	startTime := time.Now()
	rctx.Logger().Debug("Job started")

	// Track metrics for this job run
	var (
		totalSuccessful int
		totalFailed     int
		totalSkipped    int
		batchCount      int
	)

	defer func() {
		duration := time.Since(startTime)
		rctx.Logger().Debug(
			"Job completed",
			mlog.Duration("duration", duration),
			mlog.Int("batches_processed", batchCount),
			mlog.Int("successful_posts", totalSuccessful),
			mlog.Int("failed_posts", totalFailed),
			mlog.Int("skipped_posts", totalSkipped),
		)
	}()

	beforeTime := model.GetMillis()
	afterTime := beforeTime - (24 * 60 * 60 * 1000) // subtracting 24 hours from beforeTime
	lastScheduledPostId := ""

	for {
		// we wait some time before processing each batch to avoid hammering the database with too many requests.
		time.Sleep(scheduledPostBatchWaitTime)

		batchCount++
		batchStartTime := time.Now()

		scheduledPostsBatch, err := a.Srv().Store().ScheduledPost().GetPendingScheduledPosts(beforeTime, afterTime, lastScheduledPostId, getPendingScheduledPostsPageSize)
		if err != nil {
			rctx.Logger().Error(
				"Failed to fetch pending scheduled posts page from database",
				mlog.Int("batch_number", batchCount),
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

		if len(scheduledPostsBatch) == 0 {
			// break loop if there are no more scheduled posts
			break
		}

		// Saving the last item to use as marker for next page
		lastScheduledPostId = scheduledPostsBatch[len(scheduledPostsBatch)-1].Id
		beforeTime = scheduledPostsBatch[len(scheduledPostsBatch)-1].ScheduledAt

		batchSuccessful, batchFailed, batchSkipped, err := a.processScheduledPostBatch(rctx, batchCount, scheduledPostsBatch)
		totalSuccessful += batchSuccessful
		totalFailed += batchFailed
		totalSkipped += batchSkipped

		batchDuration := time.Since(batchStartTime)
		rctx.Logger().Debug(
			"Processed batch of scheduled posts",
			mlog.Int("batch_number", batchCount),
			mlog.Int("batch_size", len(scheduledPostsBatch)),
			mlog.Int("successful", batchSuccessful),
			mlog.Int("failed", batchFailed),
			mlog.Int("skipped", batchSkipped),
			mlog.Duration("batch_duration", batchDuration),
		)

		if err != nil {
			rctx.Logger().Error(
				"Failed to process scheduled posts batch",
				mlog.Int("batch_number", batchCount),
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

		if len(scheduledPostsBatch) < getPendingScheduledPostsPageSize {
			// if we got less than page size worth of scheduled posts, it indicates
			// that we have no more pending scheduled posts. So, we can break instead of making
			// an additional database call as we know there are going to be no records in there.
			break
		}
	}

	// once all scheduled posts are processed, we need to update and close the old ones
	// as we don't process pending scheduled posts more than 24 hours old.
	rowsAffected, err := a.Srv().Store().ScheduledPost().UpdateOldScheduledPosts(beforeTime)
	if err != nil {
		rctx.Logger().Error(
			"Failed to update old scheduled posts",
			mlog.Int("before_time", beforeTime),
			mlog.Err(err),
		)
	} else {
		if rowsAffected > 0 {
			rctx.Logger().Debug(
				"Old scheduled posts updated successfully",
				mlog.Int("before_time", beforeTime),
				mlog.Int("rows_affected", rowsAffected),
			)
		}
	}
}

// processScheduledPostBatch processes one batch and returns metrics: successful, failed, skipped counts, and error
func (a *App) processScheduledPostBatch(rctx request.CTX, batchNumber int, scheduledPosts []*model.ScheduledPost) (int, int, int, error) {
	var failedScheduledPosts []*model.ScheduledPost
	var successfulScheduledPostIDs []string
	var skippedCount int

	for _, post := range scheduledPosts {
		scheduledPost, err := a.postScheduledPost(rctx, post)
		if err != nil {
			rctx.Logger().Error(
				"Scheduled post processing failed",
				mlog.String("scheduled_post_id", post.Id),
				mlog.String("user_id", post.UserId),
				mlog.String("channel_id", post.ChannelId),
				mlog.Err(err),
			)
			failedScheduledPosts = append(failedScheduledPosts, scheduledPost)
			continue
		}

		if wasSkipped {
			skippedCount++
			failedScheduledPosts = append(failedScheduledPosts, scheduledPost)
		} else {
			successfulScheduledPostIDs = append(successfulScheduledPostIDs, scheduledPost.Id)
		}
	}

	if err := a.handleSuccessfulScheduledPosts(rctx, successfulScheduledPostIDs); err != nil {
		return len(successfulScheduledPostIDs), len(failedScheduledPosts) - skippedCount, skippedCount, errors.Wrap(err, "App.processScheduledPostBatch: failed to handle successfully posted scheduled posts")
	}

	if err := a.handleFailedScheduledPosts(rctx, failedScheduledPosts); err != nil {
		return len(successfulScheduledPostIDs), len(failedScheduledPosts) - skippedCount, skippedCount, errors.Wrap(err, "App.processScheduledPostBatch: failed to handle failed scheduled posts")
	}

	return len(successfulScheduledPostIDs), len(failedScheduledPosts) - skippedCount, skippedCount, nil
}

// postScheduledPost processes an individual scheduled post
func (a *App) postScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, error) {
	// we'll process scheduled posts one by one.
	// If an error occurs, we'll log it and move onto the next scheduled post

	rctx = rctx.WithLogger(rctx.Logger().With(
		mlog.String("scheduled_post_id", scheduledPost.Id),
		mlog.String("user_id", scheduledPost.UserId),
		mlog.String("channel_id", scheduledPost.ChannelId),
	))

	channel, appErr := a.GetChannel(rctx, scheduledPost.ChannelId)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			scheduledPost.ErrorCode = model.ScheduledPostErrorCodeChannelNotFound
			return scheduledPost, errors.Wrapf(appErr, "channel %s  for scheduled post not found  %s", scheduledPost.ChannelId, scheduledPost.Id)
		}

		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, errors.Wrapf(appErr, "failed to get channel %s for scheduled post %s", scheduledPost.ChannelId, scheduledPost.Id)
	}

	errorCode, err := a.canPostScheduledPost(rctx, scheduledPost, channel)
	scheduledPost.ErrorCode = errorCode
	if err != nil {
		rctx.Logger().Error(
			"Failed to check if scheduled post can be posted",

			mlog.String("error_code", errorCode),
			mlog.Err(err),
		)

		return scheduledPost, errors.Wrapf(err, "failed permissions check post for scheduled post %s", scheduledPost.Id)
	}

	post, err := scheduledPost.ToPost()
	if err != nil {
		rctx.Logger().Error(
			"Failed to convert scheduled post to a post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("error_code", model.ScheduledPostErrorUnknownError),
			mlog.Err(err),
		)

		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, errors.Wrapf(err, "failed to convert scheduled post %s to post", scheduledPost.Id)
	}

	createPostFlags := model.CreatePostFlags{
		TriggerWebhooks: true,
		SetOnline:       false,
	}
	_, appErr = a.CreatePost(rctx, post, channel, createPostFlags)
	if appErr != nil {
		rctx.Logger().Error(
			"Failed to create post from scheduled post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.String("error_code", model.ScheduledPostErrorUnknownError),
			mlog.Err(appErr),
		)

		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, errors.Wrapf(appErr, "failed to create post for scheduled post %s", scheduledPost.Id)
	}

	// send the WS event to delete the just posted scheduledPost from list
	a.PublishScheduledPostEvent(rctx, model.WebsocketScheduledPostDeleted, scheduledPost, "")

	return scheduledPost, nil
}

// canPostScheduledPost checks whether the scheduled post be created based on permissions and other checks.
func (a *App) canPostScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost, channel *model.Channel) (string, error) {
	user, appErr := a.GetUser(scheduledPost.UserId)
	if appErr != nil {
		if appErr.Id == MissingAccountError {
			rctx.Logger().Debug(
				"User not found for scheduled post",
				mlog.String("scheduled_post_id", scheduledPost.Id),
				mlog.String("user_id", scheduledPost.UserId),
				mlog.String("error_code", model.ScheduledPostErrorCodeUserDoesNotExist),
			)
			return model.ScheduledPostErrorCodeUserDoesNotExist, errors.Wrapf(appErr, "user %s not found", scheduledPost.UserId)
		}

		rctx.Logger().Error(
			"Failed to get user from database",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("error_code", model.ScheduledPostErrorUnknownError),
			mlog.Err(appErr),
		)
		return model.ScheduledPostErrorUnknownError, errors.Wrapf(appErr, "failed to get user %s", scheduledPost.UserId)
	}

	if user.DeleteAt != 0 {
		rctx.Logger().Debug(
			"User for scheduled post is deleted",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("error_code", model.ScheduledPostErrorCodeUserDeleted),
		)
		return model.ScheduledPostErrorCodeUserDeleted, nil
	}

	if channel.DeleteAt != 0 {
		rctx.Logger().Debug(
			"Channel for scheduled post is archived",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", channel.Id),
			mlog.String("error_code", model.ScheduledPostErrorCodeChannelArchived),
		)
		return model.ScheduledPostErrorCodeChannelArchived, nil
	}

	restrictDM, err := a.CheckIfChannelIsRestrictedDM(rctx, channel)
	if err != nil {
		rctx.Logger().Error(
			" error checking if channel is restricted DM",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", channel.Id),
			mlog.String("error_code", model.ScheduledPostErrorUnknownError),
			mlog.Err(err),
		)
		return model.ScheduledPostErrorUnknownError, errors.Wrapf(err, "failed to check if channel %s is restricted DM", channel.Id)
	}

	if restrictDM {
		rctx.Logger().Debug(
			" channel for scheduled post is restricted DM",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", channel.Id),
			mlog.String("error_code", model.ScheduledPostErrorCodeRestrictedDM),
		)
		return model.ScheduledPostErrorCodeRestrictedDM, nil
	}

	if scheduledPost.RootId != "" {
		rootPosts, _, appErr := a.GetPostsByIds([]string{scheduledPost.RootId})
		if appErr != nil {
			if appErr.StatusCode == http.StatusNotFound {
				rctx.Logger().Debug(
					" thread root post for scheduled post is missing",
					mlog.String("scheduled_post_id", scheduledPost.Id),
					mlog.String("root_post_id", scheduledPost.RootId),
					mlog.String("error_code", model.ScheduledPostErrorThreadDeleted),
				)
				return model.ScheduledPostErrorThreadDeleted, nil
			}

			rctx.Logger().Error(
				" failed to get root post from database",
				mlog.String("scheduled_post_id", scheduledPost.Id),
				mlog.String("root_post_id", scheduledPost.RootId),
				mlog.String("error_code", model.ScheduledPostErrorUnknownError),
				mlog.Err(appErr),
			)

			return model.ScheduledPostErrorUnknownError, errors.Wrapf(appErr, "failed to get root post %s for scheduled post %s", scheduledPost.RootId, scheduledPost.Id)
		}

		// you do get deleted posts from `GetPostsByIds`, so need to validate that as well
		if len(rootPosts) == 1 && rootPosts[0].Id == scheduledPost.RootId && rootPosts[0].DeleteAt != 0 {
			rctx.Logger().Debug(
				" thread root post is deleted",
				mlog.String("scheduled_post_id", scheduledPost.Id),
				mlog.String("root_post_id", scheduledPost.RootId),
				mlog.String("error_code", model.ScheduledPostErrorThreadDeleted),
			)
			return model.ScheduledPostErrorThreadDeleted, nil
		}
	}

	if appErr := userCreatePostPermissionCheckWithApp(rctx, a, scheduledPost.UserId, scheduledPost.ChannelId); appErr != nil {
		rctx.Logger().Debug(
			" user does not have permission to create post in channel",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.String("error_code", model.ScheduledPostErrorCodeNoChannelPermission),
			mlog.Err(appErr),
		)
		return model.ScheduledPostErrorCodeNoChannelPermission, nil
	}

	if appErr := PostHardenedModeCheckWithApp(a, false, scheduledPost.GetProps()); appErr != nil {
		rctx.Logger().Debug(
			" hardened mode enabled - post contains prohibited props",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.String("error_code", model.ScheduledPostErrorInvalidPost),
			mlog.Err(appErr),
		)
		return model.ScheduledPostErrorInvalidPost, nil
	}

	if appErr := PostPriorityCheckWithApp("ScheduledPostJob.postChecks", a, scheduledPost.UserId, scheduledPost.GetPriority(), scheduledPost.RootId); appErr != nil {
		rctx.Logger().Debug(
			" post priority check failed",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.String("error_code", model.ScheduledPostErrorInvalidPost),
			mlog.Err(appErr),
		)
		return model.ScheduledPostErrorInvalidPost, nil
	}

	return "", nil
}

func (a *App) handleSuccessfulScheduledPosts(rctx request.CTX, successfulScheduledPostIDs []string) error {
	if len(successfulScheduledPostIDs) == 0 {
		return nil
	}

	// Successfully posted scheduled posts can be safely permanently deleted as no data is lost.
	// The data is moved into the posts table.
	err := a.Srv().Store().ScheduledPost().PermanentlyDeleteScheduledPosts(successfulScheduledPostIDs)
	if err != nil {
		rctx.Logger().Error(
			"Failed to delete successfully posted scheduled posts from database",
			mlog.Int("successfully_posted_count", len(successfulScheduledPostIDs)),
			mlog.Err(err),
		)
		return errors.Wrapf(err, "failed to delete %d successfully posted scheduled posts", len(successfulScheduledPostIDs))
	}

	rctx.Logger().Debug(
		"Successfully cleaned up posted scheduled posts",
		mlog.Int("count", len(successfulScheduledPostIDs)),
	)

	return nil
}

func (a *App) handleFailedScheduledPosts(rctx request.CTX, failedScheduledPosts []*model.ScheduledPost) error {
	if len(failedScheduledPosts) == 0 {
		return nil
	}

	var updateErrors []error
	successfullyUpdated := 0

	for _, failedScheduledPost := range failedScheduledPosts {
		err := a.Srv().Store().ScheduledPost().UpdatedScheduledPost(failedScheduledPost)
		if err != nil {
			// we intentionally don't stop on error as it's possible to continue updating other scheduled posts
			rctx.Logger().Error(
				"Failed to update failed scheduled post in database",
				mlog.String("scheduled_post_id", failedScheduledPost.Id),
				mlog.String("error_code", failedScheduledPost.ErrorCode),
				mlog.Err(err),
			)
			updateErrors = append(updateErrors, errors.Wrapf(err, "failed to update scheduled post %s", failedScheduledPost.Id))
			continue
		}

		successfullyUpdated++
		// send WS event for updating the scheduled post with the error code
		a.PublishScheduledPostEvent(rctx, model.WebsocketScheduledPostUpdated, failedScheduledPost, "")
	}

	rctx.Logger().Debug(
		"Updated failed scheduled posts",
		mlog.Int("total_failed", len(failedScheduledPosts)),
		mlog.Int("successfully_updated", successfullyUpdated),
		mlog.Int("update_errors", len(updateErrors)),
	)

	a.notifyUserAboutFailedScheduledMessages(rctx, failedScheduledPosts)

	if len(updateErrors) > 0 {
		return errors.Errorf("failed to update %d out of %d failed scheduled posts", len(updateErrors), len(failedScheduledPosts))
	}

	return nil
}

func (a *App) notifyUserAboutFailedScheduledMessages(rctx request.CTX, failedMessages []*model.ScheduledPost) {
	failedMessagesByUser := aggregateFailMessagesByUser(failedMessages)
	systemBot, err := a.GetSystemBot(rctx)
	if err != nil {
		rctx.Logger().Error("Failed to get the system bot", mlog.Err(err))
		return
	}

	for userId, userFailedMessages := range failedMessagesByUser {
		a.Srv().Go(func(userId string, userFailedMessages []*model.ScheduledPost) func() {
			return func() {
				a.notifyUser(rctx, userId, userFailedMessages, systemBot)
			}
		}(userId, userFailedMessages))
	}
}

func aggregateFailMessagesByUser(failedMessages []*model.ScheduledPost) map[string][]*model.ScheduledPost {
	aggregated := make(map[string][]*model.ScheduledPost)
	for _, msg := range failedMessages {
		aggregated[msg.UserId] = append(aggregated[msg.UserId], msg)
	}
	return aggregated
}

func (a *App) notifyUser(rctx request.CTX, userId string, userFailedMessages []*model.ScheduledPost, systemBot *model.Bot) {
	channel, err := a.GetOrCreateDirectChannel(rctx, userId, systemBot.UserId)
	if err != nil {
		rctx.Logger().Error("Failed to get or create the DM", mlog.Err(err))
		return
	}

	user, err := a.GetUser(userId)
	if err != nil {
		rctx.Logger().Error("Failed to get the user", mlog.Err(err))
		return
	}

	T := i18n.GetUserTranslations(user.Locale)

	type channelErrorKey struct {
		ChannelId string
		ErrorCode string
	}

	channelErrorCounts := make(map[channelErrorKey]int)
	channelIdsSet := make(map[string]struct{})
	for _, msg := range userFailedMessages {
		key := channelErrorKey{ChannelId: msg.ChannelId, ErrorCode: msg.ErrorCode}
		channelErrorCounts[key]++
		channelIdsSet[msg.ChannelId] = struct{}{}
	}

	channelNames := make(map[string]string)
	for channelId := range channelIdsSet {
		ch, err := a.GetChannel(rctx, channelId)
		if err != nil {
			rctx.Logger().Error("Failed to get channel", mlog.String("channel_id", channelId), mlog.Err(err))
			channelNames[channelId] = T("app.scheduled_post.unknown_channel")
			continue
		}
		if ch.Type != model.ChannelTypePrivate {
			channelNames[channelId] = ch.DisplayName
		} else {
			channelNames[channelId] = T("app.scheduled_post.private_channel")
		}
	}

	var messageBuilder strings.Builder

	totalFailedMessages := len(userFailedMessages)
	messageHeader := T("app.scheduled_post.failed_messages", map[string]any{
		"Count": totalFailedMessages,
	})
	messageBuilder.WriteString(messageHeader)
	messageBuilder.WriteString("\n")

	for key, count := range channelErrorCounts {
		channelName := channelNames[key.ChannelId]
		errorReason := getErrorReason(T, key.ErrorCode)

		detailedMessage := T("app.scheduled_post.failed_message_detail", map[string]any{
			"Count":       count,
			"ChannelName": channelName,
			"ErrorReason": errorReason,
		})
		messageBuilder.WriteString(detailedMessage)
		messageBuilder.WriteString("\n")
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   messageBuilder.String(),
		Type:      model.PostTypeDefault,
		UserId:    systemBot.UserId,
	}

	if _, err := a.CreatePost(rctx, post, channel, model.CreatePostFlags{SetOnline: true}); err != nil {
		rctx.Logger().Error("Failed to post notification about failed scheduled messages", mlog.Err(err))
	}
}

func getErrorReason(T i18n.TranslateFunc, errorCode string) string {
	var reason string
	switch errorCode {
	case "unknown":
		reason = T("app.scheduled_post.error_reason.unknown")
	case "channel_archived":
		reason = T("app.scheduled_post.error_reason.channel_archived")
	case "channel_not_found":
		reason = T("app.scheduled_post.error_reason.channel_not_found")
	case "user_missing":
		reason = T("app.scheduled_post.error_reason.user_missing")
	case "user_deleted":
		reason = T("app.scheduled_post.error_reason.user_deleted")
	case "no_channel_permission":
		reason = T("app.scheduled_post.error_reason.no_channel_permission")
	case "no_channel_member":
		reason = T("app.scheduled_post.error_reason.no_channel_member")
	case "thread_deleted":
		reason = T("app.scheduled_post.error_reason.thread_deleted")
	case "unable_to_send":
		reason = T("app.scheduled_post.error_reason.unable_to_send")
	case "invalid_post":
		reason = T("app.scheduled_post.error_reason.invalid_post")
	default:
		reason = errorCode
	}
	return reason
}
