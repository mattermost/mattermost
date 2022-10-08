// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostCreatedEvent struct {
	PostId  string `json:"post_id"`
	Message string `json:"message"`
}
