// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// mapPropertyServiceError translates known errors from the property service /
// PropertyHook chain — package sentinels (properties.Err*) and store-layer
// errors (*store.ErrNotFound, *store.ErrConflict, *store.ErrResultsMismatch) —
// into HTTP-shaped AppErrors. Returns nil if err is not recognised and does
// not wrap an AppError; callers should fall back to wrapping with their own
// default 500 in that case.
//
// Sentinel matches take priority over a wrapped AppError so that hook code
// wrapping an inner AppError with a sentinel still drives the mapping.
//
// User-facing DetailedError is left empty on access-control rejections to
// avoid leaking field IDs, plugin IDs, and sync source names. The full
// chain remains available for operator logs via Wrap(err).
func mapPropertyServiceError(where string, err error) *model.AppError {
	if err == nil {
		return nil
	}

	switch {
	case errors.Is(err, properties.ErrAccessDenied):
		return model.NewAppError(where, "app.property.access_denied.app_error", nil, "", http.StatusForbidden).Wrap(err)
	case errors.Is(err, properties.ErrSyncLocked):
		return model.NewAppError(where, "app.property.sync_lock.app_error", nil, "", http.StatusForbidden).Wrap(err)
	case errors.Is(err, properties.ErrInvalidAccessMode):
		return model.NewAppError(where, "app.property.invalid_access_mode.app_error", nil, err.Error(), http.StatusBadRequest).Wrap(err)
	case errors.Is(err, properties.ErrFieldLimitReached):
		return model.NewAppError(where, "app.property_field.create.limit_reached.app_error", nil, err.Error(), http.StatusUnprocessableEntity).Wrap(err)
	case errors.Is(err, properties.ErrGroupFieldLimitReached):
		return model.NewAppError(where, "app.property_field.create.group_limit_reached.app_error", nil, err.Error(), http.StatusUnprocessableEntity).Wrap(err)
	case errors.Is(err, properties.ErrLicenseRequired):
		return model.NewAppError(where, "app.property.license_error", nil, "", http.StatusForbidden).Wrap(err)
	case errors.Is(err, properties.ErrInvalidFieldAttrs):
		return model.NewAppError(where, "app.property_field.invalid_attrs.app_error", nil, err.Error(), http.StatusBadRequest).Wrap(err)
	case errors.Is(err, properties.ErrInvalidValue):
		return model.NewAppError(where, "app.property_value.validate.app_error", nil, err.Error(), http.StatusBadRequest).Wrap(err)
	case errors.Is(err, properties.ErrAdminRequired):
		return model.NewAppError(where, "app.property_field.managed_admin.permission.app_error", nil, "", http.StatusForbidden).Wrap(err)
	case errors.Is(err, properties.ErrFieldNotFound):
		return model.NewAppError(where, "app.property_field.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	var conflictErr *store.ErrConflict
	if errors.As(err, &conflictErr) {
		return model.NewAppError(where, "app.property_field.update.conflict.app_error", nil, "concurrent modification detected; please retry", http.StatusConflict).Wrap(err)
	}

	var notFoundErr *store.ErrNotFound
	if errors.As(err, &notFoundErr) {
		return model.NewAppError(where, "app.property.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	var resultsMismatchErr *store.ErrResultsMismatch
	if errors.As(err, &resultsMismatchErr) {
		return model.NewAppError(where, "app.property.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	var appErr *model.AppError
	if errors.As(err, &appErr) {
		return appErr
	}

	return nil
}
