// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	BrandFilePath = "brand/"
	BrandFileName = "image.png"
)

func (a *App) SaveBrandImage(rctx request.CTX, imageData *multipart.FileHeader) *model.AppError {
	if *a.Config().FileSettings.DriverName == "" {
		return model.NewAppError("SaveBrandImage", "api.admin.upload_brand_image.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.open.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	defer file.Close()

	if err = checkImageLimits(file, *a.Config().FileSettings.MaxImageResolution); err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.check_image_limits.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	img, _, err := a.ch.imgDecoder.Decode(file)
	if err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.decode.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	buf := new(bytes.Buffer)
	err = a.ch.imgEncoder.EncodePNG(buf, img)
	if err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.encode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	t := time.Now()
	// Try to backup the old brand image if it exists
	oldPath := BrandFilePath + BrandFileName
	newPath := BrandFilePath + t.Format("2006-01-02T15:04:05") + ".png"

	fileExists, appErr := a.FileExists(oldPath)
	if appErr != nil {
		rctx.Logger().Warn("Failed to check if brand image exists before backup", mlog.String("path", oldPath), mlog.Err(appErr))
	}

	if fileExists {
		if err := a.MoveFile(oldPath, newPath); err != nil {
			// Log the error but continue since this is a non-critical operation - we're just trying to
			// backup the old brand image, but it's not a problem if we can't
			rctx.Logger().Warn(
				"Failed to backup old brand image",
				mlog.Err(err),
				mlog.String("oldPath", oldPath),
				mlog.String("newPath", newPath),
			)
		}
	}

	if _, err := a.WriteFile(buf, BrandFilePath+BrandFileName); err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.save_image.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) GetBrandImage(rctx request.CTX) ([]byte, *model.AppError) {
	if *a.Config().FileSettings.DriverName == "" {
		return nil, model.NewAppError("GetBrandImage", "api.admin.get_brand_image.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	img, err := a.ReadFile(BrandFilePath + BrandFileName)
	if err != nil {
		return nil, err
	}

	return img, nil
}

func (a *App) DeleteBrandImage(rctx request.CTX) *model.AppError {
	filePath := BrandFilePath + BrandFileName

	fileExists, err := a.FileExists(filePath)

	if err != nil {
		return err
	}

	if !fileExists {
		return model.NewAppError("DeleteBrandImage", "api.admin.delete_brand_image.storage.not_found", nil, "", http.StatusNotFound)
	}

	return a.RemoveFile(filePath)
}
