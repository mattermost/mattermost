// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) channelExcludeMembershipSystemPostsByID(rctx request.CTX, channelID string) (bool, *model.AppError) {
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return false, nil
		}
		return false, appErr
	}
	return model.ShouldChannelExcludeMembershipSystemPosts(channel), nil
}

func (a *App) populateGetPostsOptionsMembershipFilter(rctx request.CTX, options *model.GetPostsOptions) *model.AppError {
	if options == nil || options.ChannelId == "" {
		return nil
	}

	exclude, appErr := a.channelExcludeMembershipSystemPostsByID(rctx, options.ChannelId)
	if appErr != nil {
		return appErr
	}
	options.ExcludeMembershipSystemPosts = exclude
	return nil
}

func (a *App) populateGetPostsSinceOptionsMembershipFilter(rctx request.CTX, options *model.GetPostsSinceOptions) *model.AppError {
	if options == nil || options.ChannelId == "" {
		return nil
	}

	exclude, appErr := a.channelExcludeMembershipSystemPostsByID(rctx, options.ChannelId)
	if appErr != nil {
		return appErr
	}
	options.ExcludeMembershipSystemPosts = exclude
	return nil
}

// shouldSuppressMembershipSystemPost reports whether push and email notifications
// for a membership system post should be dropped. It uses the caller-supplied
// channel object, which may be milliseconds stale if an admin toggled
// DisableJoinLeaveMessages concurrently. This is acceptable: the feature is
// best-effort for notification delivery; the DB read-path always reflects the
// current setting.
//
// Add-type posts (system_add_to_channel, system_add_guest_to_chan,
// system_add_to_team) are excluded from suppression so that the added user
// still receives push/email/desktop notifications even when join/leave messages
// are hidden in the channel. The WS posted event always fires; the webapp
// filters the post out of postsInChannel so it does not appear in the timeline.
func (a *App) shouldSuppressMembershipSystemPost(rctx request.CTX, channel *model.Channel, post *model.Post) bool {
	if !model.IsMembershipSystemPost(post) {
		return false
	}
	if model.IsAddMembershipSystemPost(post) {
		return false
	}
	return model.ShouldChannelExcludeMembershipSystemPosts(channel)
}

func (a *App) filterSuppressedMembershipPosts(rctx request.CTX, postList *model.PostList) *model.AppError {
	if postList == nil || len(postList.Posts) == 0 {
		return nil
	}

	channelExclude := map[string]bool{}
	channelCache := map[string]*model.Channel{}

	for postID, post := range postList.Posts {
		if !model.IsMembershipSystemPost(post) {
			continue
		}

		exclude, ok := channelExclude[post.ChannelId]
		if !ok {
			channel, cached := channelCache[post.ChannelId]
			if !cached {
				var appErr *model.AppError
				channel, appErr = a.GetChannel(rctx, post.ChannelId)
				if appErr != nil {
					return appErr
				}
				channelCache[post.ChannelId] = channel
			}

			exclude = model.ShouldChannelExcludeMembershipSystemPosts(channel)
			channelExclude[post.ChannelId] = exclude
		}

		if exclude {
			delete(postList.Posts, postID)
			postList.Order = removePostIDFromOrder(postList.Order, postID)
		}
	}

	return nil
}

func (a *App) filterSuppressedMembershipPostsFromSlice(rctx request.CTX, posts []*model.Post) ([]*model.Post, *model.AppError) {
	if len(posts) == 0 {
		return posts, nil
	}

	postList := model.NewPostList()
	for _, post := range posts {
		if post != nil {
			postList.AddPost(post)
			postList.Order = append(postList.Order, post.Id)
		}
	}

	if appErr := a.filterSuppressedMembershipPosts(rctx, postList); appErr != nil {
		return nil, appErr
	}

	filtered := make([]*model.Post, 0, len(postList.Posts))
	for _, postID := range postList.Order {
		if post, ok := postList.Posts[postID]; ok {
			filtered = append(filtered, post)
		}
	}

	return filtered, nil
}

func removePostIDFromOrder(order []string, postID string) []string {
	if len(order) == 0 {
		return order
	}
	filtered := make([]string, 0, len(order))
	for _, id := range order {
		if id != postID {
			filtered = append(filtered, id)
		}
	}
	return filtered
}
