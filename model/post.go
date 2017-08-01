// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"unicode/utf8"
)

const (
	POST_SYSTEM_MESSAGE_PREFIX = "system_"
	POST_DEFAULT               = ""
	POST_SLACK_ATTACHMENT      = "slack_attachment"
	POST_SYSTEM_GENERIC        = "system_generic"
	POST_JOIN_LEAVE            = "system_join_leave" // Deprecated, use POST_JOIN_CHANNEL or POST_LEAVE_CHANNEL instead
	POST_JOIN_CHANNEL          = "system_join_channel"
	POST_LEAVE_CHANNEL         = "system_leave_channel"
	POST_ADD_REMOVE            = "system_add_remove" // Deprecated, use POST_ADD_TO_CHANNEL or POST_REMOVE_FROM_CHANNEL instead
	POST_ADD_TO_CHANNEL        = "system_add_to_channel"
	POST_REMOVE_FROM_CHANNEL   = "system_remove_from_channel"
	POST_HEADER_CHANGE         = "system_header_change"
	POST_DISPLAYNAME_CHANGE    = "system_displayname_change"
	POST_PURPOSE_CHANGE        = "system_purpose_change"
	POST_CHANNEL_DELETED       = "system_channel_deleted"
	POST_EPHEMERAL             = "system_ephemeral"
	POST_FILEIDS_MAX_RUNES     = 150
	POST_FILENAMES_MAX_RUNES   = 4000
	POST_HASHTAGS_MAX_RUNES    = 1000
	POST_MESSAGE_MAX_RUNES     = 4000
	POST_PROPS_MAX_RUNES       = 8000
)

type Post struct {
	Id            string          `json:"id"`
	CreateAt      int64           `json:"create_at"`
	UpdateAt      int64           `json:"update_at"`
	EditAt        int64           `json:"edit_at"`
	DeleteAt      int64           `json:"delete_at"`
	IsPinned      bool            `json:"is_pinned"`
	UserId        string          `json:"user_id"`
	ChannelId     string          `json:"channel_id"`
	RootId        string          `json:"root_id"`
	ParentId      string          `json:"parent_id"`
	OriginalId    string          `json:"original_id"`
	Message       string          `json:"message"`
	Type          string          `json:"type"`
	Props         StringInterface `json:"props"`
	Hashtags      string          `json:"hashtags"`
	Filenames     StringArray     `json:"filenames,omitempty"` // Deprecated, do not use this field any more
	FileIds       StringArray     `json:"file_ids,omitempty"`
	PendingPostId string          `json:"pending_post_id" db:"-"`
	HasReactions  bool            `json:"has_reactions,omitempty"`
}

type PostPatch struct {
	IsPinned     *bool            `json:"is_pinned"`
	Message      *string          `json:"message"`
	Props        *StringInterface `json:"props"`
	FileIds      *StringArray     `json:"file_ids"`
	HasReactions *bool            `json:"has_reactions"`
}

type PostForIndexing struct {
	Post
	TeamId         string `json:"team_id"`
	ParentCreateAt *int64 `json:"parent_create_at"`
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
		return NewLocAppError("Post.IsValid", "model.post.is_valid.id.app_error", nil, "")
	}

	if o.CreateAt == 0 {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.create_at.app_error", nil, "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.update_at.app_error", nil, "id="+o.Id)
	}

	if len(o.UserId) != 26 {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.user_id.app_error", nil, "")
	}

	if len(o.ChannelId) != 26 {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.channel_id.app_error", nil, "")
	}

	if !(len(o.RootId) == 26 || len(o.RootId) == 0) {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.root_id.app_error", nil, "")
	}

	if !(len(o.ParentId) == 26 || len(o.ParentId) == 0) {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.parent_id.app_error", nil, "")
	}

	if len(o.ParentId) == 26 && len(o.RootId) == 0 {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.root_parent.app_error", nil, "")
	}

	if !(len(o.OriginalId) == 26 || len(o.OriginalId) == 0) {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.original_id.app_error", nil, "")
	}

	if utf8.RuneCountInString(o.Message) > POST_MESSAGE_MAX_RUNES {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.msg.app_error", nil, "id="+o.Id)
	}

	if utf8.RuneCountInString(o.Hashtags) > POST_HASHTAGS_MAX_RUNES {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.hashtags.app_error", nil, "id="+o.Id)
	}

	// should be removed once more message types are supported
	if !(o.Type == POST_DEFAULT || o.Type == POST_JOIN_LEAVE || o.Type == POST_ADD_REMOVE ||
		o.Type == POST_JOIN_CHANNEL || o.Type == POST_LEAVE_CHANNEL ||
		o.Type == POST_REMOVE_FROM_CHANNEL || o.Type == POST_ADD_TO_CHANNEL ||
		o.Type == POST_SLACK_ATTACHMENT || o.Type == POST_HEADER_CHANGE || o.Type == POST_PURPOSE_CHANGE ||
		o.Type == POST_DISPLAYNAME_CHANGE || o.Type == POST_CHANNEL_DELETED) {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.type.app_error", nil, "id="+o.Type)
	}

	if utf8.RuneCountInString(ArrayToJson(o.Filenames)) > POST_FILENAMES_MAX_RUNES {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.filenames.app_error", nil, "id="+o.Id)
	}

	if utf8.RuneCountInString(ArrayToJson(o.FileIds)) > POST_FILEIDS_MAX_RUNES {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.file_ids.app_error", nil, "id="+o.Id)
	}

	if utf8.RuneCountInString(StringInterfaceToJson(o.Props)) > POST_PROPS_MAX_RUNES {
		return NewLocAppError("Post.IsValid", "model.post.is_valid.props.app_error", nil, "id="+o.Id)
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

	if o.FileIds == nil {
		o.FileIds = []string{}
	}
}

func (o *Post) MakeNonNil() {
	if o.Props == nil {
		o.Props = make(map[string]interface{})
	}
}

func (o *Post) AddProp(key string, value interface{}) {

	o.MakeNonNil()

	o.Props[key] = value
}

func (o *Post) IsSystemMessage() bool {
	return len(o.Type) >= len(POST_SYSTEM_MESSAGE_PREFIX) && o.Type[:len(POST_SYSTEM_MESSAGE_PREFIX)] == POST_SYSTEM_MESSAGE_PREFIX
}

func (p *Post) Patch(patch *PostPatch) {
	if patch.IsPinned != nil {
		p.IsPinned = *patch.IsPinned
	}

	if patch.Message != nil {
		p.Message = *patch.Message
	}

	if patch.Props != nil {
		p.Props = *patch.Props
	}

	if patch.FileIds != nil {
		p.FileIds = *patch.FileIds
	}

	if patch.HasReactions != nil {
		p.HasReactions = *patch.HasReactions
	}
}

func (o *PostPatch) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	}

	return string(b)
}

func PostPatchFromJson(data io.Reader) *PostPatch {
	decoder := json.NewDecoder(data)
	var post PostPatch
	err := decoder.Decode(&post)
	if err != nil {
		return nil
	}

	return &post
}
