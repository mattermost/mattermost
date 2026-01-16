// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// KV Store API Handlers
// =============================================================================

// KVSet stores a key-value pair.
func (s *APIServer) KVSet(ctx context.Context, req *pb.KVSetRequest) (*pb.KVSetResponse, error) {
	appErr := s.impl.KVSet(req.Key, req.Value)
	return &pb.KVSetResponse{
		Error: appErrorToProto(appErr),
	}, nil
}

// KVCompareAndSet atomically compares and sets a value.
func (s *APIServer) KVCompareAndSet(ctx context.Context, req *pb.KVCompareAndSetRequest) (*pb.KVCompareAndSetResponse, error) {
	ok, appErr := s.impl.KVCompareAndSet(req.Key, req.OldValue, req.NewValue)
	return &pb.KVCompareAndSetResponse{
		Error:   appErrorToProto(appErr),
		Success: ok,
	}, nil
}

// KVCompareAndDelete atomically compares and deletes a value.
func (s *APIServer) KVCompareAndDelete(ctx context.Context, req *pb.KVCompareAndDeleteRequest) (*pb.KVCompareAndDeleteResponse, error) {
	ok, appErr := s.impl.KVCompareAndDelete(req.Key, req.OldValue)
	return &pb.KVCompareAndDeleteResponse{
		Error:   appErrorToProto(appErr),
		Success: ok,
	}, nil
}

// KVSetWithOptions stores a key-value pair with options.
func (s *APIServer) KVSetWithOptions(ctx context.Context, req *pb.KVSetWithOptionsRequest) (*pb.KVSetWithOptionsResponse, error) {
	opts := pluginKVSetOptionsFromProto(req.Options)
	ok, appErr := s.impl.KVSetWithOptions(req.Key, req.Value, opts)
	return &pb.KVSetWithOptionsResponse{
		Error:   appErrorToProto(appErr),
		Success: ok,
	}, nil
}

// KVSetWithExpiry stores a key-value pair with expiration.
func (s *APIServer) KVSetWithExpiry(ctx context.Context, req *pb.KVSetWithExpiryRequest) (*pb.KVSetWithExpiryResponse, error) {
	appErr := s.impl.KVSetWithExpiry(req.Key, req.Value, req.ExpireInSeconds)
	return &pb.KVSetWithExpiryResponse{
		Error: appErrorToProto(appErr),
	}, nil
}

// KVGet retrieves a value by key.
func (s *APIServer) KVGet(ctx context.Context, req *pb.KVGetRequest) (*pb.KVGetResponse, error) {
	value, appErr := s.impl.KVGet(req.Key)
	return &pb.KVGetResponse{
		Error: appErrorToProto(appErr),
		Value: value,
	}, nil
}

// KVDelete removes a key-value pair.
func (s *APIServer) KVDelete(ctx context.Context, req *pb.KVDeleteRequest) (*pb.KVDeleteResponse, error) {
	appErr := s.impl.KVDelete(req.Key)
	return &pb.KVDeleteResponse{
		Error: appErrorToProto(appErr),
	}, nil
}

// KVDeleteAll removes all key-value pairs for the plugin.
func (s *APIServer) KVDeleteAll(ctx context.Context, req *pb.KVDeleteAllRequest) (*pb.KVDeleteAllResponse, error) {
	appErr := s.impl.KVDeleteAll()
	return &pb.KVDeleteAllResponse{
		Error: appErrorToProto(appErr),
	}, nil
}

// KVList lists all keys for the plugin.
func (s *APIServer) KVList(ctx context.Context, req *pb.KVListRequest) (*pb.KVListResponse, error) {
	keys, appErr := s.impl.KVList(int(req.Page), int(req.PerPage))
	return &pb.KVListResponse{
		Error: appErrorToProto(appErr),
		Keys:  keys,
	}, nil
}
