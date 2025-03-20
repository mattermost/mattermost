// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
	"unicode/utf8"
)

type ChannelBookmarkType string

const (
	ChannelBookmarkLink    ChannelBookmarkType = "link"
	ChannelBookmarkFile    ChannelBookmarkType = "file"
	BookmarkFileOwner                          = "bookmark"
	MaxBookmarksPerChannel                     = 50
	DisplayNameMaxRunes                        = 64
	LinkMaxRunes                               = 1024
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

// Clone returns a shallow copy of the channel bookmark.
func (o *ChannelBookmark) Clone() *ChannelBookmark {
	bCopy := *o
	return &bCopy
}

// SetOriginal generates a new bookmark copying the data of the
// receiver bookmark, resets its timestamps and main ID, updates its
// OriginalId and sets the owner to the ID passed as a parameter
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

	if o.DisplayName == "" || utf8.RuneCountInString(o.DisplayName) > DisplayNameMaxRunes {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.display_name.app_error", nil, "", http.StatusBadRequest)
	}

	if !(o.Type == ChannelBookmarkFile || o.Type == ChannelBookmarkLink) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ChannelBookmarkLink && o.FileId != "" {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.file_id.missing_or_invalid.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ChannelBookmarkFile && o.LinkUrl != "" {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.link_url.missing_or_invalid.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ChannelBookmarkLink && (o.LinkUrl == "" || !IsValidHTTPURL(o.LinkUrl) || utf8.RuneCountInString(o.LinkUrl) > LinkMaxRunes) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.link_url.missing_or_invalid.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ChannelBookmarkLink && o.ImageUrl != "" && (!IsValidHTTPURL(o.ImageUrl) || utf8.RuneCountInString(o.ImageUrl) > LinkMaxRunes) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.image_url.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ChannelBookmarkFile && (o.FileId == "" || !IsValidId(o.FileId)) {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.file_id.missing_or_invalid.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.ImageUrl != "" && o.FileId != "" {
		return NewAppError("ChannelBookmark.IsValid", "model.channel_bookmark.is_valid.link_file.app_error", nil, "id="+o.Id, http.StatusBadRequest)
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
	o.Emoji = strings.Trim(o.Emoji, ":")
	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}
	o.UpdateAt = o.CreateAt
}

func (o *ChannelBookmark) PreUpdate() {
	o.UpdateAt = GetMillis()
	o.DisplayName = SanitizeUnicode(o.DisplayName)
	o.Emoji = strings.Trim(o.Emoji, ":")
}

func (o *ChannelBookmark) ToBookmarkWithFileInfo(f *FileInfo) *ChannelBookmarkWithFileInfo {
	bwf := ChannelBookmarkWithFileInfo{
		ChannelBookmark: &ChannelBookmark{
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
			Emoji:       strings.Trim(o.Emoji, ":"),
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

type ChannelBookmarkPatch struct {
	FileId      *string `json:"file_id"`
	DisplayName *string `json:"display_name"`
	SortOrder   *int64  `json:"sort_order"`
	LinkUrl     *string `json:"link_url,omitempty"`
	ImageUrl    *string `json:"image_url,omitempty"`
	Emoji       *string `json:"emoji,omitempty"`
}

func (o *ChannelBookmarkPatch) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"file_id": o.FileId,
	}
}

func (o *ChannelBookmark) Patch(patch *ChannelBookmarkPatch) {
	if patch.FileId != nil {
		o.FileId = *patch.FileId
	}

	if patch.DisplayName != nil {
		o.DisplayName = *patch.DisplayName
	}
	if patch.SortOrder != nil {
		o.SortOrder = *patch.SortOrder
	}
	if patch.LinkUrl != nil {
		o.LinkUrl = *patch.LinkUrl
	}
	if patch.ImageUrl != nil {
		o.ImageUrl = *patch.ImageUrl
	}
	if patch.Emoji != nil {
		o.Emoji = *patch.Emoji
	}
}

type ChannelBookmarkWithFileInfo struct {
	*ChannelBookmark
	FileInfo *FileInfo `json:"file,omitempty"`
}

func (o *ChannelBookmarkWithFileInfo) Auditable() map[string]interface{} {
	a := o.ChannelBookmark.Auditable()
	if o.FileInfo != nil {
		a["file"] = o.FileInfo.Auditable()
	}

	return a
}

// Clone returns a shallow copy of the channel bookmark with file info.
func (o *ChannelBookmarkWithFileInfo) Clone() *ChannelBookmarkWithFileInfo {
	bCopy := *o
	return &bCopy
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

func (o *UpdateChannelBookmarkResponse) Auditable() map[string]any {
	a := map[string]any{}
	if o.Updated != nil {
		a["updated"] = o.Updated.Auditable()
	}
	if o.Deleted != nil {
		a["updated"] = o.Deleted.Auditable()
	}
	return a
}

type ChannelBookmarkAndFileInfo struct {
	Id              string
	CreateAt        int64
	UpdateAt        int64
	DeleteAt        int64
	ChannelId       string
	OwnerId         string
	FileInfoId      string
	DisplayName     string
	SortOrder       int64
	LinkUrl         string
	ImageUrl        string
	Emoji           string
	Type            ChannelBookmarkType
	OriginalId      string
	ParentId        string
	FileId          string
	FileName        string
	Extension       string
	Size            int64
	MimeType        string
	Width           int
	Height          int
	HasPreviewImage bool
	MiniPreview     *[]byte
}

func (o *ChannelBookmarkAndFileInfo) ToChannelBookmarkWithFileInfo() *ChannelBookmarkWithFileInfo {
	bwf := &ChannelBookmarkWithFileInfo{
		ChannelBookmark: &ChannelBookmark{
			Id:          o.Id,
			CreateAt:    o.CreateAt,
			UpdateAt:    o.UpdateAt,
			DeleteAt:    o.DeleteAt,
			ChannelId:   o.ChannelId,
			OwnerId:     o.OwnerId,
			FileId:      o.FileInfoId,
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

	if o.FileInfoId != "" && o.FileId != "" {
		miniPreview := o.MiniPreview
		if len(*miniPreview) == 0 {
			miniPreview = nil
		}
		bwf.FileInfo = &FileInfo{
			Id:              o.FileId,
			Name:            o.FileName,
			Extension:       o.Extension,
			Size:            o.Size,
			MimeType:        o.MimeType,
			Width:           o.Width,
			Height:          o.Height,
			HasPreviewImage: o.HasPreviewImage,
			MiniPreview:     miniPreview,
		}
	}
	return bwf
}
