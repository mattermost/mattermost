// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type NotifyAdminData struct {
	Id              string `json:"id,omitempty"`
	CreateAt        int64  `json:"create_at,omitempty"`
	UserId          string `json:"user_id"`
	RequiredPlan    string `json:"required_plan"`
	RequiredFeature string `json:"required_feature"`
	Trial           bool   `json:"trial"`
}

func (nad *NotifyAdminData) PreSave() {
	if nad.Id == "" {
		nad.Id = NewId()
	}

	nad.CreateAt = GetMillis()
}
