// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

type PostAcknowledgement struct {
	UserId         string `json:"user_id"`
	PostId         string `json:"post_id"`
	Completed      bool   `json:"completed"`
	AcknowledgedAt int64  `json:"acknowledged_at"`
	CreateAt       int64  `json:"create_at"`
	DeleteAt       int64  `json:"delete_at"`
}

func (o *PostAcknowledgement) IsValid() *AppError {
	if !IsValidId(o.UserId) {
		return NewAppError("PostAcknowledgement.IsValid", "model.acknowledgement.is_valid.user_id.app_error", nil, "user_id="+o.UserId, http.StatusBadRequest)
	}

	if !IsValidId(o.PostId) {
		return NewAppError("PostAcknowledgement.IsValid", "model.acknowledgement.is_valid.post_id.app_error", nil, "post_id="+o.PostId, http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("PostAcknowledgement.IsValid", "model.acknowledgement.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
