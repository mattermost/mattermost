// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
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
	brandInterface := einterfaces.GetBrandInterface()
	if brandInterface == nil {
		err := model.NewLocAppError("SaveBrandImage", "api.admin.upload_brand_image.not_available.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	if err := brandInterface.SaveBrandImage(imageData); err != nil {
		return err
	}

	return nil
}

func GetBrandImage() ([]byte, *model.AppError) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		err := model.NewLocAppError("GetBrandImage", "api.admin.get_brand_image.storage.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return nil, err
	}

	brandInterface := einterfaces.GetBrandInterface()
	if brandInterface == nil {
		err := model.NewLocAppError("GetBrandImage", "api.admin.get_brand_image.not_available.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return nil, err
	}

	if img, err := brandInterface.GetBrandImage(); err != nil {
		return nil, err
	} else {
		return img, nil
	}
}
