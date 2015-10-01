// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	POST_DEFAULT    = ""
	POST_JOIN_LEAVE = "join_leave"
)

type Post struct {
	Id            string      `json:"id"`
	CreateAt      int64       `json:"create_at"`
	UpdateAt      int64       `json:"update_at"`
	DeleteAt      int64       `json:"delete_at"`
	UserId        string      `json:"user_id"`
	ChannelId     string      `json:"channel_id"`
	RootId        string      `json:"root_id"`
	ParentId      string      `json:"parent_id"`
	OriginalId    string      `json:"original_id"`
	Message       string      `json:"message"`
	ImgCount      int64       `json:"img_count"`
	Type          string      `json:"type"`
	Props         StringMap   `json:"props"`
	Hashtags      string      `json:"hashtags"`
	Filenames     StringArray `json:"filenames"`
	PendingPostId string      `json:"pending_post_id" db:"-"`
}

func (o *Post) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func PostFromJson(data io.Reader) *Post {
	decoder := json.NewDecoder(data)
	var o Post
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Post) Etag() string {
	return Etag(o.Id, o.UpdateAt)
}

func (o *Post) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("Post.IsValid", "Invalid Id", "")
	}

	if o.CreateAt == 0 {
		return NewAppError("Post.IsValid", "Create at must be a valid time", "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Post.IsValid", "Update at must be a valid time", "id="+o.Id)
	}

	if len(o.UserId) != 26 {
		return NewAppError("Post.IsValid", "Invalid user id", "")
	}

	if len(o.ChannelId) != 26 {
		return NewAppError("Post.IsValid", "Invalid channel id", "")
	}

	if !(len(o.RootId) == 26 || len(o.RootId) == 0) {
		return NewAppError("Post.IsValid", "Invalid root id", "")
	}

	if !(len(o.ParentId) == 26 || len(o.ParentId) == 0) {
		return NewAppError("Post.IsValid", "Invalid parent id", "")
	}

	if len(o.ParentId) == 26 && len(o.RootId) == 0 {
		return NewAppError("Post.IsValid", "Invalid root id must be set if parent id set", "")
	}

	if !(len(o.OriginalId) == 26 || len(o.OriginalId) == 0) {
		return NewAppError("Post.IsValid", "Invalid original id", "")
	}

	if len(o.Message) > 4000 {
		return NewAppError("Post.IsValid", "Invalid message", "id="+o.Id)
	}

	if len(o.Hashtags) > 1000 {
		return NewAppError("Post.IsValid", "Invalid hashtags", "id="+o.Id)
	}

	if !(o.Type == POST_DEFAULT || o.Type == POST_JOIN_LEAVE) {
		return NewAppError("Post.IsValid", "Invalid type", "id="+o.Type)
	}

	if len(ArrayToJson(o.Filenames)) > 4000 {
		return NewAppError("Post.IsValid", "Invalid filenames", "id="+o.Id)
	}

	return nil
}

func (o *Post) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.OriginalId = ""

	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}

	o.UpdateAt = o.CreateAt

	if o.Props == nil {
		o.Props = make(map[string]string)
	}

	if o.Filenames == nil {
		o.Filenames = []string{}
	}
}

func (o *Post) MakeNonNil() {
	if o.Props == nil {
		o.Props = make(map[string]string)
	}
	if o.Filenames == nil {
		o.Filenames = []string{}
	}
}

func (o *Post) AddProp(key string, value string) {

	o.MakeNonNil()

	o.Props[key] = value
}

func (o *Post) PreExport() {
}
