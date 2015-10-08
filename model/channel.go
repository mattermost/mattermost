// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
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
	Description   string `json:"description"`
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

func (o *Channel) ExtraEtag() string {
	return Etag(o.Id, o.ExtraUpdateAt)
}

func (o *Channel) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("Channel.IsValid", "Invalid Id", "")
	}

	if o.CreateAt == 0 {
		return NewAppError("Channel.IsValid", "Create at must be a valid time", "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Channel.IsValid", "Update at must be a valid time", "id="+o.Id)
	}

	if len(o.DisplayName) > 64 {
		return NewAppError("Channel.IsValid", "Invalid display name", "id="+o.Id)
	}

	if len(o.Name) > 64 {
		return NewAppError("Channel.IsValid", "Invalid name", "id="+o.Id)
	}

	if !IsValidChannelIdentifier(o.Name) {
		return NewAppError("Channel.IsValid", "Name must be 2 or more lowercase alphanumeric characters", "id="+o.Id)
	}

	if !(o.Type == CHANNEL_OPEN || o.Type == CHANNEL_PRIVATE || o.Type == CHANNEL_DIRECT) {
		return NewAppError("Channel.IsValid", "Invalid type", "id="+o.Id)
	}

	if len(o.Description) > 1024 {
		return NewAppError("Channel.IsValid", "Invalid description", "id="+o.Id)
	}

	if len(o.CreatorId) > 26 {
		return NewAppError("Channel.IsValid", "Invalid creator id", "")
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

func (o *Channel) PreExport() {
}

func GetDMNameFromIds(userId1, userId2 string) string {
	if userId1 > userId2 {
		return userId2 + "__" + userId1
	} else {
		return userId1 + "__" + userId2
	}
}
