// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Integration Test Harness for Python Plugin Simulation
// =============================================================================

// pythonPluginTestHarness simulates a Python plugin for integration testing.
// It creates an in-memory gRPC server that implements both the PluginAPI (Go server side)
// and PluginHooks (Python plugin side) to test round-trip communication.
type pythonPluginTestHarness struct {
	// API Server side (Go server calls Python plugin)
	apiListener *bufconn.Listener
	apiServer   *grpc.Server
	apiConn     *grpc.ClientConn
	apiClient   pb.PluginAPIClient
	mockAPI     *plugintest.API

	// Hooks Server side (simulates Python plugin responding to hooks)
	hooksListener *bufconn.Listener
	hooksServer   *grpc.Server
	hooksConn     *grpc.ClientConn
	hooksClient   pb.PluginHooksClient
}

// fakePluginHooksServer implements PluginHooksServer to simulate a Python plugin.
type fakePluginHooksServer struct {
	pb.UnimplementedPluginHooksServer

	implementedHooks []string
	activated        bool
	deactivated      bool
	configChanged    bool
	receivedPosts    []*pb.Post

	// Callbacks to customize behavior
	onActivateCallback      func() error
	messageWillBePostedMod  func(*pb.Post) (*pb.Post, string)
	apiClientForCallback    pb.PluginAPIClient
	callbackTriggeredAPIs   []string
}

func newFakePluginHooksServer() *fakePluginHooksServer {
	return &fakePluginHooksServer{
		implementedHooks: []string{
			"OnActivate",
			"OnDeactivate",
			"OnConfigurationChange",
			"MessageWillBePosted",
			"MessageHasBeenPosted",
		},
	}
}

func (s *fakePluginHooksServer) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	return &pb.ImplementedResponse{
		Hooks: s.implementedHooks,
	}, nil
}

func (s *fakePluginHooksServer) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	s.activated = true

	if s.onActivateCallback != nil {
		if err := s.onActivateCallback(); err != nil {
			return &pb.OnActivateResponse{
				Error: &pb.AppError{
					Id:         "plugin.activation.failed",
					Message:    err.Error(),
					StatusCode: 500,
				},
			}, nil
		}
	}

	return &pb.OnActivateResponse{}, nil
}

func (s *fakePluginHooksServer) OnDeactivate(ctx context.Context, req *pb.OnDeactivateRequest) (*pb.OnDeactivateResponse, error) {
	s.deactivated = true
	return &pb.OnDeactivateResponse{}, nil
}

func (s *fakePluginHooksServer) OnConfigurationChange(ctx context.Context, req *pb.OnConfigurationChangeRequest) (*pb.OnConfigurationChangeResponse, error) {
	s.configChanged = true
	return &pb.OnConfigurationChangeResponse{}, nil
}

func (s *fakePluginHooksServer) MessageWillBePosted(ctx context.Context, req *pb.MessageWillBePostedRequest) (*pb.MessageWillBePostedResponse, error) {
	s.receivedPosts = append(s.receivedPosts, req.Post)

	if s.messageWillBePostedMod != nil {
		modifiedPost, rejection := s.messageWillBePostedMod(req.Post)
		if rejection != "" {
			return &pb.MessageWillBePostedResponse{
				RejectionReason: rejection,
			}, nil
		}
		if modifiedPost != nil {
			return &pb.MessageWillBePostedResponse{
				ModifiedPost: modifiedPost,
			}, nil
		}
	}

	return &pb.MessageWillBePostedResponse{}, nil
}

func (s *fakePluginHooksServer) MessageHasBeenPosted(ctx context.Context, req *pb.MessageHasBeenPostedRequest) (*pb.MessageHasBeenPostedResponse, error) {
	// Notification-only hook, just track that we received it
	s.receivedPosts = append(s.receivedPosts, req.Post)

	// If we have an API client, trigger a callback to test round-trip
	if s.apiClientForCallback != nil {
		resp, err := s.apiClientForCallback.GetServerVersion(ctx, &pb.GetServerVersionRequest{})
		if err == nil && resp != nil {
			s.callbackTriggeredAPIs = append(s.callbackTriggeredAPIs, "GetServerVersion:"+resp.Version)
		}
	}

	return &pb.MessageHasBeenPostedResponse{}, nil
}

// newPythonPluginTestHarness creates a test harness for Python plugin integration testing.
func newPythonPluginTestHarness(t *testing.T) *pythonPluginTestHarness {
	t.Helper()

	h := &pythonPluginTestHarness{}

	// Set up API server (Go side)
	h.apiListener = bufconn.Listen(bufSize)
	h.mockAPI = &plugintest.API{}
	h.apiServer = grpc.NewServer()
	Register(h.apiServer, h.mockAPI)

	go func() {
		if err := h.apiServer.Serve(h.apiListener); err != nil {
			// Server stopped
		}
	}()

	ctx := context.Background()
	apiConn, err := grpc.DialContext(ctx, "bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return h.apiListener.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)
	h.apiConn = apiConn
	h.apiClient = pb.NewPluginAPIClient(apiConn)

	// Set up Hooks server (simulated Python plugin side)
	h.hooksListener = bufconn.Listen(bufSize)
	h.hooksServer = grpc.NewServer()

	return h
}

// registerFakePlugin registers a fake plugin hooks server.
func (h *pythonPluginTestHarness) registerFakePlugin(t *testing.T, hooks *fakePluginHooksServer) {
	pb.RegisterPluginHooksServer(h.hooksServer, hooks)

	go func() {
		if err := h.hooksServer.Serve(h.hooksListener); err != nil {
			// Server stopped
		}
	}()

	ctx := context.Background()
	hooksConn, err := grpc.DialContext(ctx, "bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return h.hooksListener.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)
	h.hooksConn = hooksConn
	h.hooksClient = pb.NewPluginHooksClient(hooksConn)
}

func (h *pythonPluginTestHarness) close() {
	if h.apiConn != nil {
		h.apiConn.Close()
	}
	if h.hooksConn != nil {
		h.hooksConn.Close()
	}
	if h.apiServer != nil {
		h.apiServer.Stop()
	}
	if h.hooksServer != nil {
		h.hooksServer.Stop()
	}
	if h.apiListener != nil {
		h.apiListener.Close()
	}
	if h.hooksListener != nil {
		h.hooksListener.Close()
	}
}

// =============================================================================
// Python Plugin Lifecycle Integration Tests
// =============================================================================

// TestPythonPluginLifecycle tests the complete lifecycle of a Python-style plugin:
// Start fake plugin, call OnActivate, verify response, call OnDeactivate.
func TestPythonPluginLifecycle(t *testing.T) {
	h := newPythonPluginTestHarness(t)
	defer h.close()

	fakePlugin := newFakePluginHooksServer()
	h.registerFakePlugin(t, fakePlugin)

	ctx := context.Background()

	// Step 1: Query implemented hooks
	implResp, err := h.hooksClient.Implemented(ctx, &pb.ImplementedRequest{})
	require.NoError(t, err)
	assert.Contains(t, implResp.Hooks, "OnActivate")
	assert.Contains(t, implResp.Hooks, "OnDeactivate")
	assert.Contains(t, implResp.Hooks, "MessageWillBePosted")

	// Step 2: Call OnConfigurationChange (called before OnActivate)
	configResp, err := h.hooksClient.OnConfigurationChange(ctx, &pb.OnConfigurationChangeRequest{})
	require.NoError(t, err)
	assert.Nil(t, configResp.Error)
	assert.True(t, fakePlugin.configChanged)

	// Step 3: Call OnActivate
	activateResp, err := h.hooksClient.OnActivate(ctx, &pb.OnActivateRequest{})
	require.NoError(t, err)
	assert.Nil(t, activateResp.Error)
	assert.True(t, fakePlugin.activated)

	// Step 4: Call OnDeactivate
	deactivateResp, err := h.hooksClient.OnDeactivate(ctx, &pb.OnDeactivateRequest{})
	require.NoError(t, err)
	assert.Nil(t, deactivateResp.Error)
	assert.True(t, fakePlugin.deactivated)
}

// TestPythonPluginAPICall tests that a Python plugin can call back to the API server.
// This proves the round-trip: Go -> gRPC -> Python -> gRPC -> Go.
func TestPythonPluginAPICall(t *testing.T) {
	h := newPythonPluginTestHarness(t)
	defer h.close()

	// Set up mock API expectations
	expectedVersion := "9.5.0-integration-test"
	h.mockAPI.On("GetServerVersion").Return(expectedVersion)

	fakePlugin := newFakePluginHooksServer()
	// Give the fake plugin access to the API client so it can call back
	fakePlugin.apiClientForCallback = h.apiClient

	h.registerFakePlugin(t, fakePlugin)

	ctx := context.Background()

	// First, activate the plugin
	_, err := h.hooksClient.OnActivate(ctx, &pb.OnActivateRequest{})
	require.NoError(t, err)

	// Now invoke MessageHasBeenPosted, which triggers the plugin to call GetServerVersion
	testPost := &pb.Post{
		Id:        "post123",
		Message:   "Hello from integration test",
		UserId:    "user123",
		ChannelId: "channel123",
	}

	_, err = h.hooksClient.MessageHasBeenPosted(ctx, &pb.MessageHasBeenPostedRequest{
		PluginContext: &pb.PluginContext{
			SessionId: "session123",
			RequestId: "request123",
		},
		Post: testPost,
	})
	require.NoError(t, err)

	// Verify the plugin received the post
	require.Len(t, fakePlugin.receivedPosts, 1)
	assert.Equal(t, "Hello from integration test", fakePlugin.receivedPosts[0].Message)

	// Verify the plugin called the API
	require.Len(t, fakePlugin.callbackTriggeredAPIs, 1)
	assert.Equal(t, "GetServerVersion:"+expectedVersion, fakePlugin.callbackTriggeredAPIs[0])

	h.mockAPI.AssertExpectations(t)
}

// TestPythonPluginHookChain tests that MessageWillBePosted can modify posts.
func TestPythonPluginHookChain(t *testing.T) {
	h := newPythonPluginTestHarness(t)
	defer h.close()

	fakePlugin := newFakePluginHooksServer()

	// Configure the plugin to modify posts containing "uppercase"
	fakePlugin.messageWillBePostedMod = func(post *pb.Post) (*pb.Post, string) {
		if post.Message == "reject this" {
			return nil, "Message rejected by plugin"
		}
		if post.Message == "make uppercase" {
			modifiedPost := &pb.Post{
				Id:        post.Id,
				Message:   "MAKE UPPERCASE",
				UserId:    post.UserId,
				ChannelId: post.ChannelId,
			}
			return modifiedPost, ""
		}
		return nil, "" // Allow without modification
	}

	h.registerFakePlugin(t, fakePlugin)

	ctx := context.Background()

	// Test 1: Normal message passes through unchanged
	normalResp, err := h.hooksClient.MessageWillBePosted(ctx, &pb.MessageWillBePostedRequest{
		PluginContext: &pb.PluginContext{SessionId: "sess1", RequestId: "req1"},
		Post: &pb.Post{
			Id:        "post1",
			Message:   "normal message",
			UserId:    "user1",
			ChannelId: "chan1",
		},
	})
	require.NoError(t, err)
	assert.Empty(t, normalResp.RejectionReason)
	assert.Nil(t, normalResp.ModifiedPost)

	// Test 2: Message gets modified
	modifyResp, err := h.hooksClient.MessageWillBePosted(ctx, &pb.MessageWillBePostedRequest{
		PluginContext: &pb.PluginContext{SessionId: "sess2", RequestId: "req2"},
		Post: &pb.Post{
			Id:        "post2",
			Message:   "make uppercase",
			UserId:    "user2",
			ChannelId: "chan2",
		},
	})
	require.NoError(t, err)
	assert.Empty(t, modifyResp.RejectionReason)
	require.NotNil(t, modifyResp.ModifiedPost)
	assert.Equal(t, "MAKE UPPERCASE", modifyResp.ModifiedPost.Message)

	// Test 3: Message gets rejected
	rejectResp, err := h.hooksClient.MessageWillBePosted(ctx, &pb.MessageWillBePostedRequest{
		PluginContext: &pb.PluginContext{SessionId: "sess3", RequestId: "req3"},
		Post: &pb.Post{
			Id:        "post3",
			Message:   "reject this",
			UserId:    "user3",
			ChannelId: "chan3",
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "Message rejected by plugin", rejectResp.RejectionReason)
	assert.Nil(t, rejectResp.ModifiedPost)

	// Verify all posts were received by the plugin
	assert.Len(t, fakePlugin.receivedPosts, 3)
}

// TestPythonPluginActivationFailure tests that activation errors are properly returned.
func TestPythonPluginActivationFailure(t *testing.T) {
	h := newPythonPluginTestHarness(t)
	defer h.close()

	fakePlugin := newFakePluginHooksServer()
	fakePlugin.onActivateCallback = func() error {
		return assert.AnError // Simulate activation failure
	}

	h.registerFakePlugin(t, fakePlugin)

	ctx := context.Background()

	// Call OnActivate - should succeed at gRPC level but return error in response
	activateResp, err := h.hooksClient.OnActivate(ctx, &pb.OnActivateRequest{})
	require.NoError(t, err) // gRPC call succeeds
	require.NotNil(t, activateResp.Error)
	assert.Equal(t, "plugin.activation.failed", activateResp.Error.Id)
	assert.Contains(t, activateResp.Error.Message, "assert.AnError")
}

// TestPythonPluginAPIErrorPropagation tests that API errors are properly converted to gRPC status.
func TestPythonPluginAPIErrorPropagation(t *testing.T) {
	h := newPythonPluginTestHarness(t)
	defer h.close()

	// Set up mock API to return an error
	h.mockAPI.On("GetUser", "nonexistent-user").Return(nil, model.NewAppError(
		"GetUser",
		"api.user.get.not_found.app_error",
		nil,
		"",
		404,
	))

	ctx := context.Background()

	// Call GetUser via the API client - should fail with gRPC error
	_, err := h.apiClient.GetUser(ctx, &pb.GetUserRequest{
		UserId: "nonexistent-user",
	})
	require.Error(t, err)

	// Verify it's a gRPC error with NotFound code
	st, ok := status.FromError(err)
	require.True(t, ok, "Expected gRPC status error")
	assert.Equal(t, codes.NotFound, st.Code())
	assert.Contains(t, st.Message(), "api.user.get.not_found.app_error")

	h.mockAPI.AssertExpectations(t)
}

// TestIntegrationConcurrentHookCalls tests concurrent hook invocations.
func TestIntegrationConcurrentHookCalls(t *testing.T) {
	h := newPythonPluginTestHarness(t)
	defer h.close()

	fakePlugin := newFakePluginHooksServer()
	h.registerFakePlugin(t, fakePlugin)

	ctx := context.Background()

	// Activate first
	_, err := h.hooksClient.OnActivate(ctx, &pb.OnActivateRequest{})
	require.NoError(t, err)

	// Send 10 concurrent hook calls
	numCalls := 10
	done := make(chan error, numCalls)

	for i := 0; i < numCalls; i++ {
		go func(idx int) {
			_, err := h.hooksClient.MessageHasBeenPosted(ctx, &pb.MessageHasBeenPostedRequest{
				PluginContext: &pb.PluginContext{
					SessionId: "session",
					RequestId: "request",
				},
				Post: &pb.Post{
					Id:        "post",
					Message:   "concurrent message",
					UserId:    "user",
					ChannelId: "channel",
				},
			})
			done <- err
		}(i)
	}

	// Wait for all calls to complete
	for i := 0; i < numCalls; i++ {
		err := <-done
		require.NoError(t, err)
	}

	// Verify all messages were received
	assert.Len(t, fakePlugin.receivedPosts, numCalls)
}
