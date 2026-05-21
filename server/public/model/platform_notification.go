// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"unicode/utf8"
)

const PlatformNotificationMaxPerUser = 500

type PlatformNotification struct {
	Id                 string      `json:"id"`
	UserId             string      `json:"user_id"`
	PostId             string      `json:"post_id"`
	ChannelId          string      `json:"channel_id"`
	TeamId             string      `json:"team_id"`
	RecordedAt         int64       `json:"recorded_at"`
	ReadAt             int64       `json:"read_at,omitempty"`
	ChannelDisplayName string      `json:"channel_display_name"`
	ContextLabel       string      `json:"context_label"`
	PermalinkUrl       string      `json:"permalink_url"`
	IsThreadReply      bool        `json:"is_thread_reply"`
	IsMention          bool        `json:"is_mention,omitempty"`
	IsDirectMessage    bool        `json:"is_direct_message,omitempty"`
	SenderUserId       string      `json:"sender_user_id,omitempty"`
	ThreadRootId       string      `json:"thread_root_id,omitempty"`
	ReplyCount         int         `json:"reply_count,omitempty"`
	ParticipantUserIds StringArray `json:"participant_user_ids,omitempty"`
	PreviewBody        string      `json:"preview_body"`
}

func (o *PlatformNotification) IsValid() *AppError {
	if o.Id == "" {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.PostId) {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.post_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.ChannelId) {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.TeamId != "" && !IsValidId(o.TeamId) {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.team_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.RecordedAt == 0 {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.recorded_at.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.PreviewBody) > 4000 {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.preview_body.app_error", nil, "", http.StatusBadRequest)
	}

	if o.SenderUserId != "" && !IsValidId(o.SenderUserId) {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.sender_user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.ThreadRootId != "" && !IsValidId(o.ThreadRootId) {
		return NewAppError("PlatformNotification.IsValid", "model.platform_notification.is_valid.thread_root_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *PlatformNotification) PreSave() {
	if o.ParticipantUserIds == nil {
		o.ParticipantUserIds = StringArray{}
	}
}
