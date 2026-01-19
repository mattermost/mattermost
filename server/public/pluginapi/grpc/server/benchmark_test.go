// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"net"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// benchmarkHarness holds components for in-memory gRPC benchmarking.
// It uses bufconn for zero-network-overhead benchmarks.
type benchmarkHarness struct {
	listener *bufconn.Listener
	server   *grpc.Server
	conn     *grpc.ClientConn
	client   pb.PluginAPIClient
	mockAPI  *plugintest.API
}

// newBenchmarkHarness creates an in-memory gRPC server for benchmarking.
func newBenchmarkHarness(b *testing.B) *benchmarkHarness {
	b.Helper()

	const bufSize = 1024 * 1024 // 1MB buffer

	lis := bufconn.Listen(bufSize)
	mockAPI := &plugintest.API{}
	srv := grpc.NewServer()
	Register(srv, mockAPI)

	// Start server in background
	go func() {
		if err := srv.Serve(lis); err != nil {
			// Server stopped - expected on close
		}
	}()

	// Create client connection
	ctx := context.Background()
	conn, err := grpc.DialContext(ctx, "bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(b, err)

	client := pb.NewPluginAPIClient(conn)

	return &benchmarkHarness{
		listener: lis,
		server:   srv,
		conn:     conn,
		client:   client,
		mockAPI:  mockAPI,
	}
}

// close cleans up benchmark harness resources.
func (h *benchmarkHarness) close() {
	h.conn.Close()
	h.server.Stop()
	h.listener.Close()
}

// =============================================================================
// API Benchmarks
//
// These benchmarks measure gRPC overhead for API calls by using mock plugin.API
// implementations. This isolates gRPC serialization/deserialization and transport
// overhead from actual database operations.
// =============================================================================

// BenchmarkGetServerVersion measures GetServerVersion RPC latency.
// This is a minimal RPC with a simple string response.
func BenchmarkGetServerVersion(b *testing.B) {
	h := newBenchmarkHarness(b)
	defer h.close()

	h.mockAPI.On("GetServerVersion").Return("8.0.0")

	ctx := context.Background()
	req := &pb.GetServerVersionRequest{}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := h.client.GetServerVersion(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkGetUser measures GetUser RPC latency.
// This tests a typical "get single entity" API call with model conversion.
func BenchmarkGetUser(b *testing.B) {
	h := newBenchmarkHarness(b)
	defer h.close()

	testUser := &model.User{
		Id:            "user-id-123",
		Username:      "testuser",
		Email:         "test@example.com",
		Nickname:      "Test User",
		FirstName:     "Test",
		LastName:      "User",
		Position:      "Developer",
		Roles:         "system_user",
		Locale:        "en",
		CreateAt:      1609459200000,
		UpdateAt:      1609545600000,
		DeleteAt:      0,
		EmailVerified: true,
	}

	h.mockAPI.On("GetUser", "user-id-123").Return(testUser, nil)

	ctx := context.Background()
	req := &pb.GetUserRequest{UserId: "user-id-123"}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := h.client.GetUser(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkCreatePost measures CreatePost RPC latency.
// This tests a "create entity" API call with request and response conversion.
func BenchmarkCreatePost(b *testing.B) {
	h := newBenchmarkHarness(b)
	defer h.close()

	testPost := &model.Post{
		Id:        "post-id-456",
		ChannelId: "channel-id-789",
		UserId:    "user-id-123",
		Message:   "This is a test message for benchmarking the gRPC overhead.",
		CreateAt:  1609459200000,
		UpdateAt:  1609459200000,
	}

	// Use mock.Anything since post conversion may produce different struct values
	h.mockAPI.On("CreatePost", mock.Anything).Return(testPost, nil)

	ctx := context.Background()
	req := &pb.CreatePostRequest{
		Post: &pb.Post{
			ChannelId: "channel-id-789",
			UserId:    "user-id-123",
			Message:   "This is a test message for benchmarking the gRPC overhead.",
		},
	}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := h.client.CreatePost(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkGetChannel measures GetChannel RPC latency.
// This tests another common entity retrieval pattern.
func BenchmarkGetChannel(b *testing.B) {
	h := newBenchmarkHarness(b)
	defer h.close()

	testChannel := &model.Channel{
		Id:          "channel-id-789",
		TeamId:      "team-id-456",
		Type:        model.ChannelTypeOpen,
		DisplayName: "Test Channel",
		Name:        "test-channel",
		Header:      "Channel header",
		Purpose:     "Channel purpose",
		CreateAt:    1609459200000,
		UpdateAt:    1609459200000,
	}

	h.mockAPI.On("GetChannel", "channel-id-789").Return(testChannel, nil)

	ctx := context.Background()
	req := &pb.GetChannelRequest{ChannelId: "channel-id-789"}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := h.client.GetChannel(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkKVSet measures KVSet RPC latency.
// This tests key-value storage operations with byte data.
func BenchmarkKVSet(b *testing.B) {
	h := newBenchmarkHarness(b)
	defer h.close()

	testData := []byte(`{"key": "value", "count": 42, "nested": {"data": true}}`)

	h.mockAPI.On("KVSet", "test-key", testData).Return(nil)

	ctx := context.Background()
	req := &pb.KVSetRequest{
		Key:   "test-key",
		Value: testData,
	}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := h.client.KVSet(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkKVGet measures KVGet RPC latency.
// This tests reading data from key-value storage.
func BenchmarkKVGet(b *testing.B) {
	h := newBenchmarkHarness(b)
	defer h.close()

	testData := []byte(`{"key": "value", "count": 42, "nested": {"data": true}}`)

	h.mockAPI.On("KVGet", "test-key").Return(testData, nil)

	ctx := context.Background()
	req := &pb.KVGetRequest{
		Key: "test-key",
	}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := h.client.KVGet(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkHasPermissionTo measures permission check RPC latency.
// This is a critical hot-path operation in plugins.
func BenchmarkHasPermissionTo(b *testing.B) {
	h := newBenchmarkHarness(b)
	defer h.close()

	// Use mock.MatchedBy since the permission struct may have different fields populated
	h.mockAPI.On("HasPermissionTo", "user-id-123", mock.MatchedBy(func(p *model.Permission) bool {
		return p != nil && p.Id == "create_post"
	})).Return(true)

	ctx := context.Background()
	req := &pb.HasPermissionToRequest{
		UserId:       "user-id-123",
		PermissionId: "create_post",
	}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := h.client.HasPermissionTo(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkIsEnterpriseReady measures IsEnterpriseReady RPC latency.
// This is a simple boolean response test.
func BenchmarkIsEnterpriseReady(b *testing.B) {
	h := newBenchmarkHarness(b)
	defer h.close()

	h.mockAPI.On("IsEnterpriseReady").Return(true)

	ctx := context.Background()
	req := &pb.IsEnterpriseReadyRequest{}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := h.client.IsEnterpriseReady(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

