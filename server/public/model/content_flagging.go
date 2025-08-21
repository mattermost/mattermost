// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"slices"
	"unicode/utf8"
)

const ContentFlaggingGroupName = "content_flagging"
const commentMaxRunes = 1000

const (
	ContentFlaggingStatusPending  = "pending"
	ContentFlaggingStatusAssigned = "assigned"
	ContentFlaggingStatusRemoved  = "removed"
	ContentFlaggingStatusRetained = "retained"
)

type FlagContentRequest struct {
	Reason  string `json:"reason"`
	Comment string `json:"comment,omitempty"`
}

func (f *FlagContentRequest) IsValid(commentRequired bool, validReasons []string) *AppError {
	if f.Reason == "" {
		return NewAppError("FlagContentRequest.IsValid", "api.content_flagging.error.reason_required", nil, "", http.StatusBadRequest)
	}

	if !slices.Contains(validReasons, f.Reason) {
		return NewAppError("FlagContentRequest.IsValid", "api.content_flagging.error.reason_invalid", nil, "", http.StatusBadRequest)
	}

	if commentRequired && f.Comment == "" {
		return NewAppError("FlagContentRequest.IsValid", "api.content_flagging.error.comment_required", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(f.Comment) > commentMaxRunes {
		return NewAppError("FlagContentRequest.IsValid", "api.content_flagging.error.comment_too_long", nil, "", http.StatusBadRequest)
	}

	return nil
}
