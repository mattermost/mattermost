// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"unicode/utf8"
)

const (
	CHANNEL_OPEN    = "O"
	CHANNEL_PRIVATE = "P"
	CHANNEL_DIRECT  = "D"
	DEFAULT_CHANNEL = "town-square"
)

type Channel struct {
	Id            string `json:"id"`
	CreateAt      int64  `json:"create_at"`
	UpdateAt      int64  `json:"update_at"`
	DeleteAt      int64  `json:"delete_at"`
	TeamId        string `json:"team_id"`
	Type          string `json:"type"`
	DisplayName   string `json:"display_name"`
	Name          string `json:"name"`
	Header        string `json:"header"`
	Purpose       string `json:"purpose"`
	LastPostAt    int64  `json:"last_post_at"`
	TotalMsgCount int64  `json:"total_msg_count"`
	ExtraUpdateAt int64  `json:"extra_update_at"`
	CreatorId     string `json:"creator_id"`
}

func (o *Channel) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelFromJson(data io.Reader) *Channel {
	decoder := json.NewDecoder(data)
	var o Channel
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Channel) Etag() string {
	return Etag(o.Id, o.UpdateAt)
}

func (o *Channel) ExtraEtag(memberLimit int) string {
	return Etag(o.Id, o.ExtraUpdateAt, memberLimit)
}

func (o *Channel) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.id.app_error", nil, "")
	}

	if o.CreateAt == 0 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.create_at.app_error", nil, "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.update_at.app_error", nil, "id="+o.Id)
	}

	if utf8.RuneCountInString(o.DisplayName) > 64 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.display_name.app_error", nil, "id="+o.Id)
	}

	if len(o.Name) > 64 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.name.app_error", nil, "id="+o.Id)
	}

	if !IsValidChannelIdentifier(o.Name) {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.2_or_more.app_error", nil, "id="+o.Id)
	}

	if !(o.Type == CHANNEL_OPEN || o.Type == CHANNEL_PRIVATE || o.Type == CHANNEL_DIRECT) {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.type.app_error", nil, "id="+o.Id)
	}

	if utf8.RuneCountInString(o.Header) > 1024 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.header.app_error", nil, "id="+o.Id)
	}

	if utf8.RuneCountInString(o.Purpose) > 128 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.purpose.app_error", nil, "id="+o.Id)
	}

	if len(o.CreatorId) > 26 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.creator_id.app_error", nil, "")
	}

	return nil
}

func (o *Channel) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
	o.ExtraUpdateAt = o.CreateAt
}

func (o *Channel) PreUpdate() {
	o.UpdateAt = GetMillis()
}

func (o *Channel) ExtraUpdated() {
	o.ExtraUpdateAt = GetMillis()
}

func GetDMNameFromIds(userId1, userId2 string) string {
	if userId1 > userId2 {
		return userId2 + "__" + userId1
	} else {
		return userId1 + "__" + userId2
	}
}
