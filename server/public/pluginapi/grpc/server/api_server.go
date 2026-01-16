// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package server provides the gRPC server implementation that wraps the
// Mattermost Plugin API interface.
//
// This server intentionally embeds UnimplementedPluginAPIServer to allow
// incremental implementation of RPC methods. Subsequent plans (04-02..04-04)
// will add method implementations for each API group (users, teams, channels,
// posts, KV store, etc.).
//
// Architecture:
//   - APIServer wraps a plugin.API implementation
//   - Each RPC method delegates to the corresponding plugin.API method
//   - Errors are converted from *model.AppError to gRPC status codes
//   - No network listeners are created here; listener lifecycle belongs to
//     Phase 5 supervisor integration
package server

import (
	"context"

	"google.golang.org/grpc"

	"github.com/mattermost/mattermost/server/public/plugin"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// APIServer implements the PluginAPI gRPC service by wrapping a plugin.API
// implementation. It embeds UnimplementedPluginAPIServer for forward
// compatibility.
type APIServer struct {
	pb.UnimplementedPluginAPIServer
	impl plugin.API
}

// NewAPIServer creates a new APIServer that wraps the given plugin.API
// implementation.
func NewAPIServer(impl plugin.API) *APIServer {
	return &APIServer{impl: impl}
}

// Register registers the APIServer with the given gRPC server.
func Register(grpcServer *grpc.Server, impl plugin.API) {
	pb.RegisterPluginAPIServer(grpcServer, NewAPIServer(impl))
}

// =============================================================================
// Smoke RPC Implementations
// These methods have minimal model conversion and serve as proof-of-concept
// implementations to validate the gRPC wiring works correctly.
// =============================================================================

// GetServerVersion returns the current Mattermost server version.
func (s *APIServer) GetServerVersion(ctx context.Context, req *pb.GetServerVersionRequest) (*pb.GetServerVersionResponse, error) {
	version := s.impl.GetServerVersion()
	return &pb.GetServerVersionResponse{
		Version: version,
	}, nil
}

// IsEnterpriseReady returns whether the Mattermost server is enterprise-ready.
func (s *APIServer) IsEnterpriseReady(ctx context.Context, req *pb.IsEnterpriseReadyRequest) (*pb.IsEnterpriseReadyResponse, error) {
	ready := s.impl.IsEnterpriseReady()
	return &pb.IsEnterpriseReadyResponse{
		IsEnterpriseReady: ready,
	}, nil
}
