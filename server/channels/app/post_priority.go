// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GetPriorityForPost(postId string) (*model.PostPriority, *model.AppError) {
	priority, err := a.Srv().Store().PostPriority().GetForPost(postId)

	if err != nil && err != sql.ErrNoRows {
		return nil, model.NewAppError("GetPriorityForPost", "app.post_prority.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return priority, nil
}

func (a *App) GetPriorityForPostList(list *model.PostList) (map[string]*model.PostPriority, *model.AppError) {
	priority, err := a.Srv().Store().PostPriority().GetForPosts(list.Order)
	if err != nil {
		return nil, model.NewAppError("GetPriorityForPost", "app.post_prority.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	priorityMap := make(map[string]*model.PostPriority)
	for _, p := range priority {
		priorityMap[p.PostId] = p
	}

	return priorityMap, nil
}

func (a *App) SavePriorityForPost(c request.CTX, post *model.Post) (*model.Post, *model.AppError) {
	if post.Metadata == nil || post.Metadata.Priority == nil {
		return post, nil
	}

	// If we have a complete post with CreateAt already set, use it directly
	// Otherwise, retrieve the current post from the database
	var currentPost *model.Post
	var err *model.AppError

	if post.CreateAt > 0 {
		// We have a complete post, use it directly
		currentPost = post
	} else {
		// Retrieve the current post to ensure we have the latest version
		currentPost, err = a.GetSinglePost(c, post.Id, false)
		if err != nil {
			return nil, err
		}
	}

	// Transfer priority metadata from post to currentPost
	if currentPost.Metadata == nil {
		currentPost.Metadata = &model.PostMetadata{}
	}
	currentPost.Metadata.Priority = post.Metadata.Priority

	// Create priority object with all necessary fields from currentPost
	postPriority := &model.PostPriority{
		PostId:                  currentPost.Id,
		ChannelId:               currentPost.ChannelId,
		Priority:                currentPost.Metadata.Priority.Priority,
		RequestedAck:            currentPost.Metadata.Priority.RequestedAck,
		PersistentNotifications: currentPost.Metadata.Priority.PersistentNotifications,
	}

	// Save priority to the PostsPriority table
	savedPriority, nErr := a.Srv().Store().PostPriority().Save(postPriority)
	if nErr != nil {
		return nil, model.NewAppError("SavePriorityForPost", "app.post.save_priority.store_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	// Update the post's metadata with the saved priority
	currentPost.Metadata.Priority = savedPriority

	// Invalidate the cache if needed
	channel, channelErr := a.GetChannel(c, currentPost.ChannelId)
	if channelErr == nil {
		a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)
	}

	return currentPost, nil
}

func (a *App) IsPostPriorityEnabled() bool {
	return *a.Config().ServiceSettings.PostPriority
}
