// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// AppError Conversions
// =============================================================================

// appErrorToProto converts a model.AppError to a pb.AppError.
// Returns nil if the input is nil.
// Note: The params field in model.AppError is unexported, so it is not converted.
func appErrorToProto(appErr *model.AppError) *pb.AppError {
	if appErr == nil {
		return nil
	}

	return &pb.AppError{
		Id:            appErr.Id,
		Message:       appErr.Message,
		DetailedError: appErr.DetailedError,
		RequestId:     appErr.RequestId,
		StatusCode:    int32(appErr.StatusCode),
		Where:         appErr.Where,
		// Note: params is unexported in model.AppError, cannot be accessed
	}
}

// appErrorFromProto converts a pb.AppError to a model.AppError.
// Returns nil if the input is nil.
// Note: Use model.NewAppError to create AppErrors with params.
func appErrorFromProto(pbErr *pb.AppError) *model.AppError {
	if pbErr == nil {
		return nil
	}

	// Note: params from proto are passed via NewAppError if needed
	var params map[string]any
	if pbErr.Params != nil {
		params = pbErr.Params.AsMap()
	}

	return model.NewAppError(pbErr.Where, pbErr.Id, params, pbErr.DetailedError, int(pbErr.StatusCode))
}

// =============================================================================
// Permission Conversions
// =============================================================================

// permissionFromId creates a model.Permission from a permission ID string.
// This is used for the HasPermissionTo* API methods.
func permissionFromId(permissionId string) *model.Permission {
	// The model.Permission struct has Id and other fields.
	// For the HasPermissionTo* checks, we only need the Id.
	return &model.Permission{
		Id: permissionId,
	}
}
