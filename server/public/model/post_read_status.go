// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostReadStatus struct {
	PostId   string `json:"post_id"`
	UserId   string `json:"user_id"`
	CreateAt int64  `json:"create_at"`
}
