// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"image"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils/imgutils"
)

func getInfoForBytes(name string, data io.ReadSeeker, size int) (*model.FileInfo, *model.AppError) {
	info := &model.FileInfo{
		Name: name,
		Size: int64(size),
	}
	var err *model.AppError

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
					return info, model.NewAppError("getInfoForBytes", "app.file_info.get.gif.app_error", nil, "", http.StatusBadRequest).Wrap(err)
				}
				info.HasPreviewImage = frameCount == 1
			} else {
				info.HasPreviewImage = true
			}
		}
	}

	return info, err
}
