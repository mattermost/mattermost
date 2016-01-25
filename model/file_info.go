// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"image/gif"
	"io"
	"mime"
	"path/filepath"
)

type FileInfo struct {
	Filename        string `json:"filename"`
	Size            int    `json:"size"`
	Extension       string `json:"extension"`
	MimeType        string `json:"mime_type"`
	HasPreviewImage bool   `json:"has_preview_image"`
}

func GetInfoForBytes(filename string, data []byte) (*FileInfo, *AppError) {
	size := len(data)

	var mimeType string
	extension := filepath.Ext(filename)
	isImage := IsFileExtImage(extension)
	if isImage {
		mimeType = GetImageMimeType(extension)
	} else {
		mimeType = mime.TypeByExtension(extension)
	}

	hasPreviewImage := isImage
	if mimeType == "image/gif" {
		// just show the gif itself instead of a preview image for animated gifs
		if gifImage, err := gif.DecodeAll(bytes.NewReader(data)); err != nil {
			return nil, NewLocAppError("GetInfoForBytes", "model.file_info.get.gif.app_error", nil, "filename="+filename)
		} else {
			hasPreviewImage = len(gifImage.Image) == 1
		}
	}

	return &FileInfo{
		Filename:        filename,
		Size:            size,
		Extension:       extension[1:],
		MimeType:        mimeType,
		HasPreviewImage: hasPreviewImage,
	}, nil
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
