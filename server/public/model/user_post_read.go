// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type UserPostRead struct {
	UserID    string `json:"user_id"`
	PostID    string `json:"post_id"`
	CreatedAt int64  `json:"created_at"`
}
