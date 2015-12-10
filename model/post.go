// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"encoding/json"
	"io"
	"unicode/utf8"
)

const (
	POST_SYSTEM_MESSAGE_PREFIX = "system_"
	POST_DEFAULT               = ""
	POST_SLACK_ATTACHMENT      = "slack_attachment"
	POST_JOIN_LEAVE            = "system_join_leave"
	POST_HEADER_CHANGE         = "system_header_change"
)

type Post struct {
	Id            string          `json:"id"`
	CreateAt      int64           `json:"create_at"`
	UpdateAt      int64           `json:"update_at"`
	DeleteAt      int64           `json:"delete_at"`
	UserId        string          `json:"user_id"`
	ChannelId     string          `json:"channel_id"`
	RootId        string          `json:"root_id"`
	ParentId      string          `json:"parent_id"`
	OriginalId    string          `json:"original_id"`
	Message       string          `json:"message"`
	Type          string          `json:"type"`
	Props         StringInterface `json:"props"`
	Hashtags      string          `json:"hashtags"`
	Filenames     StringArray     `json:"filenames"`
	PendingPostId string          `json:"pending_post_id" db:"-"`
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

func (o *Post) IsValid(T goi18n.TranslateFunc) *AppError {

	if len(o.Id) != 26 {
		return NewAppError("Post.IsValid", T("Invalid Id"), "")
	}

	if o.CreateAt == 0 {
		return NewAppError("Post.IsValid", T("Create at must be a valid time"), "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Post.IsValid", T("Update at must be a valid time"), "id="+o.Id)
	}

	if len(o.UserId) != 26 {
		return NewAppError("Post.IsValid", T("Invalid user id"), "")
	}

	if len(o.ChannelId) != 26 {
		return NewAppError("Post.IsValid", T("Invalid channel id"), "")
	}

	if !(len(o.RootId) == 26 || len(o.RootId) == 0) {
		return NewAppError("Post.IsValid", T("Invalid root id"), "")
	}

	if !(len(o.ParentId) == 26 || len(o.ParentId) == 0) {
		return NewAppError("Post.IsValid", T("Invalid parent id"), "")
	}

	if len(o.ParentId) == 26 && len(o.RootId) == 0 {
		return NewAppError("Post.IsValid", T("Invalid root id must be set if parent id set"), "")
	}

	if !(len(o.OriginalId) == 26 || len(o.OriginalId) == 0) {
		return NewAppError("Post.IsValid", T("Invalid original id"), "")
	}

	if utf8.RuneCountInString(o.Message) > 4000 {
		return NewAppError("Post.IsValid", T("Invalid message"), "id="+o.Id)
	}

	if utf8.RuneCountInString(o.Hashtags) > 1000 {
		return NewAppError("Post.IsValid", T("Invalid hashtags"), "id="+o.Id)
	}

	// should be removed once more message types are supported
	if !(o.Type == POST_DEFAULT || o.Type == POST_JOIN_LEAVE || o.Type == POST_SLACK_ATTACHMENT || o.Type == POST_HEADER_CHANGE) {
		return NewAppError("Post.IsValid", T("Invalid type"), "id="+o.Type)
	}

	if utf8.RuneCountInString(ArrayToJson(o.Filenames)) > 4000 {
		return NewAppError("Post.IsValid", T("Invalid filenames"), "id="+o.Id)
	}

	if utf8.RuneCountInString(StringInterfaceToJson(o.Props)) > 8000 {
		return NewAppError("Post.IsValid", "Invalid props", "id="+o.Id)
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
		o.Props = make(map[string]interface{})
	}

	if o.Filenames == nil {
		o.Filenames = []string{}
	}
}

func (o *Post) MakeNonNil() {
	if o.Props == nil {
		o.Props = make(map[string]interface{})
	}
	if o.Filenames == nil {
		o.Filenames = []string{}
	}
}

func (o *Post) AddProp(key string, value interface{}) {

	o.MakeNonNil()

	o.Props[key] = value
}

func (o *Post) PreExport() {
}

func (o *Post) IsSystemMessage() bool {
	return len(o.Type) >= len(POST_SYSTEM_MESSAGE_PREFIX) && o.Type[:len(POST_SYSTEM_MESSAGE_PREFIX)] == POST_SYSTEM_MESSAGE_PREFIX
}
