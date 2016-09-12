// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"image"
	"io"
	"mime"
	"path/filepath"
)

type FileInfo struct {
	Id            string `json:"id"`
	UserId        string `json:"user_id"`
	PostId        string `json:"post_id,omitempty"`
	CreateAt      int64  `json:"create_at"`
	UpdateAt      int64  `json:"update_at"`
	DeleteAt      int64  `json:"delete_at"`
	Path          string `json:"-"` // not sent back to the client
	ThumbnailPath string `json:"-"` // not sent back to the client
	PreviewPath   string `json:"-"` // not sent back to the client
	Name          string `json:"name"`
	Size          int64  `json:"size"`
	MimeType      string `json:"mime_type"`
	Width         int    `json:"width,omitempty"`
	Height        int    `json:"height,omitempty"`
}

func (info *FileInfo) ToJson() string {
	b, err := json.Marshal(info)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func FileInfoFromJson(data io.Reader) *FileInfo {
	decoder := json.NewDecoder(data)

	var info FileInfo
	if err := decoder.Decode(&info); err != nil {
		return nil
	} else {
		return &info
	}
}

func (o *FileInfo) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
		o.UpdateAt = o.CreateAt
	}
}

func (o *FileInfo) IsValid() *AppError {
	if len(o.Id) != 26 {
		return NewLocAppError("FileInfo.IsValid", "model.file_info.is_valid.id.app_error", nil, "")
	}

	if len(o.UserId) != 26 {
		return NewLocAppError("FileInfo.IsValid", "model.file_info.is_valid.user_id.app_error", nil, "id="+o.Id)
	}

	if len(o.PostId) != 0 && len(o.PostId) != 26 {
		return NewLocAppError("FileInfo.IsValid", "model.file_info.is_valid.post_id.app_error", nil, "id="+o.Id)
	}

	if o.CreateAt == 0 {
		return NewLocAppError("FileInfo.IsValid", "model.file_info.is_valid.create_at.app_error", nil, "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewLocAppError("FileInfo.IsValid", "model.file_info.is_valid.update_at.app_error", nil, "id="+o.Id)
	}

	if o.Path == "" {
		return NewLocAppError("FileInfo.IsValid", "model.file_info.is_valid.path.app_error", nil, "id="+o.Id)
	}

	return nil
}

func GetInfoForBytes(name string, data []byte) (*FileInfo, *image.Config) {
	info := &FileInfo{
		Name: name,
		Size: int64(len(data)),
	}

	extension := filepath.Ext(name)
	info.MimeType = mime.TypeByExtension(extension)

	// only set the width and height if it's actually an image
	if config, _, err := image.DecodeConfig(bytes.NewReader(data)); err == nil {
		info.Width = config.Width
		info.Height = config.Height

		return info, &config
	} else {
		return info, nil
	}
}
