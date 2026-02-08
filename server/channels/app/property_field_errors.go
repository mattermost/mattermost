// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

// PropertyFieldErrorConfig provides configuration for property field error handling.
// This allows different property field types (Board Attributes, Custom Profile Attributes, etc.)
// to customize error messages while sharing the same error handling logic.
type PropertyFieldErrorConfig struct {
	// Operation is the operation name used in error messages (e.g., "CreateBoardAttributeField")
	Operation string
	// ErrorKeyPrefix is the prefix for error message keys (e.g., "app.board_attributes" or "app.custom_profile_attributes")
	ErrorKeyPrefix string
	// NotFoundKey is the error message key for not found errors (defaults to "property_field_not_found.app_error")
	NotFoundKey string
	// CreateKey is the error message key for create errors (defaults to "create_property_field.app_error")
	CreateKey string
	// UpdateKey is the error message key for update errors (defaults to "property_field_update.app_error")
	UpdateKey string
	// DeleteKey is the error message key for delete errors (defaults to "property_field_delete.app_error")
	DeleteKey string
	// GetKey is the error message key for get errors (defaults to "get_property_field.app_error")
	GetKey string
	// GenericKey is the error message key for generic errors (defaults to "generic_error.app_error")
	GenericKey string
}

// DefaultPropertyFieldErrorConfig returns a default configuration with common error keys.
// It uses the generic "app.property_field" prefix for error messages that are shared
// across all property field types (Board Attributes, Custom Profile Attributes, etc.).
func DefaultPropertyFieldErrorConfig(operation string) PropertyFieldErrorConfig {
	return PropertyFieldErrorConfig{
		Operation:      operation,
		ErrorKeyPrefix: "app.property_field", // Use generic prefix for shared errors
		NotFoundKey:    "property_field_not_found.app_error",
		CreateKey:      "create_property_field.app_error",
		UpdateKey:      "property_field_update.app_error",
		DeleteKey:      "property_field_delete.app_error",
		GetKey:         "get_property_field.app_error",
		GenericKey:     "generic_error.app_error",
	}
}

// HandlePropertyFieldError handles errors from property field operations and converts them
// to appropriate AppErrors. This function is shared across all property field types
// (Board Attributes, Custom Profile Attributes, and future property field editors).
//
// It handles the following error types:
//   - *model.AppError: Returns as-is (already an AppError)
//   - *store.ErrNotFound: Returns a 404 Not Found error
//   - sql.ErrNoRows: Returns a 404 Not Found error (legacy support)
//   - *store.ErrInvalidInput: Returns a 400 Bad Request error
//   - Other errors: Attempts to unwrap to find an AppError, otherwise returns 500 Internal Server Error
//
// The errorKey parameter specifies which error message key to use from the config.
// Common values: "create", "update", "delete", "get", "not_found", "generic"
func HandlePropertyFieldError(err error, config PropertyFieldErrorConfig, errorKey string) *model.AppError {
	if err == nil {
		return nil
	}

	// Check for AppError first (most specific)
	var appErr *model.AppError
	if errors.As(err, &appErr) {
		return appErr
	}

	// Check for store errors
	var nfErr *store.ErrNotFound
	if errors.As(err, &nfErr) {
		// For delete operations, use delete error key instead of not found key
		// This is because trying to delete a non-existent field is a delete operation error
		if errorKey == "delete" {
			key := config.DeleteKey
			if key == "" {
				key = "property_field_delete.app_error"
			}
			return model.NewAppError(
				config.Operation,
				config.ErrorKeyPrefix+"."+key,
				nil,
				"",
				http.StatusNotFound,
			).Wrap(err)
		}
		key := config.NotFoundKey
		if key == "" {
			key = "property_field_not_found.app_error"
		}
		return model.NewAppError(
			config.Operation,
			config.ErrorKeyPrefix+"."+key,
			nil,
			"",
			http.StatusNotFound,
		).Wrap(err)
	}

	// Check for sql.ErrNoRows (legacy support, used in some Get operations)
	if errors.Is(err, sql.ErrNoRows) {
		// For delete operations, use delete error key instead of not found key
		// This is because trying to delete a non-existent field is a delete operation error
		if errorKey == "delete" {
			key := config.DeleteKey
			if key == "" {
				key = "property_field_delete.app_error"
			}
			return model.NewAppError(
				config.Operation,
				config.ErrorKeyPrefix+"."+key,
				nil,
				"",
				http.StatusNotFound,
			).Wrap(err)
		}
		key := config.NotFoundKey
		if key == "" {
			key = "property_field_not_found.app_error"
		}
		return model.NewAppError(
			config.Operation,
			config.ErrorKeyPrefix+"."+key,
			nil,
			"",
			http.StatusNotFound,
		).Wrap(err)
	}

	// Check for invalid input errors
	var invalidInput *store.ErrInvalidInput
	if errors.As(err, &invalidInput) {
		key := config.CreateKey
		if errorKey == "update" {
			key = config.UpdateKey
		}
		if key == "" {
			key = "create_property_field.app_error"
		}
		return model.NewAppError(
			config.Operation,
			config.ErrorKeyPrefix+"."+key,
			nil,
			err.Error(),
			http.StatusBadRequest,
		).Wrap(err)
	}

	// Try to unwrap to find an AppError
	unwrapped := errors.Unwrap(err)
	if unwrapped != nil && errors.As(unwrapped, &appErr) {
		return appErr
	}

	// Default to internal server error
	key := config.GenericKey
	switch errorKey {
	case "create":
		key = config.CreateKey
		if key == "" {
			key = "create_property_field.app_error"
		}
	case "update":
		key = config.UpdateKey
		if key == "" {
			key = "property_field_update.app_error"
		}
	case "delete":
		key = config.DeleteKey
		if key == "" {
			key = "property_field_delete.app_error"
		}
	case "get":
		key = config.GetKey
		if key == "" {
			key = "get_property_field.app_error"
		}
	}
	if key == "" {
		key = "generic_error.app_error"
	}

	return model.NewAppError(
		config.Operation,
		config.ErrorKeyPrefix+"."+key,
		nil,
		"",
		http.StatusInternalServerError,
	).Wrap(err)
}
