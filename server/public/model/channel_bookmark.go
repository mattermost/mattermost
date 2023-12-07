// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

type ChannelBookmarkType string

const (
	ChannelBookmarkLink ChannelBookmarkType = "link"
	ChannelBookmarkFile ChannelBookmarkType = "file"
	BookmarkFileOwner                       = "bookmark"
)

type ChannelBookmark struct {
	Id          string              `json:"id"`
	CreateAt    int64               `json:"create_at"`
	UpdateAt    int64               `json:"update_at"`
	DeleteAt    int64               `json:"delete_at"`
	ChannelId   string              `json:"channel_id"`
	OwnerId     string              `json:"owner_id"`
	FileId      string              `json:"file_id"`
	DisplayName string              `json:"display_name"`
	SortOrder   int64               `json:"sort_order"`
	LinkUrl     string              `json:"link_url,omitempty"`
	ImageUrl    string              `json:"image_url,omitempty"`
	Emoji       string              `json:"emoji,omitempty"`
	Type        ChannelBookmarkType `json:"type"`
	OriginalId  string              `json:"original_id,omitempty"`
	ParentId    string              `json:"parent_id,omitempty"`
}

func (o *ChannelBookmark) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":          o.Id,
		"create_at":   o.CreateAt,
		"update_at":   o.UpdateAt,
		"delete_at":   o.DeleteAt,
		"channel_id":  o.ChannelId,
		"owner_id":    o.OwnerId,
		"file_id":     o.FileId,
		"type":        o.Type,
		"original_id": o.OriginalId,
		"parent_id":   o.ParentId,
	}
}

type ChannelBookmarkWithFileInfo struct {
	ChannelBookmark
	FileInfo *FileInfo `json:"file,omitempty"`
}

type ChannelWithBookmarks struct {
	*Channel
	Bookmarks []*ChannelBookmarkWithFileInfo `json:"bookmarks,omitempty"`
}

type ChannelWithTeamDataAndBookmarks struct {
	*ChannelWithTeamData
	Bookmarks []*ChannelBookmarkWithFileInfo `json:"bookmarks,omitempty"`
}

type UpdateChannelBookmarkResponse struct {
	Updated *ChannelBookmarkWithFileInfo `json:"updated,omitempty"`
	Deleted *ChannelBookmarkWithFileInfo `json:"deleted,omitempty"`
}

// Clone returns a shallow copy of the channel bookmark.
func (o *ChannelBookmark) Clone() *ChannelBookmark {
	bCopy := *o
	return &bCopy
}

func (o *ChannelBookmark) SetOriginal(newOwnerId string) *ChannelBookmark {
	bCopy := *o
	bCopy.Id = ""
	bCopy.CreateAt = 0
	bCopy.DeleteAt = 0
	bCopy.UpdateAt = 0
	bCopy.OriginalId = o.Id
	bCopy.OwnerId = newOwnerId
	return &bCopy
}

func (o *ChannelBookmark) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidId(o.ChannelId) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.OwnerId) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.owner_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.DisplayName == "" {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.display_name.app_error", nil, "", http.StatusBadRequest)
	}

	if !(o.Type == ChannelBookmarkFile || o.Type == ChannelBookmarkLink) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ChannelBookmarkLink && (o.LinkUrl == "" || !IsValidHTTPURL(o.LinkUrl)) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.link_url.missing_or_invalid.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ChannelBookmarkLink && o.ImageUrl != "" && !IsValidHTTPURL(o.ImageUrl) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.image_url.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ChannelBookmarkFile && (o.FileId == "" || !IsValidId(o.FileId)) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.file_id.missing_or_invalid.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.OriginalId != "" && !IsValidId(o.OriginalId) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.original_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.ParentId != "" && !IsValidId(o.ParentId) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.parent_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *ChannelBookmark) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.DisplayName = SanitizeUnicode(o.DisplayName)
	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}
	o.UpdateAt = o.CreateAt
}

func (o *ChannelBookmark) PreUpdate() {
	o.UpdateAt = GetMillis()
	o.DisplayName = SanitizeUnicode(o.DisplayName)
}

func (o *ChannelBookmark) ToBookmarkWithFileInfo(f *FileInfo) *ChannelBookmarkWithFileInfo {
	bwf := ChannelBookmarkWithFileInfo{
		ChannelBookmark: ChannelBookmark{
			Id:          o.Id,
			CreateAt:    o.CreateAt,
			UpdateAt:    o.UpdateAt,
			DeleteAt:    o.DeleteAt,
			ChannelId:   o.ChannelId,
			OwnerId:     o.OwnerId,
			FileId:      o.FileId,
			DisplayName: o.DisplayName,
			SortOrder:   o.SortOrder,
			LinkUrl:     o.LinkUrl,
			ImageUrl:    o.ImageUrl,
			Emoji:       o.Emoji,
			Type:        o.Type,
			OriginalId:  o.OriginalId,
			ParentId:    o.ParentId,
		},
	}

	if f != nil && f.Id != "" {
		bwf.FileInfo = f
	}

	return &bwf
}
