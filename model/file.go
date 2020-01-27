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
	FILE_SORT_BY_CREATED      = "CreateAt"
	FILE_SORT_BY_SIZE         = "Size"
	FILE_SORT_BY_USERNAME     = "Username"
	FILE_SORT_BY_CHANNEL_NAME = "Name"

	FILE_SORT_ORDER_ASCENDING  = "ASC"
	FILE_SORT_ORDER_DESCENDING = "DESC"
)

// GetFilesOptions contains options for getting files
type GetFilesOptions struct {
	// UserIds optionally limits the files to those created by the given users.
	UserIds []string
	// ChannelIds optionally limits the files to those created in the given channels.
	ChannelIds []string
	// Since optionally limits files to those created after a specified time as Unix time in milliseconds.
	Since int64
	// IncludeDeleted includes deleted files if set.
	IncludeDeleted bool
	// Page optionally limits to the requested page of results.
	Page int
	// PerPage optionally limits the number of results to fetch per page.
	PerPage int
	// SortBy sorts the files by this field. Default is to sort by date created
	SortBy string
	// SortDirection sorts the files in a particular order. Default is ASC.
	SortDirection string
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
