// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	MaxImageSize = 6048 * 4032 // 24 megapixels, roughly 36MB as a raw image
)

var (
	IMAGE_EXTENSIONS = [7]string{".jpg", ".jpeg", ".gif", ".bmp", ".png", ".tiff", "tif"}
	IMAGE_MIME_TYPES = map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".png": "image/png", ".tiff": "image/tiff", ".tif": "image/tif"}
)

type FileUploadResponse struct {
	FileInfos []*FileInfo `json:"file_infos"`
	ClientIds []string    `json:"client_ids"`
}

const (
	FILE_SORT_BY_CREATED = "CreateAt"
	FILE_SORT_BY_SIZE    = "Size"
)

// GetFilesOptions contains options for getting files
type GetFilesOptions struct {
	// UserIds optionally limits the files to those created by the given users.
	UserIds []string `json:"user_ids"`
	// ChannelIds optionally limits the files to those created in the given channels.
	ChannelIds []string `json:"channel_ids"`
	// Since optionally limits files to those created after a specified time as Unix time in milliseconds.
	Since int64 `json:"since"`
	// IncludeDeleted includes deleted files if set.
	IncludeDeleted bool `json:"include_deleted"`
	// SortBy sorts the files by this field. Default is to sort by date created
	SortBy string `json:"sort_by"`
	// SortDescending when set sorts the files in descending order. The default is to sort in ascending order.
	SortDescending bool `json:"sort_descending"`
}

func FileUploadResponseFromJson(data io.Reader) *FileUploadResponse {
	var o *FileUploadResponse
	json.NewDecoder(data).Decode(&o)
	return o
}

func (o *FileUploadResponse) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}
