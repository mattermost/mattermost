// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import "net/http"

type GroupMember struct {
	GroupId  string `json:"group_id"`
	UserId   string `json:"user_id"`
	CreateAt int64  `json:"create_at"`
	DeleteAt int64  `json:"delete_at"`
}

func (gm *GroupMember) IsValid() *AppError {
	if len(gm.GroupId) != 26 {
		return NewAppError("GroupMember.IsValid", "model.group_member.group_id.app_error", nil, "", http.StatusBadRequest)
	}
	if len(gm.UserId) != 26 {
		return NewAppError("GroupMember.IsValid", "model.group_member.user_id.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}
