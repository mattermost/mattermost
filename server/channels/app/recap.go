// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CreateRecap creates a new recap job for the specified channels
func (a *App) CreateRecap(rctx request.CTX, title string, channelIDs []string, agentID string) (*model.Recap, *model.AppError) {
	userID := rctx.Session().UserId

	// Validate user is member of all channels
	for _, channelID := range channelIDs {
		if ok, _ := a.HasPermissionToChannel(rctx, userID, channelID, model.PermissionReadChannel); !ok {
			return nil, model.NewAppError("CreateRecap", "app.recap.permission_denied", nil, "", http.StatusForbidden)
		}
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

	savedRecap, err := a.Srv().Store().Recap().SaveRecap(recap)
	if err != nil {
		return nil, model.NewAppError("CreateRecap", "app.recap.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

// RegenerateRecap regenerates an existing recap
func (a *App) RegenerateRecap(rctx request.CTX, userID string, recap *model.Recap) (*model.Recap, *model.AppError) {
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

	// Delete existing recap channels
	if deleteErr := a.Srv().Store().Recap().DeleteRecapChannels(recapID); deleteErr != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.delete_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	// Update recap status to pending and reset read status
	recap.Status = model.RecapStatusPending
	recap.ReadAt = 0
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

// ProcessRecapChannel processes a single channel for a recap, fetching posts, summarizing them,
// and saving the recap channel record. Returns the number of messages processed.
func (a *App) ProcessRecapChannel(rctx request.CTX, recapID, channelID, userID, agentID string) (*model.RecapChannelResult, *model.AppError) {
	result := &model.RecapChannelResult{
		ChannelID: channelID,
		Success:   false,
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

	// Fetch posts for recap
	posts, postsErr := a.fetchPostsForRecap(rctx, channelID, lastViewedAt, 100)
	if postsErr != nil {
		return result, postsErr
	}

	// No posts to summarize - return success with 0 messages
	if len(posts) == 0 {
		result.Success = true
		return result, nil
	}

	// Get team info for permalink generation
	team, teamErr := a.GetTeam(channel.TeamId)
	if teamErr != nil {
		return result, model.NewAppError("ProcessRecapChannel", "app.recap.get_team.app_error", nil, "", http.StatusInternalServerError).Wrap(teamErr)
	}

	// Summarize posts
	summary, err := a.SummarizePosts(rctx, userID, posts, channel.DisplayName, team.Name, agentID)
	if err != nil {
		return result, err
	}

	// Save recap channel
	recapChannel := &model.RecapChannel{
		Id:            model.NewId(),
		RecapId:       recapID,
		ChannelId:     channelID,
		ChannelName:   channel.DisplayName,
		Highlights:    summary.Highlights,
		ActionItems:   summary.ActionItems,
		SourcePostIds: extractPostIDs(posts),
		CreateAt:      model.GetMillis(),
	}

	if err := a.Srv().Store().Recap().SaveRecapChannel(recapChannel); err != nil {
		return result, model.NewAppError("ProcessRecapChannel", "app.recap.save_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	result.MessageCount = len(posts)
	result.Success = true
	return result, nil
}

// fetchPostsForRecap fetches posts for a channel after the given timestamp and enriches them with user information
func (a *App) fetchPostsForRecap(rctx request.CTX, channelID string, lastViewedAt int64, limit int) ([]*model.Post, *model.AppError) {
	// Get posts after lastViewedAt
	options := model.GetPostsSinceOptions{
		ChannelId: channelID,
		Time:      lastViewedAt,
	}

	postList, err := a.GetPostsSince(rctx, options)
	if err != nil {
		return nil, err
	}

	if len(postList.Posts) == 0 {
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

// extractPostIDs extracts post IDs from a slice of posts
func extractPostIDs(posts []*model.Post) []string {
	ids := make([]string, len(posts))
	for i, post := range posts {
		ids[i] = post.Id
	}
	return ids
}
