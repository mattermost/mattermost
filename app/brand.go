// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	BRAND_FILE_PATH = "brand/"
	BRAND_FILE_NAME = "image.png"
)

func (a *App) SaveBrandImage(imageData *multipart.FileHeader) *model.AppError {
	if len(*a.Config().FileSettings.DriverName) == 0 {
		return model.NewAppError("SaveBrandImage", "api.admin.upload_brand_image.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.open.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	defer file.Close()

	// Decode image config first to check dimensions before loading the whole thing into memory later on
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.decode_config.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if config.Width*config.Height > model.MaxImageSize {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.too_large.app_error", nil, "", http.StatusBadRequest)
	}

	file.Seek(0, 0)

	img, _, err := image.Decode(file)
	if err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.decode.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.encode.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	t := time.Now()
	a.MoveFile(BRAND_FILE_PATH+BRAND_FILE_NAME, BRAND_FILE_PATH+t.Format("2006-01-02T15:04:05")+".png")

	if _, err := a.WriteFile(buf, BRAND_FILE_PATH+BRAND_FILE_NAME); err != nil {
		return model.NewAppError("SaveBrandImage", "brand.save_brand_image.save_image.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

func (a *App) GetBrandImage() ([]byte, *model.AppError) {
	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("GetBrandImage", "api.admin.get_brand_image.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	img, err := a.ReadFile(BRAND_FILE_PATH + BRAND_FILE_NAME)
	if err != nil {
		return nil, err
	}

	return img, nil
}

func (a *App) DeleteBrandImage() *model.AppError {
	filePath := BRAND_FILE_PATH + BRAND_FILE_NAME

	fileExists, err := a.FileExists(filePath)

	if err != nil {
		return err
	}

	if !fileExists {
		return model.NewAppError("DeleteBrandImage", "api.admin.delete_brand_image.storage.not_found", nil, "", http.StatusNotFound)
	}

	return a.RemoveFile(filePath)
}
