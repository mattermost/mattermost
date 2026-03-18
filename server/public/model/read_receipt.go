// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type ReadReceipt struct {
	PostID   string `json:"post_id"`
	UserID   string `json:"user_id"`
	ExpireAt int64  `json:"expire_at"`
}
