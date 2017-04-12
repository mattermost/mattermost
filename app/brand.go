// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"mime/multipart"
	"net/http"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func SaveBrandImage(imageData *multipart.FileHeader) *model.AppError {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		return model.NewAppError("SaveBrandImage", "api.admin.upload_brand_image.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	brandInterface := einterfaces.GetBrandInterface()
	if brandInterface == nil {
		return model.NewAppError("SaveBrandImage", "api.admin.upload_brand_image.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := brandInterface.SaveBrandImage(imageData); err != nil {
		return err
	}

	return nil
}

func GetBrandImage() ([]byte, *model.AppError) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("GetBrandImage", "api.admin.get_brand_image.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	brandInterface := einterfaces.GetBrandInterface()
	if brandInterface == nil {
		return nil, model.NewAppError("GetBrandImage", "api.admin.get_brand_image.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if img, err := brandInterface.GetBrandImage(); err != nil {
		return nil, err
	} else {
		return img, nil
	}
}
