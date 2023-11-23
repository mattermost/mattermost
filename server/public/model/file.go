// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "time"

const (
	MaxImageSize = int64(6048 * 4032) // 24 megapixels, roughly 36MB as a raw image
)

type FileUploadResponse struct {
	FileInfos []*FileInfo `json:"file_infos"`
	ClientIds []string    `json:"client_ids"`
}

type PresignURLResponse struct {
	URL        string        `json:"url"`
	Expiration time.Duration `json:"expiration"`
}
