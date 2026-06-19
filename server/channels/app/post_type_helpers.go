// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
)

// shouldSkipWebSocketPublish returns true if this post type handles WebSocket events separately.
// Pages and page mentions use custom WebSocket event handling in their respective functions.
// Page comments use standard WebSocket events so they appear in the channel feed.
func shouldSkipWebSocketPublish(post *model.Post) bool {
	return slices.Contains(model.WikiPostTypesHiddenInFeed, post.Type)
}

// shouldCallAfterCreateHook returns true if this post type needs after-create processing.
// Page comment thread roots need special handling via handlePageCommentThreadCreation.
func shouldCallAfterCreateHook(post *model.Post) bool {
	return post.Type == model.PostTypePageComment && post.RootId == ""
}

func shouldTransformReply(post *model.Post) bool {
	return post.Type == model.PostTypePageComment
}

func shouldSendCommentDeletedEvent(post *model.Post) bool {
	return post.Type == model.PostTypePageComment
}

// shouldUseCustomMentionParsing returns true if this post type uses custom mention parsing.
// Pages use explicit mentions extracted from page content rather than the post message field.
func shouldUseCustomMentionParsing(post *model.Post) bool {
	return post.Type == model.PostTypePage
}

func IsPagePost(post *model.Post) bool {
	return post != nil && post.Type == model.PostTypePage
}

func IsPageComment(post *model.Post) bool {
	return post != nil && post.Type == model.PostTypePageComment
}
