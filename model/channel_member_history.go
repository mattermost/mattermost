// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"net/http"
	"strings"
)

type ChannelMemberHistory struct {
	ChannelId string
	UserId    string
	UserEmail string `db:"Email"`
	JoinTime  int64
	LeaveTime *int64
}

func (o *ChannelMemberHistory) IsValid() *AppError {
	if len(o.ChannelId) > 26 {
		return NewAppError("ChannelMemberHistory.IsValid", "model.channel_member_history.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.UserId) > 26 {
		return NewAppError("ChannelMemberHistory.IsValid", "model.channel_member_history.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !strings.Contains(o.UserEmail, "@") {
		return NewAppError("ChannelMemberHistory.IsValid", "model.channel_member_history.is_valid.user_email.app_error", nil, "", http.StatusBadRequest)
	}

	if o.JoinTime <= 0 {
		return NewAppError("ChannelMemberHistory.IsValid", "model.channel_member_history.is_valid.join_time.app_error", nil, "", http.StatusBadRequest)
	}

	if o.LeaveTime != nil && *o.LeaveTime <= 0 {
		return NewAppError("ChannelMemberHistory.IsValid", "model.channel_member_history.is_valid.leave_time.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
