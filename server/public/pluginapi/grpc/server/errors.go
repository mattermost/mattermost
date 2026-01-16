// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"net/http"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/mattermost/mattermost/server/public/model"
)

// httpToGRPCCode maps HTTP status codes to gRPC status codes.
// This follows the mapping specified in Phase 1 research.
var httpToGRPCCode = map[int]codes.Code{
	http.StatusBadRequest:          codes.InvalidArgument,  // 400
	http.StatusUnauthorized:        codes.Unauthenticated,  // 401
	http.StatusForbidden:           codes.PermissionDenied, // 403
	http.StatusNotFound:            codes.NotFound,         // 404
	http.StatusConflict:            codes.AlreadyExists,    // 409
	http.StatusRequestEntityTooLarge: codes.ResourceExhausted, // 413
	http.StatusTooManyRequests:     codes.ResourceExhausted, // 429
	http.StatusNotImplemented:      codes.Unimplemented,     // 501
	http.StatusServiceUnavailable:  codes.Unavailable,       // 503
}

// AppErrorToStatus converts a Mattermost AppError to a gRPC status error.
// If appErr is nil, nil is returned. The HTTP status code from the AppError
// is mapped to the appropriate gRPC status code using the httpToGRPCCode map.
// Unknown HTTP status codes default to Internal (500).
//
// The error message includes the AppError's Id for categorization and the
// Message for user-facing display.
func AppErrorToStatus(appErr *model.AppError) error {
	if appErr == nil {
		return nil
	}

	code, ok := httpToGRPCCode[appErr.StatusCode]
	if !ok {
		code = codes.Internal
	}

	return status.Errorf(code, "%s: %s", appErr.Id, appErr.Message)
}

// ErrorToStatus converts a generic error to a gRPC status error.
// If err is nil, nil is returned.
// If err is already a gRPC status error, it is returned as-is.
// If err is a *model.AppError, it is converted using AppErrorToStatus.
// Otherwise, the error is wrapped as codes.Internal.
func ErrorToStatus(err error) error {
	if err == nil {
		return nil
	}

	// Check if already a gRPC status error
	if _, ok := status.FromError(err); ok {
		return err
	}

	// Check if it's an AppError
	if appErr, ok := err.(*model.AppError); ok {
		return AppErrorToStatus(appErr)
	}

	// Default to Internal error
	return status.Errorf(codes.Internal, "internal error: %v", err)
}
