// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"image"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/v6/utils/imgutils"
)

const (
	FileinfoSortByCreated = "CreateAt"
	FileinfoSortBySize    = "Size"
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
	Id              string  `json:"id"`
	CreatorId       string  `json:"user_id"`
	PostId          string  `json:"post_id,omitempty"`
	ChannelId       string  `db:"-" json:"channel_id"`
	CreateAt        int64   `json:"create_at"`
	UpdateAt        int64   `json:"update_at"`
	DeleteAt        int64   `json:"delete_at"`
	Path            string  `json:"-"` // not sent back to the client
	ThumbnailPath   string  `json:"-"` // not sent back to the client
	PreviewPath     string  `json:"-"` // not sent back to the client
	Name            string  `json:"name"`
	Extension       string  `json:"extension"`
	Size            int64   `json:"size"`
	MimeType        string  `json:"mime_type"`
	Width           int     `json:"width,omitempty"`
	Height          int     `json:"height,omitempty"`
	HasPreviewImage bool    `json:"has_preview_image,omitempty"`
	MiniPreview     *[]byte `json:"mini_preview"` // declared as *[]byte to avoid postgres/mysql differences in deserialization
	Content         string  `json:"-"`
	RemoteId        *string `json:"remote_id"`
	Archived        bool    `json:"archived"`
}

func (fi *FileInfo) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":         fi.Id,
		"creator_id": fi.CreatorId,
		"post_id":    fi.PostId,
		"channel_id": fi.ChannelId,
		"create_at":  fi.CreateAt,
		"update_at":  fi.UpdateAt,
		"delete_at":  fi.DeleteAt,
		"name":       fi.Name,
		"extension":  fi.Extension,
		"size":       fi.Size,
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

	if fi.RemoteId == nil {
		fi.RemoteId = NewString("")
	}
}

func (fi *FileInfo) IsValid() *AppError {
	if !IsValidId(fi.Id) {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(fi.CreatorId) && fi.CreatorId != "nouser" {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.user_id.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.PostId != "" && !IsValidId(fi.PostId) {
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

func (fi *FileInfo) IsSvg() bool {
	return fi.MimeType == "image/svg+xml"
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

func GetInfoForBytes(name string, data io.ReadSeeker, size int) (*FileInfo, *AppError) {
	info := &FileInfo{
		Name: name,
		Size: int64(size),
	}
	var err *AppError

	extension := strings.ToLower(filepath.Ext(name))
	info.MimeType = mime.TypeByExtension(extension)

	if extension != "" {
		// The client expects a file extension without the leading period
		info.Extension = extension[1:]
	} else {
		info.Extension = extension
	}

	if info.IsImage() {
		// Only set the width and height if it's actually an image that we can understand
		if config, _, err := image.DecodeConfig(data); err == nil {
			info.Width = config.Width
			info.Height = config.Height

			if info.MimeType == "image/gif" {
				// Just show the gif itself instead of a preview image for animated gifs
				data.Seek(0, io.SeekStart)
				frameCount, err := imgutils.CountGIFFrames(data)
				if err != nil {
					// Still return the rest of the info even though it doesn't appear to be an actual gif
					info.HasPreviewImage = true
					return info, NewAppError("GetInfoForBytes", "model.file_info.get.gif.app_error", nil, "", http.StatusBadRequest).Wrap(err)
				}
				info.HasPreviewImage = frameCount == 1
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

func (fi *FileInfo) MakeContentInaccessible() {
	if fi == nil {
		return
	}

	fi.Archived = true
	fi.Content = ""
	fi.HasPreviewImage = false
	fi.MiniPreview = nil
	fi.Path = ""
	fi.PreviewPath = ""
	fi.ThumbnailPath = ""
}
