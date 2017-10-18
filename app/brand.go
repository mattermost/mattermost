// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (a *App) SaveBrandImage(imageData *multipart.FileHeader) *model.AppError {
	if len(*a.Config().FileSettings.DriverName) == 0 {
		return model.NewAppError("SaveBrandImage", "api.admin.upload_brand_image.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	if a.Brand == nil {
		return model.NewAppError("SaveBrandImage", "api.admin.upload_brand_image.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := a.Brand.SaveBrandImage(imageData); err != nil {
		return err
	}

	return nil
}

func (a *App) GetBrandImage() ([]byte, *model.AppError) {
	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("GetBrandImage", "api.admin.get_brand_image.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	if a.Brand == nil {
		return nil, model.NewAppError("GetBrandImage", "api.admin.get_brand_image.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if img, err := a.Brand.GetBrandImage(); err != nil {
		return nil, err
	} else {
		return img, nil
	}
}
