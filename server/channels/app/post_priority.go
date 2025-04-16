// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"errors"
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

	// Retrieve the current post to ensure we have the latest version
	currentPost, err := a.GetSinglePost(c, post.Id, false)
	if err != nil {
		return nil, err
	}

	// For remote posts or when dealing with updates to just priority metadata,
	// use the enhanced PostPriorityStore.Save method that handles all priority aspects
	if post.IsRemote() || currentPost.IsRemote() {
		// Create priority object with all necessary fields
		postPriority := &model.PostPriority{
			PostId:                  post.Id,
			ChannelId:               post.ChannelId,
			Priority:                post.Metadata.Priority.Priority,
			RequestedAck:            post.Metadata.Priority.RequestedAck,
			PersistentNotifications: post.Metadata.Priority.PersistentNotifications,
		}

		// Use the enhanced store method to save priority and handle persistent notifications
		_, nErr := a.Srv().Store().PostPriority().Save(postPriority)
		if nErr != nil {
			return nil, model.NewAppError("SavePriorityForPost", "app.post.save_priority.store_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}

		// Ensure the metadata is properly set in the returned post
		if currentPost.Metadata == nil {
			currentPost.Metadata = &model.PostMetadata{}
		}
		currentPost.Metadata.Priority = post.Metadata.Priority

		return currentPost, nil
	}

	// For non-remote regular posts, use the standard approach
	postCopy := currentPost.Clone()

	// Create metadata if it doesn't exist
	if postCopy.Metadata == nil {
		postCopy.Metadata = &model.PostMetadata{}
	}

	// Update the priority metadata
	postCopy.Metadata.Priority = post.Metadata.Priority

	// Save the post with updated metadata
	savedPost, nErr := a.Srv().Store().Post().Save(c, postCopy)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SavePriorityForPost", "app.post.save_priority.save_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	// The post is always modified since the UpdateAt always changes
	channel, channelErr := a.GetChannel(c, postCopy.ChannelId)
	if channelErr == nil {
		a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)
	}

	return savedPost, nil
}

func (a *App) IsPostPriorityEnabled() bool {
	return *a.Config().ServiceSettings.PostPriority
}
