// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost/server/public/model"

// shouldSkipWebSocketPublish returns true if this post type handles WebSocket events separately.
// Pages use custom WebSocket event handling in their respective functions.
// Page comments use standard WebSocket events so they appear in the channel feed.
func shouldSkipWebSocketPublish(post *model.Post) bool {
	return post.Type == model.PostTypePage
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

// IsPagePost returns true if the post is a wiki page.
func IsPagePost(post *model.Post) bool {
	return post != nil && post.Type == model.PostTypePage
}

// IsPageComment returns true if the post is a page comment.
func IsPageComment(post *model.Post) bool {
	return post != nil && post.Type == model.PostTypePageComment
}

// IsPageRelatedPost returns true if the post is either a page or a page comment.
func IsPageRelatedPost(post *model.Post) bool {
	return IsPagePost(post) || IsPageComment(post)
}

// HasRelaxedEditHistoryPermissions returns true if this post type allows any channel member
// to view edit history (not just the author). Pages follow industry standard (Confluence, etc.)
// where any member can view version history.
func HasRelaxedEditHistoryPermissions(post *model.Post) bool {
	return IsPagePost(post)
}

// RequiresPageModifyPermission returns true if this post type needs page-specific
// permission checking in the API layer instead of generic post permissions.
func RequiresPageModifyPermission(post *model.Post) bool {
	return IsPagePost(post)
}

// NeedsContentLoading returns true if this post type stores content separately
// and needs content loaded from PageContent table.
func NeedsContentLoading(post *model.Post) bool {
	return IsPagePost(post)
}
