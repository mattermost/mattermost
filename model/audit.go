// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type Audit struct {
	Id        string `json:"id"`
	CreateAt  int64  `json:"create_at"`
	UserId    string `json:"user_id"`
	Action    string `json:"action"`
	ExtraInfo string `json:"extra_info"`
	IpAddress string `json:"ip_address"`
	SessionId string `json:"session_id"`
}
