// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/rpc"
	"strings"
	"sync"
	"testing"
	"testing/iotest"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/require"
)

const rpcTestTimeout = 10 * time.Second

type blockingReadCloser struct {
	closed chan struct{}
}

func (r *blockingReadCloser) Read(p []byte) (int, error) {
	<-r.closed
	return 0, io.ErrClosedPipe
}

func (r *blockingReadCloser) Close() error {
	select {
	case <-r.closed:
	default:
		close(r.closed)
	}
	return nil
}

func TestRPCRequestContextDeadline(t *testing.T) {
	deadline := time.Now().Add(time.Minute).Round(0)
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	defer cancel()

	remoteCtx, remoteCancel := newRPCRequestContext(ctx).Context()
	defer remoteCancel()
	remoteDeadline, ok := remoteCtx.Deadline()
	require.True(t, ok)
	require.Equal(t, deadline, remoteDeadline)
}

func TestWatchRPCContextTransportErrorCancels(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	watchRPCContext(ctx, io.NopCloser(iotest.ErrReader(errors.New("transport error"))), cancel)
	select {
	case <-ctx.Done():
		require.ErrorIs(t, ctx.Err(), context.Canceled)
	case <-time.After(rpcTestTimeout):
		require.FailNow(t, "transport error did not cancel context")
	}
}

func TestContextReadCloserCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	reader := &blockingReadCloser{closed: make(chan struct{})}
	body := newContextReadCloser(ctx, reader, nil)

	readDone := make(chan error, 1)
	go func() {
		_, err := body.Read(make([]byte, 1))
		readDone <- err
	}()
	cancel()

	select {
	case err := <-readDone:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(rpcTestTimeout):
		require.FailNow(t, "read did not stop after cancellation")
	}
	require.NoError(t, body.Close())
	require.NoError(t, body.Close())
}

func TestContextReadCloserCancellationRunsCleanupWithoutReadOrClose(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	reader := &blockingReadCloser{closed: make(chan struct{})}
	cleanupDone := make(chan struct{})
	body := newContextReadCloser(ctx, reader, func() {
		close(cleanupDone)
	})

	cancel()
	select {
	case <-cleanupDone:
	case <-time.After(rpcTestTimeout):
		require.FailNow(t, "cleanup did not run after cancellation")
	}
	select {
	case <-reader.closed:
	default:
		require.FailNow(t, "reader was not closed after cancellation")
	}
	require.NoError(t, body.Close())
}

func TestRPCStreamCloserCloseBeforeSet(t *testing.T) {
	stream := &rpcStreamCloser{}
	require.NoError(t, stream.Close())

	closer := &recordingWriteCloser{}
	require.False(t, stream.Set(closer))
	require.True(t, closer.closed)
	require.NoError(t, stream.Close())
}

type recordingWriteCloser struct {
	bytes.Buffer
	closed bool
}

func (c *recordingWriteCloser) Close() error {
	c.closed = true
	return nil
}

func TestRPCStreamCloserCancelBeforeSet(t *testing.T) {
	testCases := []struct {
		name   string
		err    error
		reason closeReason
	}{
		{name: "canceled", err: context.Canceled, reason: rpcStreamCanceled},
		{name: "deadline exceeded", err: context.DeadlineExceeded, reason: rpcStreamDeadlineExceeded},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			stream := &rpcStreamCloser{}
			require.NoError(t, stream.Cancel(testCase.err))

			closer := &recordingWriteCloser{}
			require.False(t, stream.Set(closer))
			require.Equal(t, []byte{byte(testCase.reason)}, closer.Bytes())
			require.True(t, closer.closed)
			require.NoError(t, stream.Close())
		})
	}
}

func TestPluginHTTPAlreadyCanceledClosesRequestBody(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	body := &recordingWriteCloser{}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "/plugin/path", body)
	require.NoError(t, err)

	response := (&apiRPCClient{}).PluginHTTP(request)
	require.Nil(t, response)
	require.True(t, body.closed)
}

func TestHooksRPCClientServeHTTPAlreadyCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	body := &recordingWriteCloser{}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "/plugin/path", body)
	require.NoError(t, err)

	muxBroker := newTestHooksRPCMuxBroker()
	hooks := &hooksRPCClient{contextHTTP: true, muxBroker: muxBroker}
	hooks.implemented[ServeHTTPID] = true
	hooks.ServeHTTP(&Context{}, httptest.NewRecorder(), request)

	require.True(t, body.closed)
	require.Zero(t, muxBroker.nextID, "canceled request allocated a mux stream")
}

type legacyRPCServer struct {
	muxBroker        *testHooksRPCMuxBroker
	serveHTTPStarted chan struct{}
	serveHTTPRelease chan struct{}
}

type testHooksRPCMuxBroker struct {
	nextID       uint32
	mutex        sync.Mutex
	streams      map[uint32]chan net.Conn
	acceptErrors map[uint32]error
}

func newTestHooksRPCMuxBroker() *testHooksRPCMuxBroker {
	return &testHooksRPCMuxBroker{streams: make(map[uint32]chan net.Conn)}
}

func (b *testHooksRPCMuxBroker) NextId() uint32 {
	b.nextID++
	return b.nextID
}

func (b *testHooksRPCMuxBroker) Accept(id uint32) (net.Conn, error) {
	if err := b.acceptErrors[id]; err != nil {
		return nil, err
	}
	hostConnection, pluginConnection := net.Pipe()
	b.stream(id) <- pluginConnection
	return hostConnection, nil
}

func (b *testHooksRPCMuxBroker) AcceptAndServe(id uint32, server any) {
}

func (b *testHooksRPCMuxBroker) Dial(id uint32) (net.Conn, error) {
	select {
	case connection := <-b.stream(id):
		return connection, nil
	case <-time.After(rpcTestTimeout):
		return nil, errors.New("timeout waiting for stream")
	}
}

func (b *testHooksRPCMuxBroker) stream(id uint32) chan net.Conn {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	stream, ok := b.streams[id]
	if !ok {
		stream = make(chan net.Conn, 1)
		b.streams[id] = stream
	}
	return stream
}

type LegacyOnActivateArgs struct {
	APIMuxId    uint32
	DriverMuxId uint32
}

type LegacyOnActivateReturns struct {
	A error
}

type LegacyServeHTTPArgs struct {
	ResponseWriterStream uint32
	Request              *HTTPRequestSubset
	Context              *Context
	RequestBodyStream    uint32
}

func (s *legacyRPCServer) OnActivate(args *LegacyOnActivateArgs, returns *LegacyOnActivateReturns) error {
	return nil
}

func (s *legacyRPCServer) Ping(args struct{}, reply *bool) error {
	*reply = true
	return nil
}

func (s *legacyRPCServer) PluginHTTP(args *Z_PluginHTTPArgs, returns *Z_PluginHTTPReturns) error {
	returns.Response = &http.Response{StatusCode: http.StatusOK}
	returns.ResponseBody = []byte("legacy")
	return nil
}

type successfulPluginHTTPStreamRPCServer struct{}

func (s *successfulPluginHTTPStreamRPCServer) PluginHTTPStream(args *Z_PluginHTTPStreamArgs, returns *Z_PluginHTTPStreamReturns) error {
	returns.StatusCode = http.StatusOK
	return nil
}

func TestPluginHTTPStreamResponseSetupFailureClosesRequestBody(t *testing.T) {
	muxBroker := newTestHooksRPCMuxBroker()
	muxBroker.acceptErrors = map[uint32]error{1: errors.New("response stream failed")}

	serverConnection, clientConnection := net.Pipe()
	server := rpc.NewServer()
	require.NoError(t, server.RegisterName("Plugin", &successfulPluginHTTPStreamRPCServer{}))
	go server.ServeConn(serverConnection)

	client := rpc.NewClient(clientConnection)
	defer client.Close()
	body := &blockingReadCloser{closed: make(chan struct{})}
	request, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "/plugin/path", body)
	require.NoError(t, err)

	response, err := (&apiRPCClient{client: client, muxBroker: muxBroker}).pluginHTTPStream(request, false)
	require.Nil(t, response)
	require.ErrorContains(t, err, "response stream failed")
	select {
	case <-body.closed:
	default:
		require.FailNow(t, "request body was not closed after response stream setup failed")
	}

	requestConnection, err := muxBroker.Dial(2)
	require.NoError(t, err)
	require.NoError(t, requestConnection.Close())
}

func (s *legacyRPCServer) ServeHTTP(args *LegacyServeHTTPArgs, returns *struct{}) error {
	requestConnection, err := s.muxBroker.Dial(args.RequestBodyStream)
	if err != nil {
		return err
	}
	requestBody := connectIOReader(requestConnection)
	body := make([]byte, len("request"))
	_, err = io.ReadFull(requestBody, body)
	_ = requestBody.Close()
	if err != nil {
		return err
	}
	close(s.serveHTTPStarted)
	<-s.serveHTTPRelease

	responseConnection, err := s.muxBroker.Dial(args.ResponseWriterStream)
	if err != nil {
		return err
	}
	responseWriter := connectHTTPResponseWriter(responseConnection)
	defer responseWriter.Close()
	responseWriter.Header().Set("X-Legacy-Plugin", "true")
	responseWriter.WriteHeader(http.StatusCreated)
	_, err = responseWriter.Write(append([]byte("legacy:"), body...))
	return err
}

func TestLegacyPluginHTTPFallbackLeavesConnectionUsable(t *testing.T) {
	muxBroker := newTestHooksRPCMuxBroker()
	serverConnection, clientConnection := net.Pipe()
	server := rpc.NewServer()
	require.NoError(t, server.RegisterName("Plugin", &legacyRPCServer{}))
	go server.ServeConn(serverConnection)

	client := rpc.NewClient(clientConnection)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "/legacy", nil)
	require.NoError(t, err)
	response := (&apiRPCClient{client: client, muxBroker: muxBroker}).PluginHTTP(request)
	require.NotNil(t, response)
	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
	require.Equal(t, http.StatusOK, response.StatusCode)
	require.Equal(t, "legacy", string(body))

	var pong bool
	require.NoError(t, client.Call("Plugin.Ping", struct{}{}, &pong))
	require.True(t, pong)
}

func TestLegacyHooksRPCClientServeHTTP(t *testing.T) {
	muxBroker := newTestHooksRPCMuxBroker()
	serveHTTPStarted := make(chan struct{})
	serveHTTPRelease := make(chan struct{})
	serverConnection, clientConnection := net.Pipe()
	server := rpc.NewServer()
	require.NoError(t, server.RegisterName("Plugin", &legacyRPCServer{
		muxBroker:        muxBroker,
		serveHTTPStarted: serveHTTPStarted,
		serveHTTPRelease: serveHTTPRelease,
	}))
	go server.ServeConn(serverConnection)

	client := rpc.NewClient(clientConnection)
	defer client.Close()
	hooks := &hooksRPCClient{client: client, log: mlog.CreateConsoleTestLogger(t), muxBroker: muxBroker}
	hooks.implemented[ServeHTTPID] = true
	require.NoError(t, hooks.OnActivate())
	require.False(t, hooks.contextHTTP)

	ctx, cancel := context.WithCancel(context.Background())
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "/legacy", strings.NewReader("request"))
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	serveHTTPDone := make(chan struct{})
	go func() {
		hooks.ServeHTTP(&Context{RequestId: "legacy"}, recorder, request)
		close(serveHTTPDone)
	}()

	select {
	case <-serveHTTPStarted:
	case <-time.After(rpcTestTimeout):
		require.FailNow(t, "legacy ServeHTTP did not start")
	}
	cancel()
	require.Never(t, func() bool {
		select {
		case <-serveHTTPDone:
			return true
		default:
			return false
		}
	}, 100*time.Millisecond, 10*time.Millisecond, "legacy ServeHTTP unexpectedly stopped on context cancellation")

	var pong bool
	require.NoError(t, client.Call("Plugin.Ping", struct{}{}, &pong))
	require.True(t, pong)
	close(serveHTTPRelease)
	select {
	case <-serveHTTPDone:
	case <-time.After(rpcTestTimeout):
		require.FailNow(t, "legacy ServeHTTP did not finish after release")
	}

	require.Equal(t, http.StatusCreated, recorder.Code)
	require.Equal(t, "true", recorder.Header().Get("X-Legacy-Plugin"))
	require.Equal(t, "legacy:request", recorder.Body.String())
}
