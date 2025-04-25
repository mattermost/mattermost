package validation

import (
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/mattermost/mattermost/server/public/model"
)

var validate = validator.New()

// BrandImageGetRequest represents the validated request parameters for getting brand image
type BrandImageGetRequest struct {
	ClientVersion string `validate:"required"`
	ClientHash    string `validate:"required"`
}

// BrandImageUploadRequest represents the validated request parameters for uploading brand image
type BrandImageUploadRequest struct {
	ClientVersion string `validate:"required"`
	ClientHash    string `validate:"required"`
	MaxFileSize   int64  `validate:"required"`
}

// ValidateBrandImageGet validates the request parameters for getting brand image
func ValidateBrandImageGet(r *http.Request) *model.AppError {
	req := &BrandImageGetRequest{
		ClientVersion: r.URL.Query().Get("client_version"),
		ClientHash:    r.URL.Query().Get("client_hash"),
	}

	if err := validate.Struct(req); err != nil {
		return model.NewAppError("ValidateBrandImageGet", "api.invalid_param", nil, err.Error(), http.StatusBadRequest)
	}

	return nil
}

// ValidateBrandImageUpload validates the request parameters for uploading brand image
func ValidateBrandImageUpload(r *http.Request, maxFileSize int64) *model.AppError {
	// First validate the query parameters
	req := &BrandImageUploadRequest{
		ClientVersion: r.URL.Query().Get("client_version"),
		ClientHash:    r.URL.Query().Get("client_hash"),
		MaxFileSize:   maxFileSize,
	}

	if err := validate.Struct(req); err != nil {
		return model.NewAppError("ValidateBrandImageUpload", "api.invalid_param", nil, err.Error(), http.StatusBadRequest)
	}

	// Then validate the file size
	if r.ContentLength > maxFileSize {
		return model.NewAppError("ValidateBrandImageUpload", "api.admin.upload_brand_image.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
	}

	// Parse multipart form
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		return model.NewAppError("ValidateBrandImageUpload", "api.admin.upload_brand_image.parse.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	// Validate that the image file is present
	m := r.MultipartForm
	imageArray, ok := m.File["image"]
	if !ok {
		return model.NewAppError("ValidateBrandImageUpload", "api.admin.upload_brand_image.no_file.app_error", nil, "", http.StatusBadRequest)
	}

	if len(imageArray) <= 0 {
		return model.NewAppError("ValidateBrandImageUpload", "api.admin.upload_brand_image.array.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
