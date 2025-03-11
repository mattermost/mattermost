// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package validation

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestUploadBrandImageValidator(t *testing.T) {
	t.Run("valid request", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("image", "test.png")
		_, _ = part.Write([]byte("test image content"))
		_ = writer.Close()

		r := httptest.NewRequest("POST", "/api/v4/brand/image", body)
		r.Header.Set("Content-Type", writer.FormDataContentType())
		r.ContentLength = int64(body.Len())

		validator := &UploadBrandImageValidator{MaxFileSize: 10 * 1024 * 1024} // 10MB
		err := validator.Validate(r)
		assert.Nil(t, err)
	})

	t.Run("file too large", func(t *testing.T) {
		r := httptest.NewRequest("POST", "/api/v4/brand/image", nil)
		r.ContentLength = 11 * 1024 * 1024 // 11MB

		validator := &UploadBrandImageValidator{MaxFileSize: 10 * 1024 * 1024} // 10MB
		err := validator.Validate(r)
		assert.NotNil(t, err)
		assert.Equal(t, "api.admin.upload_brand_image.too_large.app_error", err.Id)
		assert.Equal(t, http.StatusRequestEntityTooLarge, err.StatusCode)
	})

	t.Run("no image file", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		writer.Close()

		r := httptest.NewRequest("POST", "/api/v4/brand/image", body)
		r.Header.Set("Content-Type", writer.FormDataContentType())
		r.ContentLength = int64(body.Len())

		validator := &UploadBrandImageValidator{MaxFileSize: 10 * 1024 * 1024}
		err := validator.Validate(r)
		assert.NotNil(t, err)
		assert.Equal(t, "api.admin.upload_brand_image.no_file.app_error", err.Id)
	})
}

func TestGetBrandImageValidator(t *testing.T) {
	t.Run("valid request", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/api/v4/brand/image", nil)
		validator := &GetBrandImageValidator{}
		err := validator.Validate(r)
		assert.Nil(t, err)
	})
}

func TestDeleteBrandImageValidator(t *testing.T) {
	t.Run("valid request", func(t *testing.T) {
		r := httptest.NewRequest("DELETE", "/api/v4/brand/image", nil)
		validator := &DeleteBrandImageValidator{}
		err := validator.Validate(r)
		assert.Nil(t, err)
	})
}
