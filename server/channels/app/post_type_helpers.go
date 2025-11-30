// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost/server/public/model"

// shouldSkipWebSocketPublish returns true if this post type handles WebSocket events separately.
// Pages and page comments use custom WebSocket event handling in their respective functions.
func shouldSkipWebSocketPublish(post *model.Post) bool {
	return post.Type == model.PostTypePage || post.Type == model.PostTypePageComment
}

// shouldCallAfterCreateHook returns true if this post type needs after-create processing.
// Page comments that are thread roots need special handling for page comment threads.
func shouldCallAfterCreateHook(post *model.Post) bool {
	return post.Type == model.PostTypePageComment && post.RootId == ""
}

// shouldTransformReply returns true if this post type needs reply transformation.
// Page comments need their replies transformed to handle threading correctly.
func shouldTransformReply(post *model.Post) bool {
	return post.Type == model.PostTypePageComment
}

// shouldSendCommentDeletedEvent returns true if this post type needs a comment deleted event.
// Page comments need to send a custom WebSocket event when deleted.
func shouldSendCommentDeletedEvent(post *model.Post) bool {
	return post.Type == model.PostTypePageComment
}

// shouldUseCustomMentionParsing returns true if this post type uses custom mention parsing.
// Pages use explicit mentions from page content rather than post message.
func shouldUseCustomMentionParsing(post *model.Post) bool {
	return post.Type == model.PostTypePage
}
