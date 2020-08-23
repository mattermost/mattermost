// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"image"
	"image/gif"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
)

const (
	FILEINFO_SORT_BY_CREATED = "CreateAt"
	FILEINFO_SORT_BY_SIZE    = "Size"
)

// GetFileInfosOptions contains options for getting FileInfos
type GetFileInfosOptions struct {
	// UserIds optionally limits the FileInfos to those created by the given users.
	UserIds []string `json:"user_ids"`
	// ChannelIds optionally limits the FileInfos to those created in the given channels.
	ChannelIds []string `json:"channel_ids"`
	// Since optionally limits FileInfos to those created at or after the given time, specified as Unix time in milliseconds.
	Since int64 `json:"since"`
	// IncludeDeleted if set includes deleted FileInfos.
	IncludeDeleted bool `json:"include_deleted"`
	// SortBy sorts the FileInfos by this field. The default is to sort by date created.
	SortBy string `json:"sort_by"`
	// SortDescending changes the sort direction to descending order when true.
	SortDescending bool `json:"sort_descending"`
}

type FileInfo struct {
	Id              string `json:"id"`
	CreatorId       string `json:"user_id"`
	PostId          string `json:"post_id,omitempty"`
	CreateAt        int64  `json:"create_at"`
	UpdateAt        int64  `json:"update_at"`
	DeleteAt        int64  `json:"delete_at"`
	Path            string `json:"-"` // not sent back to the client
	ThumbnailPath   string `json:"-"` // not sent back to the client
	PreviewPath     string `json:"-"` // not sent back to the client
	Name            string `json:"name"`
	Extension       string `json:"extension"`
	Size            int64  `json:"size"`
	MimeType        string `json:"mime_type"`
	Width           int    `json:"width,omitempty"`
	Height          int    `json:"height,omitempty"`
	HasPreviewImage bool   `json:"has_preview_image,omitempty"`
}

func (fi *FileInfo) ToJson() string {
	b, _ := json.Marshal(fi)
	return string(b)
}

func FileInfoFromJson(data io.Reader) *FileInfo {
	decoder := json.NewDecoder(data)

	var fi FileInfo
	if err := decoder.Decode(&fi); err != nil {
		return nil
	} else {
		return &fi
	}
}

func FileInfosToJson(infos []*FileInfo) string {
	b, _ := json.Marshal(infos)
	return string(b)
}

func FileInfosFromJson(data io.Reader) []*FileInfo {
	decoder := json.NewDecoder(data)

	var infos []*FileInfo
	if err := decoder.Decode(&infos); err != nil {
		return nil
	} else {
		return infos
	}
}

func (fi *FileInfo) PreSave() {
	if fi.Id == "" {
		fi.Id = NewId()
	}

	if fi.CreateAt == 0 {
		fi.CreateAt = GetMillis()
	}

	if fi.UpdateAt < fi.CreateAt {
		fi.UpdateAt = fi.CreateAt
	}
}

func (fi *FileInfo) IsValid() *AppError {
	if !IsValidId(fi.Id) {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(fi.CreatorId) && fi.CreatorId != "nouser" {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.user_id.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if len(fi.PostId) != 0 && !IsValidId(fi.PostId) {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.post_id.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.CreateAt == 0 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.create_at.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.UpdateAt == 0 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.update_at.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.Path == "" {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.path.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	return nil
}

func (fi *FileInfo) IsImage() bool {
	return strings.HasPrefix(fi.MimeType, "image")
}

func (fi *FileInfo) IsMMPreviewSupported() bool {
	return fi.Extension == "doc" || fi.Extension == "docx" || fi.Extension == "ppt" || fi.Extension == "pptx" || fi.Extension == "xls" || fi.Extension == "xlsx" || fi.Extension == "odt" || fi.Extension == "odp" || fi.Extension == "ods" || fi.Extension == "rtf"
}

func NewInfo(name string) *FileInfo {
	info := &FileInfo{
		Name: name,
	}

	extension := strings.ToLower(filepath.Ext(name))
	info.MimeType = mime.TypeByExtension(extension)

	if extension != "" && extension[0] == '.' {
		// The client expects a file extension without the leading period
		info.Extension = extension[1:]
	} else {
		info.Extension = extension
	}

	return info
}

func GetInfoForBytes(name string, data []byte) (*FileInfo, *AppError) {
	info := &FileInfo{
		Name: name,
		Size: int64(len(data)),
	}
	var err *AppError

	extension := strings.ToLower(filepath.Ext(name))
	info.MimeType = mime.TypeByExtension(extension)

	if extension != "" && extension[0] == '.' {
		// The client expects a file extension without the leading period
		info.Extension = extension[1:]
	} else {
		info.Extension = extension
	}

	if info.IsImage() {
		// Only set the width and height if it's actually an image that we can understand
		if config, _, err := image.DecodeConfig(bytes.NewReader(data)); err == nil {
			info.Width = config.Width
			info.Height = config.Height

			if info.MimeType == "image/gif" {
				// Just show the gif itself instead of a preview image for animated gifs
				if gifConfig, err := gif.DecodeAll(bytes.NewReader(data)); err != nil {
					// Still return the rest of the info even though it doesn't appear to be an actual gif
					info.HasPreviewImage = true
					return info, NewAppError("GetInfoForBytes", "model.file_info.get.gif.app_error", nil, "name="+name, http.StatusBadRequest)
				} else {
					info.HasPreviewImage = len(gifConfig.Image) == 1
				}
			} else {
				info.HasPreviewImage = true
			}
		}
	}

	return info, err
}

func GetEtagForFileInfos(infos []*FileInfo) string {
	if len(infos) == 0 {
		return Etag()
	}

	var maxUpdateAt int64

	for _, info := range infos {
		if info.UpdateAt > maxUpdateAt {
			maxUpdateAt = info.UpdateAt
		}
	}

	return Etag(infos[0].PostId, maxUpdateAt)
}
