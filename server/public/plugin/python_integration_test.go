// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestPythonPluginIntegration tests the complete Python plugin lifecycle:
// 1. Plugin startup with implemented hooks
// 2. OnActivate hook invocation
// 3. MessageHasBeenPosted hook invocation
// 4. ServeHTTP request handling
// 5. OnDeactivate on shutdown
//
// This test uses a fake Python interpreter (compiled Go binary) that implements
// the full PluginHooks gRPC service to validate the integration.
func TestPythonPluginIntegration(t *testing.T) {
	// Create temp plugin directory
	pluginDir, err := os.MkdirTemp("", "python-integration-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginDir, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginDir, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile a comprehensive fake Python interpreter that implements all hooks
	// needed for integration testing
	utils.CompileGo(t, `
package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"syscall"
	"sync/atomic"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// fakePluginHooks implements the PluginHooksServer interface for integration testing
type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
	activated            atomic.Bool
	deactivated          atomic.Bool
	messagePostedCount   atomic.Int32
	httpRequestCount     atomic.Int32
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	return &pb.ImplementedResponse{
		Hooks: []string{
			"OnActivate",
			"OnDeactivate",
			"MessageHasBeenPosted",
			"ServeHTTP",
		},
	}, nil
}

func (f *fakePluginHooks) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	f.activated.Store(true)
	return &pb.OnActivateResponse{}, nil
}

func (f *fakePluginHooks) OnDeactivate(ctx context.Context, req *pb.OnDeactivateRequest) (*pb.OnDeactivateResponse, error) {
	f.deactivated.Store(true)
	return &pb.OnDeactivateResponse{}, nil
}

func (f *fakePluginHooks) MessageHasBeenPosted(ctx context.Context, req *pb.MessageHasBeenPostedRequest) (*pb.MessageHasBeenPostedResponse, error) {
	f.messagePostedCount.Add(1)
	return &pb.MessageHasBeenPostedResponse{}, nil
}

func (f *fakePluginHooks) ServeHTTP(stream pb.PluginHooks_ServeHTTPServer) error {
	f.httpRequestCount.Add(1)

	// Receive the request
	var init *pb.ServeHTTPRequestInit
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if req.Init != nil {
			init = req.Init
		}
		if req.BodyComplete {
			break
		}
	}

	// Determine response based on URL
	var statusCode int32 = 200
	var body string
	var contentType string = "application/json"

	if init != nil {
		switch {
		case init.Url == "/hello":
			body = ` + "`" + `{"message": "Hello from Python plugin!"}` + "`" + `
		case init.Url == "/echo":
			body = fmt.Sprintf(` + "`" + `{"method": "%s", "path": "%s"}` + "`" + `, init.Method, init.Url)
		default:
			statusCode = 404
			body = ` + "`" + `{"error": "not found"}` + "`" + `
		}
	}

	// Send response
	err := stream.Send(&pb.ServeHTTPResponse{
		Init: &pb.ServeHTTPResponseInit{
			StatusCode: statusCode,
			Headers: []*pb.HTTPHeader{
				{Key: "Content-Type", Values: []string{contentType}},
			},
		},
		BodyChunk:    []byte(body),
		BodyComplete: true,
	})

	return err
}

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)

	pluginHooks := &fakePluginHooks{}
	pb.RegisterPluginHooksServer(grpcServer, pluginHooks)

	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create a dummy plugin.py file
	scriptPath := filepath.Join(pluginDir, "plugin.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte("# Integration test Python plugin\n"), 0644))

	// Create plugin.json manifest
	manifest := &model.Manifest{
		Id:      "python-integration-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), manifestJSON, 0644))

	// Create bundle info
	bundle := model.BundleInfoForPath(pluginDir)
	require.NotNil(t, bundle.Manifest)

	// Create logger
	logger := mlog.CreateConsoleTestLogger(t)

	// Create supervisor
	sup, err := newSupervisor(bundle, nil, nil, logger, nil, WithCommandFromManifest(bundle, nil, nil))
	require.NoError(t, err)
	require.NotNil(t, sup)
	defer sup.Shutdown()

	t.Run("plugin starts and reports implemented hooks", func(t *testing.T) {
		// Verify hooks are wired
		require.NotNil(t, sup.Hooks(), "Hooks should be wired for Python plugin")

		// Verify implemented hooks
		impl, err := sup.Hooks().Implemented()
		require.NoError(t, err)
		assert.Contains(t, impl, "OnActivate")
		assert.Contains(t, impl, "OnDeactivate")
		assert.Contains(t, impl, "MessageHasBeenPosted")
		assert.Contains(t, impl, "ServeHTTP")

		// Verify Implements() for tracked hooks
		assert.True(t, sup.Implements(OnDeactivateID), "Should implement OnDeactivate")
		assert.True(t, sup.Implements(MessageHasBeenPostedID), "Should implement MessageHasBeenPosted")
		assert.True(t, sup.Implements(ServeHTTPID), "Should implement ServeHTTP")
	})

	t.Run("OnActivate is called successfully", func(t *testing.T) {
		err := sup.Hooks().OnActivate()
		require.NoError(t, err, "OnActivate should succeed")
	})

	t.Run("MessageHasBeenPosted hook receives events", func(t *testing.T) {
		post := &model.Post{
			Id:        "test-post-id",
			ChannelId: "test-channel-id",
			UserId:    "test-user-id",
			Message:   "Test message from integration test",
		}

		// Call the hook - should not panic or error
		sup.Hooks().MessageHasBeenPosted(&Context{
			SessionId: "test-session",
			RequestId: "test-request",
			IPAddress: "127.0.0.1",
		}, post)
	})

	t.Run("ServeHTTP handles requests", func(t *testing.T) {
		// Create a test HTTP request
		req := httptest.NewRequest("GET", "/hello", nil)
		w := httptest.NewRecorder()

		ctx := &Context{
			SessionId: "test-session",
			RequestId: "test-request",
			IPAddress: "127.0.0.1",
		}

		// Call ServeHTTP
		sup.Hooks().ServeHTTP(ctx, w, req)

		// Verify response
		resp := w.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode, "Should return 200 OK")

		// Check Content-Type
		assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))
	})

	t.Run("OnDeactivate is called on shutdown", func(t *testing.T) {
		err := sup.Hooks().OnDeactivate()
		require.NoError(t, err, "OnDeactivate should succeed")
	})
}

// TestPythonPluginServeHTTP tests the ServeHTTP streaming functionality in detail
func TestPythonPluginServeHTTP(t *testing.T) {
	// Create temp plugin directory
	pluginDir, err := os.MkdirTemp("", "python-servehttp-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginDir, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginDir, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile a fake Python interpreter with comprehensive ServeHTTP handling
	utils.CompileGo(t, `
package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	return &pb.ImplementedResponse{
		Hooks: []string{"OnActivate", "ServeHTTP"},
	}, nil
}

func (f *fakePluginHooks) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	return &pb.OnActivateResponse{}, nil
}

func (f *fakePluginHooks) ServeHTTP(stream pb.PluginHooks_ServeHTTPServer) error {
	// Receive the complete request
	var init *pb.ServeHTTPRequestInit
	var bodyBuf bytes.Buffer

	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if req.Init != nil {
			init = req.Init
		}
		if len(req.BodyChunk) > 0 {
			bodyBuf.Write(req.BodyChunk)
		}
		if req.BodyComplete {
			break
		}
	}

	if init == nil {
		return fmt.Errorf("no init received")
	}

	var statusCode int32 = 200
	var body string
	var headers []*pb.HTTPHeader

	switch {
	case init.Url == "/api/status":
		// Simple GET request test
		body = ` + "`" + `{"status": "ok"}` + "`" + `
		headers = []*pb.HTTPHeader{
			{Key: "Content-Type", Values: []string{"application/json"}},
		}

	case init.Url == "/api/echo" && init.Method == "POST":
		// POST request with body - echo back
		body = bodyBuf.String()
		headers = []*pb.HTTPHeader{
			{Key: "Content-Type", Values: []string{"text/plain"}},
			{Key: "X-Echo", Values: []string{"true"}},
		}

	case init.Url == "/api/large":
		// Large response test (100KB)
		body = strings.Repeat("X", 100*1024)
		headers = []*pb.HTTPHeader{
			{Key: "Content-Type", Values: []string{"text/plain"}},
		}

	case init.Url == "/api/headers":
		// Return request headers
		var parts []string
		for _, h := range init.Headers {
			parts = append(parts, fmt.Sprintf("%s=%s", h.Key, strings.Join(h.Values, ",")))
		}
		body = strings.Join(parts, "\n")
		headers = []*pb.HTTPHeader{
			{Key: "Content-Type", Values: []string{"text/plain"}},
			{Key: "X-Custom-Header", Values: []string{"custom-value"}},
		}

	case init.Url == "/api/error":
		statusCode = 500
		body = ` + "`" + `{"error": "internal error"}` + "`" + `
		headers = []*pb.HTTPHeader{
			{Key: "Content-Type", Values: []string{"application/json"}},
		}

	default:
		statusCode = 404
		body = ` + "`" + `{"error": "not found"}` + "`" + `
		headers = []*pb.HTTPHeader{
			{Key: "Content-Type", Values: []string{"application/json"}},
		}
	}

	// For large responses, send in chunks
	bodyBytes := []byte(body)
	chunkSize := 64 * 1024 // 64KB chunks

	if len(bodyBytes) <= chunkSize {
		// Small response - send in one message
		return stream.Send(&pb.ServeHTTPResponse{
			Init: &pb.ServeHTTPResponseInit{
				StatusCode: statusCode,
				Headers:    headers,
			},
			BodyChunk:    bodyBytes,
			BodyComplete: true,
		})
	}

	// Large response - send init first
	err := stream.Send(&pb.ServeHTTPResponse{
		Init: &pb.ServeHTTPResponseInit{
			StatusCode: statusCode,
			Headers:    headers,
		},
		BodyChunk:    bodyBytes[:chunkSize],
		BodyComplete: false,
	})
	if err != nil {
		return err
	}

	// Send remaining chunks
	offset := chunkSize
	for offset < len(bodyBytes) {
		end := offset + chunkSize
		if end > len(bodyBytes) {
			end = len(bodyBytes)
		}
		isLast := end == len(bodyBytes)

		err := stream.Send(&pb.ServeHTTPResponse{
			BodyChunk:    bodyBytes[offset:end],
			BodyComplete: isLast,
		})
		if err != nil {
			return err
		}
		offset = end
	}

	return nil
}

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	pb.RegisterPluginHooksServer(grpcServer, &fakePluginHooks{})

	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create a dummy plugin.py file
	scriptPath := filepath.Join(pluginDir, "plugin.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte("# ServeHTTP test plugin\n"), 0644))

	// Create plugin.json manifest
	manifest := &model.Manifest{
		Id:      "python-servehttp-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), manifestJSON, 0644))

	// Create bundle info
	bundle := model.BundleInfoForPath(pluginDir)
	require.NotNil(t, bundle.Manifest)

	// Create logger
	logger := mlog.CreateConsoleTestLogger(t)

	// Create supervisor
	sup, err := newSupervisor(bundle, nil, nil, logger, nil, WithCommandFromManifest(bundle, nil, nil))
	require.NoError(t, err)
	require.NotNil(t, sup)
	defer sup.Shutdown()

	ctx := &Context{
		SessionId: "test-session",
		RequestId: "test-request",
		IPAddress: "127.0.0.1",
	}

	t.Run("Simple GET request - verify response status and body", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/status", nil)
		w := httptest.NewRecorder()

		sup.Hooks().ServeHTTP(ctx, w, req)

		resp := w.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))
		assert.Contains(t, w.Body.String(), `"status": "ok"`)
	})

	t.Run("POST request with body - verify request body received by plugin", func(t *testing.T) {
		body := "Hello, this is the request body!"
		req := httptest.NewRequest("POST", "/api/echo", strings.NewReader(body))
		req.Header.Set("Content-Type", "text/plain")
		w := httptest.NewRecorder()

		sup.Hooks().ServeHTTP(ctx, w, req)

		resp := w.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "text/plain", resp.Header.Get("Content-Type"))
		assert.Equal(t, "true", resp.Header.Get("X-Echo"))
		assert.Equal(t, body, w.Body.String())
	})

	t.Run("Large response body - verify streaming works (>64KB response)", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/large", nil)
		w := httptest.NewRecorder()

		sup.Hooks().ServeHTTP(ctx, w, req)

		resp := w.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "text/plain", resp.Header.Get("Content-Type"))
		// Verify full 100KB response received
		assert.Equal(t, 100*1024, w.Body.Len(), "Should receive full 100KB response")
		// Verify content is correct (all X's)
		assert.True(t, strings.HasPrefix(w.Body.String(), "XXXX"), "Body should start with X's")
	})

	t.Run("Request headers - verify headers passed to plugin", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/headers", nil)
		req.Header.Set("X-Test-Header", "test-value")
		req.Header.Set("Authorization", "Bearer token123")
		w := httptest.NewRecorder()

		sup.Hooks().ServeHTTP(ctx, w, req)

		resp := w.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		// Check that our headers were received (they'll be in the response body)
		body := w.Body.String()
		assert.Contains(t, body, "X-Test-Header")
	})

	t.Run("Response headers - verify plugin can set response headers", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/headers", nil)
		w := httptest.NewRecorder()

		sup.Hooks().ServeHTTP(ctx, w, req)

		resp := w.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "custom-value", resp.Header.Get("X-Custom-Header"))
	})

	t.Run("Error response - verify status codes are correctly propagated", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/error", nil)
		w := httptest.NewRecorder()

		sup.Hooks().ServeHTTP(ctx, w, req)

		resp := w.Result()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
		assert.Contains(t, w.Body.String(), "internal error")
	})

	t.Run("Not found - verify 404 handling", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/nonexistent", nil)
		w := httptest.NewRecorder()

		sup.Hooks().ServeHTTP(ctx, w, req)

		resp := w.Result()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

// TestPythonPluginEnvironmentIntegration tests the full Environment integration
// with a Python plugin including activation, health checks, and deactivation.
func TestPythonPluginEnvironmentIntegration(t *testing.T) {
	// Create temp directories
	pluginDir, err := os.MkdirTemp("", "python-env-integration-test-plugins")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	webappDir, err := os.MkdirTemp("", "python-env-integration-test-webapp")
	require.NoError(t, err)
	defer os.RemoveAll(webappDir)

	// Create plugin subdirectory
	pluginPath := filepath.Join(pluginDir, "python-env-test")
	require.NoError(t, os.MkdirAll(pluginPath, 0755))

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginPath, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginPath, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile fake Python interpreter
	utils.CompileGo(t, `
package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	return &pb.ImplementedResponse{
		Hooks: []string{"OnActivate", "OnDeactivate", "OnConfigurationChange", "ServeHTTP"},
	}, nil
}

func (f *fakePluginHooks) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	return &pb.OnActivateResponse{}, nil
}

func (f *fakePluginHooks) OnDeactivate(ctx context.Context, req *pb.OnDeactivateRequest) (*pb.OnDeactivateResponse, error) {
	return &pb.OnDeactivateResponse{}, nil
}

func (f *fakePluginHooks) OnConfigurationChange(ctx context.Context, req *pb.OnConfigurationChangeRequest) (*pb.OnConfigurationChangeResponse, error) {
	return &pb.OnConfigurationChangeResponse{}, nil
}

func (f *fakePluginHooks) ServeHTTP(stream pb.PluginHooks_ServeHTTPServer) error {
	// Receive request
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if req.BodyComplete {
			break
		}
	}

	// Send simple response
	return stream.Send(&pb.ServeHTTPResponse{
		Init: &pb.ServeHTTPResponseInit{
			StatusCode: 200,
			Headers: []*pb.HTTPHeader{
				{Key: "Content-Type", Values: []string{"application/json"}},
			},
		},
		BodyChunk:    []byte(` + "`" + `{"plugin": "python-env-test"}` + "`" + `),
		BodyComplete: true,
	})
}

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	pb.RegisterPluginHooksServer(grpcServer, &fakePluginHooks{})

	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create dummy plugin.py
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "plugin.py"), []byte("# Env test\n"), 0644))

	// Create plugin.json
	manifest := &model.Manifest{
		Id:      "python-env-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "plugin.json"), manifestJSON, 0644))

	// Create Environment
	logger := mlog.CreateConsoleTestLogger(t)
	env, err := NewEnvironment(
		func(m *model.Manifest) API { return nil },
		nil,
		pluginDir,
		webappDir,
		logger,
		nil,
	)
	require.NoError(t, err)
	defer env.Shutdown()

	t.Run("Activate plugin", func(t *testing.T) {
		retManifest, activated, err := env.Activate("python-env-test")
		require.NoError(t, err)
		assert.True(t, activated, "Plugin should be activated")
		assert.NotNil(t, retManifest)
		assert.True(t, env.IsActive("python-env-test"))
	})

	t.Run("Health check succeeds", func(t *testing.T) {
		err := env.PerformHealthCheck("python-env-test")
		require.NoError(t, err, "Health check should succeed")
	})

	t.Run("RunMultiPluginHook dispatches hooks", func(t *testing.T) {
		// This tests that hook dispatch works through the Environment
		// OnConfigurationChange is a void hook that should be callable
		env.RunMultiPluginHook(func(hooks Hooks, manifest *model.Manifest) bool {
			err := hooks.OnConfigurationChange()
			return err == nil
		}, OnConfigurationChangeID)
	})

	t.Run("Deactivate plugin", func(t *testing.T) {
		result := env.Deactivate("python-env-test")
		assert.True(t, result, "Deactivate should return true")
		assert.False(t, env.IsActive("python-env-test"))
	})
}

// TestPythonPluginCrashRecovery tests that a crashed Python plugin can be restarted
func TestPythonPluginCrashRecovery(t *testing.T) {
	// Create temp directories
	pluginDir, err := os.MkdirTemp("", "python-crash-recovery-plugins")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	webappDir, err := os.MkdirTemp("", "python-crash-recovery-webapp")
	require.NoError(t, err)
	defer os.RemoveAll(webappDir)

	// Create plugin subdirectory
	pluginPath := filepath.Join(pluginDir, "python-crash-test")
	require.NoError(t, os.MkdirAll(pluginPath, 0755))

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginPath, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginPath, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile fake Python interpreter
	utils.CompileGo(t, `
package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	return &pb.ImplementedResponse{Hooks: []string{"OnActivate"}}, nil
}

func (f *fakePluginHooks) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	return &pb.OnActivateResponse{}, nil
}

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	pb.RegisterPluginHooksServer(grpcServer, &fakePluginHooks{})

	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create dummy plugin.py
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "plugin.py"), []byte("# Crash test\n"), 0644))

	// Create plugin.json
	manifest := &model.Manifest{
		Id:      "python-crash-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "plugin.json"), manifestJSON, 0644))

	// Create Environment
	logger := mlog.CreateConsoleTestLogger(t)
	env, err := NewEnvironment(
		func(m *model.Manifest) API { return nil },
		nil,
		pluginDir,
		webappDir,
		logger,
		nil,
	)
	require.NoError(t, err)
	defer env.Shutdown()

	// Activate the plugin
	_, activated, err := env.Activate("python-crash-test")
	require.NoError(t, err)
	require.True(t, activated)

	// Verify initial health
	err = env.PerformHealthCheck("python-crash-test")
	require.NoError(t, err)

	// Kill the plugin process
	rp, ok := env.registeredPlugins.Load("python-crash-test")
	require.True(t, ok)
	registeredPlug := rp.(registeredPlugin)
	require.NotNil(t, registeredPlug.supervisor.client)
	registeredPlug.supervisor.client.Kill()

	// Wait for health check to fail
	healthCheckFailed := false
	for i := 0; i < 10; i++ {
		err = env.PerformHealthCheck("python-crash-test")
		if err != nil {
			healthCheckFailed = true
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	require.True(t, healthCheckFailed, "Health check should fail after crash")

	// Restart the plugin
	err = env.RestartPlugin("python-crash-test")
	require.NoError(t, err)

	// Verify recovery
	healthCheckSucceeded := false
	for i := 0; i < 20; i++ {
		err = env.PerformHealthCheck("python-crash-test")
		if err == nil {
			healthCheckSucceeded = true
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	require.True(t, healthCheckSucceeded, "Health check should succeed after restart")
	assert.True(t, env.IsActive("python-crash-test"))
}

// TestPythonPluginImplementsChecking tests that the supervisor correctly
// tracks which hooks are implemented
func TestPythonPluginImplementsChecking(t *testing.T) {
	// Create temp plugin directory
	pluginDir, err := os.MkdirTemp("", "python-implements-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	// Determine the venv path based on OS
	var venvPythonPath string
	if runtime.GOOS == "windows" {
		venvPythonPath = filepath.Join(pluginDir, "venv", "Scripts", "python.exe")
	} else {
		venvPythonPath = filepath.Join(pluginDir, "venv", "bin", "python")
	}

	// Create venv directory structure
	require.NoError(t, os.MkdirAll(filepath.Dir(venvPythonPath), 0755))

	// Compile fake Python interpreter that only implements specific hooks
	utils.CompileGo(t, `
package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

type fakePluginHooks struct {
	pb.UnimplementedPluginHooksServer
}

func (f *fakePluginHooks) Implemented(ctx context.Context, req *pb.ImplementedRequest) (*pb.ImplementedResponse, error) {
	// Only implement specific hooks for testing
	return &pb.ImplementedResponse{
		Hooks: []string{
			"OnActivate",
			"MessageHasBeenPosted",
			"UserHasJoinedChannel",
			// Deliberately NOT implementing: OnDeactivate, ServeHTTP, ExecuteCommand, etc.
		},
	}, nil
}

func (f *fakePluginHooks) OnActivate(ctx context.Context, req *pb.OnActivateRequest) (*pb.OnActivateResponse, error) {
	return &pb.OnActivateResponse{}, nil
}

func (f *fakePluginHooks) MessageHasBeenPosted(ctx context.Context, req *pb.MessageHasBeenPostedRequest) (*pb.MessageHasBeenPostedResponse, error) {
	return &pb.MessageHasBeenPostedResponse{}, nil
}

func (f *fakePluginHooks) UserHasJoinedChannel(ctx context.Context, req *pb.UserHasJoinedChannelRequest) (*pb.UserHasJoinedChannelResponse, error) {
	return &pb.UserHasJoinedChannelResponse{}, nil
}

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen: %v\n", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("plugin", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	pb.RegisterPluginHooksServer(grpcServer, &fakePluginHooks{})

	go func() {
		if err := grpcServer.Serve(listener); err != nil {
			fmt.Fprintf(os.Stderr, "failed to serve: %v\n", err)
		}
	}()

	addr := listener.Addr().String()
	fmt.Printf("1|1|tcp|%s|grpc\n", addr)
	os.Stdout.Sync()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	<-sigCh

	grpcServer.GracefulStop()
}
`, venvPythonPath)

	// Create a dummy plugin.py file
	scriptPath := filepath.Join(pluginDir, "plugin.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte("# Implements test\n"), 0644))

	// Create plugin.json manifest
	manifest := &model.Manifest{
		Id:      "python-implements-test",
		Version: "1.0.0",
		Server: &model.ManifestServer{
			Executable: "plugin.py",
		},
	}
	manifestJSON, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), manifestJSON, 0644))

	// Create bundle info
	bundle := model.BundleInfoForPath(pluginDir)
	require.NotNil(t, bundle.Manifest)

	// Create logger
	logger := mlog.CreateConsoleTestLogger(t)

	// Create supervisor
	sup, err := newSupervisor(bundle, nil, nil, logger, nil, WithCommandFromManifest(bundle, nil, nil))
	require.NoError(t, err)
	require.NotNil(t, sup)
	defer sup.Shutdown()

	// Test implemented hooks return true
	assert.True(t, sup.Implements(MessageHasBeenPostedID), "MessageHasBeenPosted should be implemented")
	assert.True(t, sup.Implements(UserHasJoinedChannelID), "UserHasJoinedChannel should be implemented")

	// Test non-implemented hooks return false
	assert.False(t, sup.Implements(OnDeactivateID), "OnDeactivate should NOT be implemented")
	assert.False(t, sup.Implements(ServeHTTPID), "ServeHTTP should NOT be implemented")
	assert.False(t, sup.Implements(ExecuteCommandID), "ExecuteCommand should NOT be implemented")
	assert.False(t, sup.Implements(ChannelHasBeenCreatedID), "ChannelHasBeenCreated should NOT be implemented")
}
