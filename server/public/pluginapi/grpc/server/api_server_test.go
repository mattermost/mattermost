// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"net"
	"net/http"
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

const bufSize = 1024 * 1024

// testHarness holds the components needed for in-memory gRPC testing.
type testHarness struct {
	listener *bufconn.Listener
	server   *grpc.Server
	conn     *grpc.ClientConn
	client   pb.PluginAPIClient
	mockAPI  *plugintest.API
}

// newTestHarness creates an in-memory gRPC server with a mock plugin.API.
func newTestHarness(t *testing.T) *testHarness {
	t.Helper()

	lis := bufconn.Listen(bufSize)
	mockAPI := &plugintest.API{}
	srv := grpc.NewServer()
	Register(srv, mockAPI)

	// Start server in background
	go func() {
		if err := srv.Serve(lis); err != nil {
			// Server stopped, which is expected on close
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
	require.NoError(t, err)

	client := pb.NewPluginAPIClient(conn)

	return &testHarness{
		listener: lis,
		server:   srv,
		conn:     conn,
		client:   client,
		mockAPI:  mockAPI,
	}
}

// close cleans up the test harness resources.
func (h *testHarness) close() {
	h.conn.Close()
	h.server.Stop()
	h.listener.Close()
}

// =============================================================================
// Smoke Tests
// =============================================================================

func TestGetServerVersion(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedVersion := "8.0.0"
	h.mockAPI.On("GetServerVersion").Return(expectedVersion)

	resp, err := h.client.GetServerVersion(context.Background(), &pb.GetServerVersionRequest{})
	require.NoError(t, err)
	assert.Equal(t, expectedVersion, resp.GetVersion())

	h.mockAPI.AssertExpectations(t)
}

func TestIsEnterpriseReady(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("IsEnterpriseReady").Return(true)

	resp, err := h.client.IsEnterpriseReady(context.Background(), &pb.IsEnterpriseReadyRequest{})
	require.NoError(t, err)
	assert.True(t, resp.GetIsEnterpriseReady())

	h.mockAPI.AssertExpectations(t)
}

func TestIsEnterpriseReady_False(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("IsEnterpriseReady").Return(false)

	resp, err := h.client.IsEnterpriseReady(context.Background(), &pb.IsEnterpriseReadyRequest{})
	require.NoError(t, err)
	assert.False(t, resp.GetIsEnterpriseReady())

	h.mockAPI.AssertExpectations(t)
}

// =============================================================================
// Error Conversion Tests
// =============================================================================

func TestAppErrorToStatus_Nil(t *testing.T) {
	err := AppErrorToStatus(nil)
	assert.Nil(t, err)
}

func TestAppErrorToStatus_BadRequest(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.bad_request",
		Message:    "Invalid input",
		StatusCode: http.StatusBadRequest,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.InvalidArgument, st.Code())
	assert.Contains(t, st.Message(), "test.bad_request")
	assert.Contains(t, st.Message(), "Invalid input")
}

func TestAppErrorToStatus_NotFound(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.not_found",
		Message:    "Resource not found",
		StatusCode: http.StatusNotFound,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.NotFound, st.Code())
}

func TestAppErrorToStatus_Unauthorized(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.unauthorized",
		Message:    "Not authenticated",
		StatusCode: http.StatusUnauthorized,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.Unauthenticated, st.Code())
}

func TestAppErrorToStatus_Forbidden(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.forbidden",
		Message:    "Permission denied",
		StatusCode: http.StatusForbidden,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.PermissionDenied, st.Code())
}

func TestAppErrorToStatus_Conflict(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.conflict",
		Message:    "Already exists",
		StatusCode: http.StatusConflict,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.AlreadyExists, st.Code())
}

func TestAppErrorToStatus_TooManyRequests(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.rate_limited",
		Message:    "Rate limited",
		StatusCode: http.StatusTooManyRequests,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.ResourceExhausted, st.Code())
}

func TestAppErrorToStatus_NotImplemented(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.not_implemented",
		Message:    "Not implemented",
		StatusCode: http.StatusNotImplemented,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.Unimplemented, st.Code())
}

func TestAppErrorToStatus_ServiceUnavailable(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.unavailable",
		Message:    "Service unavailable",
		StatusCode: http.StatusServiceUnavailable,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.Unavailable, st.Code())
}

func TestAppErrorToStatus_UnknownCode(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.internal",
		Message:    "Internal error",
		StatusCode: http.StatusInternalServerError,
	}

	err := AppErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
}

func TestErrorToStatus_Nil(t *testing.T) {
	err := ErrorToStatus(nil)
	assert.Nil(t, err)
}

func TestErrorToStatus_AppError(t *testing.T) {
	appErr := &model.AppError{
		Id:         "test.bad_request",
		Message:    "Invalid input",
		StatusCode: http.StatusBadRequest,
	}

	err := ErrorToStatus(appErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.InvalidArgument, st.Code())
}

func TestErrorToStatus_GRPCError(t *testing.T) {
	grpcErr := status.Errorf(codes.PermissionDenied, "permission denied")

	err := ErrorToStatus(grpcErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.PermissionDenied, st.Code())
}

func TestErrorToStatus_GenericError(t *testing.T) {
	genericErr := assert.AnError

	err := ErrorToStatus(genericErr)
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
}
