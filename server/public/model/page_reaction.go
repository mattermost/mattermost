// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"regexp"
)

var validPageReactionEmojiName = regexp.MustCompile(`^[a-zA-Z0-9\-\+_]+$`)

// PageReaction is an emoji reaction on a wiki page. It lives in the dedicated
// PageReactions table, leaving the platform-wide Reactions table untouched. It is the
// Reaction field set minus PostId and UpdateAt (reactions are immutable — created or
// hard-deleted, never updated).
type PageReaction struct {
	PageId    string `json:"page_id"`
	UserId    string `json:"user_id"`
	EmojiName string `json:"emoji_name"`
	CreateAt  int64  `json:"create_at"`
	ChannelId string `json:"channel_id"` // set server-side from page.ChannelId; for access resolution, not uniqueness
	// RemoteId is a plain string ("" = no remote), matching the NOT NULL DEFAULT '' column.
	// Reaction uses *string + GetRemoteID() for the shared-channel sync pipeline; PageReactions
	// are not synced, so the simpler string form is used. Switch to *string if sync is added.
	RemoteId string `json:"remote_id"`
}

func (r *PageReaction) PreSave() {
	if r.CreateAt == 0 {
		r.CreateAt = GetMillis()
	}
}

func (r *PageReaction) IsValid() *AppError {
	if !IsValidId(r.PageId) {
		return NewAppError("PageReaction.IsValid", "model.page_reaction.is_valid.page_id.app_error", nil, "page_id="+r.PageId, http.StatusBadRequest)
	}

	if !IsValidId(r.UserId) {
		return NewAppError("PageReaction.IsValid", "model.page_reaction.is_valid.user_id.app_error", nil, "user_id="+r.UserId, http.StatusBadRequest)
	}

	if r.EmojiName == "" || len(r.EmojiName) > EmojiNameMaxLength || !validPageReactionEmojiName.MatchString(r.EmojiName) {
		return NewAppError("PageReaction.IsValid", "model.page_reaction.is_valid.emoji_name.app_error", nil, "emoji_name="+r.EmojiName, http.StatusBadRequest)
	}

	if r.CreateAt == 0 {
		return NewAppError("PageReaction.IsValid", "model.page_reaction.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
