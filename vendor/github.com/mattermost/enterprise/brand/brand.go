// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package brand

import (
	"bytes"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"mime/multipart"
)

const (
	BRAND_FILE_PATH = "brand/image.png"
)

type BrandInterfaceImpl struct {
}

func init() {
	brand := &BrandInterfaceImpl{}
	einterfaces.RegisterBrandInterface(brand)
}

func checkLicense() *model.AppError {
	if !utils.IsLicensed || !*utils.License.Features.CustomBrand {
		return model.NewLocAppError("checkLicense", "ent.brand.license_disable.app_error", nil, "")
	}

	return nil
}

func (m *BrandInterfaceImpl) SaveBrandImage(fileHeader *multipart.FileHeader) *model.AppError {
	if err := checkLicense(); err != nil {
		return err
	}

	file, err := fileHeader.Open()
	defer file.Close()
	if err != nil {
		return model.NewLocAppError("SaveBrandImage", "ent.brand.save_brand_image.open.app_error", nil, err.Error())
	}

	// Decode image config first to check dimensions before loading the whole thing into memory later on
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return model.NewLocAppError("SaveBrandImage", "ent.brand.save_brand_image.decode_config.app_error", nil, err.Error())
	} else if config.Width*config.Height > api.MaxImageSize {
		return model.NewLocAppError("SaveBrandImage", "ent.brand.save_brand_image.too_large.app_error", nil, err.Error())
	}

	file.Seek(0, 0)

	img, _, err := image.Decode(file)
	if err != nil {
		return model.NewLocAppError("SaveBrandImage", "ent.brand.save_brand_image.decode.app_error", nil, err.Error())
	}

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		return model.NewLocAppError("SaveBrandImage", "ent.brand.save_brand_image.encode.app_error", nil, err.Error())
	}

	if err := api.WriteFile(buf.Bytes(), BRAND_FILE_PATH); err != nil {
		return model.NewLocAppError("SaveBrandImage", "ent.brand.save_brand_image.save_image.app_error", nil, "")
	}

	return nil
}

func (m *BrandInterfaceImpl) GetBrandImage() ([]byte, *model.AppError) {
	if err := checkLicense(); err != nil {
		return nil, err
	}

	if data, err := api.ReadFile(BRAND_FILE_PATH); err != nil {
		return nil, err
	} else {
		return data, nil
	}
}
