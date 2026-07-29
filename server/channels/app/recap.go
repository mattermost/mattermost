// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// CreateRecap creates a new recap job for the specified channels
func (a *App) CreateRecap(rctx request.CTX, title string, channelIDs []string, agentID string) (*model.Recap, *model.AppError) {
	if appErr := a.requireAIRecapsEnabled("CreateRecap"); appErr != nil {
		return nil, appErr
	}

	userID := rctx.Session().UserId

	limits, err := a.GetEffectiveLimits()
	if err != nil {
		return nil, err
	}

	// The channel count check runs first so it bounds the permission check below.
	if model.IsLimitEnabled(limits.MaxChannelsPerRecap) && len(channelIDs) > limits.MaxChannelsPerRecap {
		return nil, recapMaxChannelsExceededError("CreateRecap", limits.MaxChannelsPerRecap, len(channelIDs))
	}

	// Validate user can read all channels
	if appErr := a.validateRecapChannelPermissions(rctx, channelIDs, "CreateRecap"); appErr != nil {
		return nil, appErr
	}

	if appErr := a.checkManualRecapCooldown(userID, limits, "CreateRecap"); appErr != nil {
		return nil, appErr
	}

	timeNow := model.GetMillis()

	// Create recap record
	recap := &model.Recap{
		Id:                model.NewId(),
		UserId:            userID,
		Title:             title,
		CreateAt:          timeNow,
		UpdateAt:          timeNow,
		DeleteAt:          0,
		ReadAt:            0,
		TotalMessageCount: 0,
		Status:            model.RecapStatusPending,
		BotID:             agentID,
	}

	var (
		savedRecap *model.Recap
		storeErr   error
	)
	if model.IsLimitEnabled(limits.MaxRecapsPerDay) {
		startOfDayMillis, dayErr := a.getStartOfUserDayMillis(userID)
		if dayErr != nil {
			return nil, dayErr
		}

		savedRecap, storeErr = a.Srv().Store().Recap().SaveRecapIfUnderDailyLimit(recap, startOfDayMillis, limits.MaxRecapsPerDay)
		if storeErr != nil {
			var limitErr *store.ErrLimitExceeded
			if errors.As(storeErr, &limitErr) {
				return nil, recapMaxRecapsReachedError("CreateRecap", limits.MaxRecapsPerDay)
			}
			return nil, model.NewAppError("CreateRecap", "app.recap.save.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	} else {
		savedRecap, storeErr = a.Srv().Store().Recap().SaveRecap(recap)
		if storeErr != nil {
			return nil, model.NewAppError("CreateRecap", "app.recap.save.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	// Create background job
	jobData := map[string]string{
		"recap_id":    recap.Id,
		"user_id":     userID,
		"channel_ids": strings.Join(channelIDs, ","),
		"agent_id":    agentID,
	}

	_, jobErr := a.CreateJob(rctx, &model.Job{
		Type: model.JobTypeRecap,
		Data: jobData,
	})

	if jobErr != nil {
		// The recap row is already committed but its job never enqueued, so flag it
		// skipped to free the daily-limit slot for a recap that will never run.
		if skipErr := a.Srv().Store().Recap().MarkRecapSkipped(savedRecap.Id, model.SkipReasonJobCreationFailed); skipErr != nil {
			rctx.Logger().Warn("Failed to mark orphaned recap as skipped after job creation failure",
				mlog.String("recap_id", savedRecap.Id),
				mlog.Err(skipErr),
			)
		}
		return nil, jobErr
	}

	return savedRecap, nil
}

// GetRecap retrieves a recap by ID
func (a *App) GetRecap(rctx request.CTX, recapID string) (*model.Recap, *model.AppError) {
	recap, err := a.Srv().Store().Recap().GetRecap(recapID)
	if err != nil {
		return nil, model.NewAppError("GetRecap", "app.recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	// Load channels
	channels, err := a.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
	if err != nil {
		return nil, model.NewAppError("GetRecap", "app.recap.get_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	recap.Channels = channels

	return recap, nil
}

// GetRecapsForUser retrieves all recaps for a user
func (a *App) GetRecapsForUser(rctx request.CTX, page, perPage int) ([]*model.Recap, *model.AppError) {
	userID := rctx.Session().UserId
	recaps, err := a.Srv().Store().Recap().GetRecapsForUser(userID, page, perPage)
	if err != nil {
		return nil, model.NewAppError("GetRecapsForUser", "app.recap.list.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return recaps, nil
}

// MarkRecapAsRead marks a recap as read
func (a *App) MarkRecapAsRead(rctx request.CTX, recap *model.Recap) (*model.Recap, *model.AppError) {
	// Mark as read
	if markErr := a.Srv().Store().Recap().MarkRecapAsRead(recap.Id); markErr != nil {
		return nil, model.NewAppError("MarkRecapAsRead", "app.recap.mark_read.app_error", nil, "", http.StatusInternalServerError).Wrap(markErr)
	}

	// Update the passed recap with read timestamp
	recap.ReadAt = model.GetMillis()
	recap.UpdateAt = recap.ReadAt

	// Load channels if not already loaded
	if recap.Channels == nil {
		channels, err := a.Srv().Store().Recap().GetRecapChannelsByRecapId(recap.Id)
		if err != nil {
			return nil, model.NewAppError("MarkRecapAsRead", "app.recap.get_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		recap.Channels = channels
	}

	return recap, nil
}

// MarkRecapsAsViewed marks all of the user's not-yet-viewed completed/failed
// recaps as viewed at the current timestamp and broadcasts a recap_updated
// WebSocket event for each affected recap so other clients can refresh.
func (a *App) MarkRecapsAsViewed(rctx request.CTX) ([]string, *model.AppError) {
	userID := rctx.Session().UserId
	statuses := []string{model.RecapStatusCompleted, model.RecapStatusFailed}

	ids, err := a.Srv().Store().Recap().MarkRecapsAsViewed(userID, statuses)
	if err != nil {
		return nil, model.NewAppError("MarkRecapsAsViewed", "app.recap.mark_viewed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, id := range ids {
		message := model.NewWebSocketEvent(model.WebsocketEventRecapUpdated, "", "", userID, nil, "")
		message.Add("recap_id", id)
		a.Publish(message)
	}

	return ids, nil
}

// RegenerateRecap regenerates an existing recap
func (a *App) RegenerateRecap(rctx request.CTX, userID string, recap *model.Recap) (*model.Recap, *model.AppError) {
	if appErr := a.requireAIRecapsEnabled("RegenerateRecap"); appErr != nil {
		return nil, appErr
	}

	recapID := recap.Id

	// Get existing recap channels to extract channel IDs
	channels, err := a.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
	if err != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.get_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Extract channel IDs
	channelIDs := make([]string, len(channels))
	for i, channel := range channels {
		channelIDs[i] = channel.ChannelId
	}

	limits, limitsErr := a.GetEffectiveLimits()
	if limitsErr != nil {
		return nil, limitsErr
	}

	if model.IsLimitEnabled(limits.MaxChannelsPerRecap) && len(channelIDs) > limits.MaxChannelsPerRecap {
		return nil, recapMaxChannelsExceededError("RegenerateRecap", limits.MaxChannelsPerRecap, len(channelIDs))
	}
	if appErr := a.checkManualRecapCooldown(userID, limits, "RegenerateRecap"); appErr != nil {
		return nil, appErr
	}

	if model.IsLimitEnabled(limits.MaxRecapsPerDay) {
		startOfDayMillis, dayErr := a.getStartOfUserDayMillis(userID)
		if dayErr != nil {
			return nil, dayErr
		}

		count, countErr := a.Srv().Store().Recap().CountForUserSince(userID, startOfDayMillis)
		if countErr != nil {
			return nil, model.NewAppError("RegenerateRecap", "app.recap.get_daily_count.app_error", nil, "", http.StatusInternalServerError).Wrap(countErr)
		}
		if count >= int64(limits.MaxRecapsPerDay) {
			return nil, recapMaxRecapsReachedError("RegenerateRecap", limits.MaxRecapsPerDay)
		}
	}

	// Delete existing recap channels
	if deleteErr := a.Srv().Store().Recap().DeleteRecapChannels(recapID); deleteErr != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.delete_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	// Update recap status to pending and reset read/viewed status so the recap
	// reappears in the badge once it completes again.
	recap.Status = model.RecapStatusPending
	recap.ReadAt = 0
	recap.ViewedAt = 0
	recap.UpdateAt = model.GetMillis()
	recap.TotalMessageCount = 0

	if _, updateErr := a.Srv().Store().Recap().UpdateRecap(recap); updateErr != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.update.app_error", nil, "", http.StatusInternalServerError).Wrap(updateErr)
	}

	// Create new job with same parameters
	jobData := map[string]string{
		"recap_id":    recapID,
		"user_id":     userID,
		"channel_ids": strings.Join(channelIDs, ","),
		"agent_id":    recap.BotID,
	}

	_, jobErr := a.CreateJob(rctx, &model.Job{
		Type: model.JobTypeRecap,
		Data: jobData,
	})

	if jobErr != nil {
		return nil, jobErr
	}

	// Return updated recap
	updatedRecap, getErr := a.GetRecap(rctx, recapID)
	if getErr != nil {
		return nil, getErr
	}

	return updatedRecap, nil
}

// DeleteRecap deletes a recap (soft delete)
func (a *App) DeleteRecap(rctx request.CTX, recapID string) *model.AppError {
	// Delete recap
	if deleteErr := a.Srv().Store().Recap().DeleteRecap(recapID); deleteErr != nil {
		return model.NewAppError("DeleteRecap", "app.recap.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	return nil
}

// ProcessRecapChannel processes a single channel for a recap using default manual recap options.
func (a *App) ProcessRecapChannel(rctx request.CTX, recapID, channelID, userID, agentID string) (*model.RecapChannelResult, *model.AppError) {
	return a.ProcessRecapChannelWithOptions(rctx, recapID, channelID, userID, agentID, model.RecapProcessingOptions{})
}

// ProcessRecapChannelWithOptions processes a single channel for a recap, fetching posts,
// summarizing them, and saving the recap channel record. Returns the number of messages processed.
func (a *App) ProcessRecapChannelWithOptions(rctx request.CTX, recapID, channelID, userID, agentID string, options model.RecapProcessingOptions) (*model.RecapChannelResult, *model.AppError) {
	result := &model.RecapChannelResult{
		ChannelID: channelID,
		Success:   false,
	}

	// Re-verify read access at execution time. Scheduled recaps run long after
	// creation, so a user's channel access may have been revoked since then.
	if ok, _ := a.HasPermissionToChannel(rctx, userID, channelID, model.PermissionReadChannel); !ok {
		return result, model.NewAppError("ProcessRecapChannel", "app.recap.permission_denied", nil, "", http.StatusForbidden)
	}

	// Get channel info
	channel, err := a.GetChannel(rctx, channelID)
	if err != nil {
		return result, model.NewAppError("ProcessRecapChannel", "app.recap.get_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Get user's last viewed timestamp
	lastViewedAt, lastViewedErr := a.Srv().Store().Channel().GetMemberLastViewedAt(rctx, channelID, userID)
	if lastViewedErr != nil {
		return result, model.NewAppError("ProcessRecapChannel", "app.recap.get_last_viewed.app_error", nil, "", http.StatusInternalServerError).Wrap(lastViewedErr)
	}
	fetchSince, allowRecentFallback := recapFetchStartAt(options.TimePeriod, lastViewedAt, time.Now())

	remainingPosts, limitErr := a.getRemainingPostsForRecap(userID, recapID)
	if limitErr != nil {
		return result, limitErr
	}
	if remainingPosts == 0 {
		if appErr := a.saveRecapChannelRecord(recapID, channel.Id, channel.DisplayName, nil, nil, nil); appErr != nil {
			return result, appErr
		}
		result.Success = true
		return result, nil
	}

	// Fetch posts for recap
	posts, postsErr := a.fetchPostsForRecapWithFallback(rctx, channelID, fetchSince, remainingPosts, allowRecentFallback)
	if postsErr != nil {
		return result, postsErr
	}

	// Enforce MaxTokensPerRecap as a per-channel cap. RecapChannel records persist only post
	// IDs (not message content), so a true cross-channel token budget would require re-fetching
	// every already-processed channel's posts; capping per channel bounds each LLM payload cheaply.
	remainingTokens, tokensErr := a.getRemainingTokensForRecap(userID)
	if tokensErr != nil {
		return result, tokensErr
	}
	if model.IsLimitEnabled(remainingTokens) {
		if trimmed, wasTrimmed := trimPostsToTokenLimit(posts, remainingTokens); wasTrimmed {
			posts = trimmed
			rctx.Logger().Debug("Recap posts trimmed to token limit",
				mlog.Int("max_tokens", remainingTokens),
				mlog.String("channel_id", channelID))
		}
	}

	sourcePostIDs := extractPostIDs(posts)

	// No posts to summarize - return success with 0 messages
	if len(posts) == 0 {
		if appErr := a.saveRecapChannelRecord(recapID, channel.Id, channel.DisplayName, nil, nil, sourcePostIDs); appErr != nil {
			return result, appErr
		}
		result.Success = true
		return result, nil
	}

	// Get team info for permalink generation
	team, teamErr := a.GetTeam(channel.TeamId)
	if teamErr != nil {
		return result, model.NewAppError("ProcessRecapChannel", "app.recap.get_team.app_error", nil, "", http.StatusInternalServerError).Wrap(teamErr)
	}

	// Summarize posts
	summary, err := a.SummarizePostsWithInstructions(rctx, userID, posts, channel.DisplayName, team.Name, agentID, options.CustomInstructions)
	if err != nil {
		if saveErr := a.saveRecapChannelRecord(recapID, channel.Id, channel.DisplayName, nil, nil, sourcePostIDs); saveErr != nil {
			return result, saveErr
		}
		return result, err
	}

	if appErr := a.saveRecapChannelRecord(recapID, channelID, channel.DisplayName, summary.Highlights, summary.ActionItems, sourcePostIDs); appErr != nil {
		return result, appErr
	}

	result.MessageCount = len(posts)
	result.Success = true
	return result, nil
}

func (a *App) saveRecapChannelRecord(recapID, channelID, channelName string, highlights, actionItems, sourcePostIDs []string) *model.AppError {
	recapChannel := &model.RecapChannel{
		Id:            model.NewId(),
		RecapId:       recapID,
		ChannelId:     channelID,
		ChannelName:   channelName,
		Highlights:    highlights,
		ActionItems:   actionItems,
		SourcePostIds: sourcePostIDs,
		CreateAt:      model.GetMillis(),
	}

	if err := a.Srv().Store().Recap().SaveRecapChannel(recapChannel); err != nil {
		return model.NewAppError("ProcessRecapChannel", "app.recap.save_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) fetchPostsForRecapWithFallback(rctx request.CTX, channelID string, since int64, limit int, allowRecentFallback bool) ([]*model.Post, *model.AppError) {
	// Get posts after lastViewedAt
	options := model.GetPostsSinceOptions{
		ChannelId: channelID,
		Time:      since,
	}

	postList, err := a.GetPostsSince(rctx, options)
	if err != nil {
		return nil, err
	}

	if allowRecentFallback && len(postList.Posts) == 0 {
		// If there are no unread posts, get the most recent 15 posts to include in the recap
		postList, err = a.GetPosts(rctx, channelID, 0, 20)
		if err != nil {
			return nil, err
		}
	}

	// Convert to slice and limit
	posts := make([]*model.Post, 0, len(postList.Posts))
	for _, postID := range postList.Order {
		if post, ok := postList.Posts[postID]; ok {
			posts = append(posts, post)
			if len(posts) >= limit {
				break
			}
		}
	}

	// Enrich with usernames
	for _, post := range posts {
		user, _ := a.GetUser(post.UserId)
		if user != nil {
			if post.Props == nil {
				post.Props = make(model.StringInterface)
			}
			post.AddProp("username", user.Username)
		}
	}

	return posts, nil
}

func recapFetchStartAt(timePeriod string, lastViewedAt int64, now time.Time) (int64, bool) {
	switch timePeriod {
	case model.TimePeriodLast24h:
		return now.Add(-24 * time.Hour).UnixMilli(), false
	case model.TimePeriodLastWeek:
		return now.Add(-7 * 24 * time.Hour).UnixMilli(), false
	case "", model.TimePeriodSinceLastRead:
		return lastViewedAt, true
	default:
		return lastViewedAt, true
	}
}

// extractPostIDs extracts post IDs from a slice of posts
func extractPostIDs(posts []*model.Post) []string {
	ids := make([]string, len(posts))
	for i, post := range posts {
		ids[i] = post.Id
	}
	return ids
}

func recapMaxChannelsExceededError(where string, limit int, requested int) *model.AppError {
	return model.NewAppError(where,
		"app.recap.max_channels_exceeded.app_error",
		map[string]any{
			"Limit":     limit,
			"Requested": requested,
		},
		"", http.StatusBadRequest)
}

func recapMaxRecapsReachedError(where string, limit int) *model.AppError {
	return model.NewAppError(where,
		"app.recap.max_recaps_reached.app_error",
		map[string]any{"Limit": limit},
		"", http.StatusBadRequest)
}

func (a *App) checkManualRecapCooldown(userID string, limits *model.EffectiveRecapLimits, where string) *model.AppError {
	if !model.IsLimitEnabled(limits.CooldownMinutes) || limits.CooldownMinutes <= 0 {
		return nil
	}

	lastManualRecap, storeErr := a.Srv().Store().Recap().GetLastCompletedManualRecap(userID)
	if storeErr != nil {
		return model.NewAppError(where,
			"app.recap.cooldown_check_failed.app_error",
			nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}
	if lastManualRecap == nil {
		return nil
	}

	cooldownEndTime := lastManualRecap.CreateAt + int64(limits.CooldownMinutes)*60*1000
	now := model.GetMillis()
	if now >= cooldownEndTime {
		return nil
	}

	remainingMs := cooldownEndTime - now
	remainingMinutes := int((remainingMs + 60000 - 1) / 60000)
	return model.NewAppError(where,
		"app.recap.cooldown_active.app_error",
		map[string]any{
			"CooldownMinutes":   limits.CooldownMinutes,
			"RetryAfterMinutes": remainingMinutes,
		},
		"", http.StatusTooManyRequests)
}

func (a *App) getRemainingPostsForRecap(userID string, recapID string) (int, *model.AppError) {
	const defaultFetchLimit = 100

	limits, limitsErr := a.GetEffectiveLimits()
	if limitsErr != nil {
		return 0, limitsErr
	}

	remaining := defaultFetchLimit
	currentRecapPosts, appErr := a.countCurrentRecapSourcePosts(recapID)
	if appErr != nil {
		return 0, appErr
	}

	if model.IsLimitEnabled(limits.MaxPostsPerRecap) {
		remaining = min(remaining, limits.MaxPostsPerRecap-currentRecapPosts)
	}

	if model.IsLimitEnabled(limits.MaxPostsPerDay) {
		startOfDayMillis, dayErr := a.getStartOfUserDayMillis(userID)
		if dayErr != nil {
			return 0, dayErr
		}

		usedToday, storeErr := a.Srv().Store().Recap().SumTotalMessageCountForUserSince(userID, startOfDayMillis)
		if storeErr != nil {
			return 0, model.NewAppError("ProcessRecapChannel", "app.recap.sum_daily_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
		remaining = min(remaining, limits.MaxPostsPerDay-int(usedToday)-currentRecapPosts)
	}

	if remaining < 0 {
		return 0, nil
	}
	return remaining, nil
}

// getRemainingTokensForRecap returns the per-channel token cap for a recap, or
// model.UnlimitedValue (-1) when token enforcement is disabled. It mirrors
// getRemainingPostsForRecap but is per-channel (see ProcessRecapChannelWithOptions).
func (a *App) getRemainingTokensForRecap(userID string) (int, *model.AppError) {
	limits, limitsErr := a.GetEffectiveLimits()
	if limitsErr != nil {
		return 0, limitsErr
	}
	return limits.MaxTokensPerRecap, nil
}

func (a *App) countCurrentRecapSourcePosts(recapID string) (int, *model.AppError) {
	recapChannels, storeErr := a.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
	if storeErr != nil {
		return 0, model.NewAppError("ProcessRecapChannel", "app.recap.get_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	count := 0
	for _, recapChannel := range recapChannels {
		count += len(recapChannel.SourcePostIds)
	}
	return count, nil
}

// estimateTokens estimates token count for text using conservative 4 chars/token heuristic.
// This is approximate - actual LLM tokenization varies by model.
func estimateTokens(text string) int {
	// Conservative estimate: 4 characters per token for English
	// This tends to overestimate, which is safer for context limits
	return (len(text) + 3) / 4 // Ceiling division
}

// estimatePostTokens estimates tokens for a single post
func estimatePostTokens(post *model.Post) int {
	return estimateTokens(post.Message)
}

// trimPostsToTokenLimit keeps the newest posts (front of the newest-first slice) whose
// cumulative estimated token count stays at or below maxTokens, dropping the rest.
// Returns the trimmed posts and whether any were dropped.
func trimPostsToTokenLimit(posts []*model.Post, maxTokens int) ([]*model.Post, bool) {
	total := 0
	for i, post := range posts {
		total += estimatePostTokens(post)
		if total > maxTokens {
			return posts[:i], true
		}
	}
	return posts, false
}
