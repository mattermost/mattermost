// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

type PostAcknowledgement struct {
	UserId         string  `json:"user_id"`
	PostId         string  `json:"post_id"`
	AcknowledgedAt int64   `json:"acknowledged_at"`
	ChannelId      string  `json:"channel_id"`
	RemoteId       *string `json:"remote_id,omitempty"`
}

func (o *PostAcknowledgement) IsValid() *AppError {
	if !IsValidId(o.UserId) {
		return NewAppError("PostAcknowledgement.IsValid", "model.acknowledgement.is_valid.user_id.app_error", nil, "user_id="+o.UserId, http.StatusBadRequest)
	}

	if !IsValidId(o.PostId) {
		return NewAppError("PostAcknowledgement.IsValid", "model.acknowledgement.is_valid.post_id.app_error", nil, "post_id="+o.PostId, http.StatusBadRequest)
	}

	if !IsValidId(o.ChannelId) {
		return NewAppError("PostAcknowledgement.IsValid", "model.acknowledgement.is_valid.channel_id.app_error", nil, "channel_id="+o.ChannelId, http.StatusBadRequest)
	}

	return nil
}

func (o *PostAcknowledgement) GetRemoteID() string {
	if o.RemoteId != nil {
		return *o.RemoteId
	}
	return ""
}

func (o *PostAcknowledgement) PreSave() {
	if o.AcknowledgedAt == 0 {
		o.AcknowledgedAt = GetMillis()
	}
}
