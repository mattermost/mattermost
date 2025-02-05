// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/v8/platform/services/telemetry"

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
		return
	}

	if a.License() == nil {
		return
	}

	beforeTime := model.GetMillis()
	afterTime := beforeTime - (24 * 60 * 60 * 1000) // subtracting 24 hours from beforeTime
	lastScheduledPostId := ""

	for {
		// we wait some time before processing each batch to avoid hammering the database with too many requests.
		time.Sleep(scheduledPostBatchWaitTime)

		scheduledPostsBatch, err := a.Srv().Store().ScheduledPost().GetPendingScheduledPosts(beforeTime, afterTime, lastScheduledPostId, getPendingScheduledPostsPageSize)
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

		if len(scheduledPostsBatch) == 0 {
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

		if len(scheduledPostsBatch) < getPendingScheduledPostsPageSize {
			// if we got less than page size worth of scheduled posts, it indicates
			// that we have no more pending scheduled posts. So, we can break instead of making
			// an additional database call as we know there are going to be no records in there.
			break
		}
	}

	// once all scheduled posts are processed, we need to update and close the old ones
	// as we don't process pending scheduled posts more than 24 hours old.
	if err := a.Srv().Store().ScheduledPost().UpdateOldScheduledPosts(beforeTime); err != nil {
		rctx.Logger().Error(
			"App.ProcessScheduledPosts: failed to update old scheduled posts",
			mlog.Int("before_time", beforeTime),
			mlog.Err(err),
		)
	}
}

// processScheduledPostBatch processes one batch
func (a *App) processScheduledPostBatch(rctx request.CTX, scheduledPosts []*model.ScheduledPost) error {
	var failedScheduledPosts []*model.ScheduledPost
	var successfulScheduledPostIDs []string

	for i := range scheduledPosts {
		scheduledPost, err := a.postScheduledPost(rctx, scheduledPosts[i])
		if err != nil {
			rctx.Logger().Error("processScheduledPostBatch scheduled post processing failed", mlog.String("scheduled_post_id", scheduledPosts[i].Id), mlog.Err(err))
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

// postScheduledPost processes an individual scheduled post
func (a *App) postScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, error) {
	// we'll process scheduled posts one by one.
	// If an error occurs, we'll log it and move onto the next scheduled post

	channel, appErr := a.GetChannel(rctx, scheduledPost.ChannelId)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			rctx.Logger().Warn("channel for scheduled post not found, setting error code", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.String("channel_id", scheduledPost.ChannelId), mlog.String("error_code", model.ScheduledPostErrorCodeChannelNotFound), mlog.Err(appErr))

			scheduledPost.ErrorCode = model.ScheduledPostErrorCodeChannelNotFound
			return scheduledPost, nil
		}

		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to get channel for scheduled post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.String("error_code", model.ScheduledPostErrorUnknownError),
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
			"App.processScheduledPostBatch: failed to convert scheduled post to a post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("error_code", model.ScheduledPostErrorUnknownError),
			mlog.Err(err),
		)

		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, err
	}

	createPostFlags := model.CreatePostFlags{
		TriggerWebhooks: true,
		SetOnline:       false,
	}
	_, appErr = a.CreatePost(rctx, post, channel, createPostFlags)
	if appErr != nil {
		rctx.Logger().Error(
			"App.processScheduledPostBatch: failed to post scheduled post",
			mlog.String("scheduled_post_id", scheduledPost.Id),
			mlog.String("channel_id", scheduledPost.ChannelId),
			mlog.String("error_code", model.ScheduledPostErrorUnknownError),
			mlog.Err(appErr),
		)

		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError
		return scheduledPost, appErr
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
			rctx.Logger().Debug("canPostScheduledPost user not found for scheduled post", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.String("user_id", scheduledPost.UserId), mlog.String("error_code", model.ScheduledPostErrorCodeUserDoesNotExist))
			return model.ScheduledPostErrorCodeUserDoesNotExist, nil
		}

		rctx.Logger().Error(
			"App.canPostScheduledPost: failed to get user from database",
			mlog.String("user_id", scheduledPost.UserId),
			mlog.String("error_code", model.ScheduledPostErrorUnknownError),
			mlog.Err(appErr),
		)
		return model.ScheduledPostErrorUnknownError, errors.Wrapf(appErr, "App.canPostScheduledPost: failed to get user from database, userId: %s", scheduledPost.UserId)
	}

	if user.DeleteAt != 0 {
		rctx.Logger().Debug("canPostScheduledPost user for scheduled posts is deleted", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.String("user_id", scheduledPost.UserId), mlog.String("error_code", model.ScheduledPostErrorCodeUserDeleted))
		return model.ScheduledPostErrorCodeUserDeleted, nil
	}

	if channel.DeleteAt != 0 {
		rctx.Logger().Debug("canPostScheduledPost channel for scheduled post is archived", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.String("channel_id", channel.Id), mlog.String("error_code", model.ScheduledPostErrorCodeChannelArchived))
		return model.ScheduledPostErrorCodeChannelArchived, nil
	}

	if scheduledPost.RootId != "" {
		rootPosts, _, appErr := a.GetPostsByIds([]string{scheduledPost.RootId})
		if appErr != nil {
			if appErr.StatusCode == http.StatusNotFound {
				rctx.Logger().Debug("canPostScheduledPost thread root post for scheduled post is missing", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.String("root_post_id", scheduledPost.RootId), mlog.String("error_code", model.ScheduledPostErrorThreadDeleted))
				return model.ScheduledPostErrorThreadDeleted, nil
			}

			rctx.Logger().Error(
				"App.canPostScheduledPost: failed to get root post",
				mlog.String("scheduled_post_id", scheduledPost.Id),
				mlog.String("root_post_id", scheduledPost.RootId),
				mlog.String("error_code", model.ScheduledPostErrorUnknownError),
				mlog.Err(appErr),
			)

			return model.ScheduledPostErrorUnknownError, errors.Wrapf(appErr, "App.canPostScheduledPost: failed to get root post, scheduled_post_id: %s, root_post_id: %s", scheduledPost.Id, scheduledPost.RootId)
		}

		// you do get deleted posts from `GetPostsByIds`, so need to validate that as well
		if len(rootPosts) == 1 && rootPosts[0].Id == scheduledPost.RootId && rootPosts[0].DeleteAt != 0 {
			rctx.Logger().Debug("canPostScheduledPost thread root post is deleted", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.String("root_post_id", scheduledPost.RootId), mlog.String("error_code", model.ScheduledPostErrorThreadDeleted))
			return model.ScheduledPostErrorThreadDeleted, nil
		}
	}

	if appErr := userCreatePostPermissionCheckWithApp(rctx, a, scheduledPost.UserId, scheduledPost.ChannelId); appErr != nil {
		rctx.Logger().Debug(
			"canPostScheduledPost user does not have permission to create post in channel",
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
			"canPostScheduledPost hardened mode enabled: post contains props prohibited in hardened mode",
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
			"canPostScheduledPost post priority check failed",
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

		a.Srv().telemetryService.SendTelemetryForFeature(
			telemetry.TrackScheduledPosts,
			"scheduled_posts_success",
			map[string]any{"count": len(successfulScheduledPostIDs)},
		)
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
		// send WS event for updating the scheduled post with the error code
		a.PublishScheduledPostEvent(rctx, model.WebsocketScheduledPostUpdated, failedScheduledPost, "")
	}

	if len(failedScheduledPosts) > 0 {
		a.Srv().telemetryService.SendTelemetryForFeature(
			telemetry.TrackScheduledPosts,
			"scheduled_posts_failed",
			map[string]any{"count": len(failedScheduledPosts)},
		)
		a.notifyUserAboutFailedScheduledMessages(rctx, failedScheduledPosts)
	}
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
