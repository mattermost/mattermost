// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
	"mime/multipart"
)

type BrandInterface interface {
	SaveBrandImage(*multipart.FileHeader) *model.AppError
	GetBrandImage() ([]byte, *model.AppError)
}

var theBrandInterface BrandInterface

func RegisterBrandInterface(newInterface BrandInterface) {
	theBrandInterface = newInterface
}

func GetBrandInterface() BrandInterface {
	return theBrandInterface
}
