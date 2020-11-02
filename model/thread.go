// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
)

type Thread struct {
	PostId       string      `json:"id"`
	ChannelId    string      `json:"channel_id"`
	ReplyCount   int64       `json:"reply_count"`
	LastReplyAt  int64       `json:"last_reply_at"`
	Participants StringArray `json:"participants"`
}

func (o *Thread) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func (o *Thread) Etag() string {
	return Etag(o.PostId, o.LastReplyAt)
}

type ThreadMembership struct {
	PostId      string `json:"post_id"`
	UserId      string `json:"user_id"`
	Following   bool   `json:"following"`
	LastViewed  int64  `json:"last_view_at"`
	LastUpdated int64  `json:"last_update_at"`
}

func (o *ThreadMembership) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}
