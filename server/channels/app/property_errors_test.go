// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMapPropertyServiceError(t *testing.T) {
	t.Run("nil err returns nil", func(t *testing.T) {
		require.Nil(t, mapPropertyServiceError("Where", nil))
	})

	t.Run("unknown err returns nil so caller can 500-wrap", func(t *testing.T) {
		require.Nil(t, mapPropertyServiceError("Where", errors.New("db connection lost")))
	})

	t.Run("unwrapped AppError is returned as-is via fallback", func(t *testing.T) {
		orig := model.NewAppError("SomeSource", "some.id", nil, "detail", http.StatusTeapot)
		got := mapPropertyServiceError("Where", orig)
		require.NotNil(t, got)
		assert.Same(t, orig, got)
	})

	sentinelCases := []struct {
		name           string
		sentinel       error
		expectedID     string
		expectedStatus int
		expectDetail   bool
	}{
		{
			name:           "access denied",
			sentinel:       properties.ErrAccessDenied,
			expectedID:     "app.property.access_denied.app_error",
			expectedStatus: http.StatusForbidden,
			expectDetail:   false,
		},
		{
			name:           "sync locked",
			sentinel:       properties.ErrSyncLocked,
			expectedID:     "app.property.sync_lock.app_error",
			expectedStatus: http.StatusForbidden,
			expectDetail:   false,
		},
		{
			name:           "invalid access mode",
			sentinel:       properties.ErrInvalidAccessMode,
			expectedID:     "app.property.invalid_access_mode.app_error",
			expectedStatus: http.StatusBadRequest,
			expectDetail:   true,
		},
		{
			name:           "field limit reached",
			sentinel:       properties.ErrFieldLimitReached,
			expectedID:     "app.property_field.create.limit_reached.app_error",
			expectedStatus: http.StatusUnprocessableEntity,
			expectDetail:   true,
		},
		{
			name:           "group field limit reached",
			sentinel:       properties.ErrGroupFieldLimitReached,
			expectedID:     "app.property_field.create.group_limit_reached.app_error",
			expectedStatus: http.StatusUnprocessableEntity,
			expectDetail:   true,
		},
		{
			name:           "license required",
			sentinel:       properties.ErrLicenseRequired,
			expectedID:     "app.property.license_error",
			expectedStatus: http.StatusForbidden,
			expectDetail:   false,
		},
		{
			name:           "invalid field attrs",
			sentinel:       properties.ErrInvalidFieldAttrs,
			expectedID:     "app.property_field.invalid_attrs.app_error",
			expectedStatus: http.StatusBadRequest,
			expectDetail:   true,
		},
		{
			name:           "invalid value",
			sentinel:       properties.ErrInvalidValue,
			expectedID:     "app.property_value.validate.app_error",
			expectedStatus: http.StatusBadRequest,
			expectDetail:   true,
		},
		{
			name:           "admin required",
			sentinel:       properties.ErrAdminRequired,
			expectedID:     "app.property_field.managed_admin.permission.app_error",
			expectedStatus: http.StatusForbidden,
			expectDetail:   false,
		},
		{
			name:           "field not found",
			sentinel:       properties.ErrFieldNotFound,
			expectedID:     "app.property_field.not_found.app_error",
			expectedStatus: http.StatusNotFound,
			expectDetail:   false,
		},
	}

	for _, tc := range sentinelCases {
		t.Run("direct sentinel: "+tc.name, func(t *testing.T) {
			got := mapPropertyServiceError("Where", tc.sentinel)
			require.NotNil(t, got)
			assert.Equal(t, tc.expectedID, got.Id)
			assert.Equal(t, tc.expectedStatus, got.StatusCode)
			assert.Equal(t, "Where", got.Where)
			if tc.expectDetail {
				assert.NotEmpty(t, got.DetailedError, "sentinel %s should carry operator-facing detail", tc.name)
			} else {
				assert.Empty(t, got.DetailedError, "sentinel %s should redact detail to avoid leaking internal identifiers", tc.name)
			}
		})

		t.Run("wrapped sentinel detected through chain: "+tc.name, func(t *testing.T) {
			wrapped := fmt.Errorf("outer context: %w", fmt.Errorf("inner context: %w", tc.sentinel))
			got := mapPropertyServiceError("Where", wrapped)
			require.NotNil(t, got)
			assert.Equal(t, tc.expectedID, got.Id)
			assert.Equal(t, tc.expectedStatus, got.StatusCode)
		})
	}

	t.Run("sentinel priority over wrapped AppError", func(t *testing.T) {
		// A hook that wraps an AppError with a sentinel should be mapped by
		// the sentinel, not by the embedded AppError.
		inner := model.NewAppError("OldPath", "old.id", nil, "old detail", http.StatusTeapot)
		wrapped := fmt.Errorf("authz denied: %w: %w", properties.ErrAccessDenied, inner)
		got := mapPropertyServiceError("Where", wrapped)
		require.NotNil(t, got)
		assert.Equal(t, "app.property.access_denied.app_error", got.Id)
		assert.Equal(t, http.StatusForbidden, got.StatusCode)
	})
}
