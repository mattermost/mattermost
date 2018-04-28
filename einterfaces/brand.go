// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"mime/multipart"

	"github.com/mattermost/mattermost-server/model"
)

type BrandInterface interface {
	SaveBrandImage(*multipart.FileHeader) *model.AppError
	GetBrandImage() ([]byte, *model.AppError)
}
