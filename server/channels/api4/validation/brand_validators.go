// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package validation

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

// UploadBrandImageValidator validates the request for uploading a brand image
type UploadBrandImageValidator struct {
	MaxFileSize int64
}

// Validate validates the request for uploading a brand image
func (v *UploadBrandImageValidator) Validate(r *http.Request) *model.AppError {
	if r.ContentLength > v.MaxFileSize {
		return model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
	}

	if err := r.ParseMultipartForm(v.MaxFileSize); err != nil {
		return model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.parse.app_error", nil, "", http.StatusBadRequest)
	}

	m := r.MultipartForm

	imageArray, ok := m.File["image"]
	if !ok {
		return model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.no_file.app_error", nil, "", http.StatusBadRequest)
	}

	if len(imageArray) <= 0 {
		return model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.array.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// DeleteBrandImageValidator validates the request for deleting a brand image
type DeleteBrandImageValidator struct{}

// Validate validates the request for deleting a brand image
func (v *DeleteBrandImageValidator) Validate(r *http.Request) *model.AppError {
	// No specific validation needed for delete operation
	return nil
}

// GetBrandImageValidator validates the request for getting a brand image
type GetBrandImageValidator struct{}

// Validate validates the request for getting a brand image
func (v *GetBrandImageValidator) Validate(r *http.Request) *model.AppError {
	// No specific validation needed for get operation
	return nil
}
