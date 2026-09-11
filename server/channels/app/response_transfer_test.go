// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"io"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

const responseTransferTestTimeout = 10 * time.Second

func TestPluginResponseWriterConcurrentReady(t *testing.T) {
	_, writer := io.Pipe()
	responseWriter := NewPluginResponseWriter(writer)

	var wg sync.WaitGroup
	for range 100 {
		wg.Go(func() {
			responseWriter.markResponseReady()
		})
	}
	wg.Wait()

	ready := false
	select {
	case <-responseWriter.ResponseReady:
		ready = true
	default:
	}
	require.True(t, ready, "response was not marked ready")
	require.NoError(t, responseWriter.Close())
}

func TestPluginResponseBodyCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	requestCtx, cancelRequest := context.WithCancel(ctx)
	reader, writer := io.Pipe()
	responseWriter := NewPluginResponseWriter(writer)
	response := responseWriter.GenerateResponse(requestCtx, reader, cancelRequest)

	readDone := make(chan error, 1)
	go func() {
		_, err := response.Body.Read(make([]byte, 1))
		readDone <- err
	}()
	cancel()

	select {
	case readErr := <-readDone:
		require.ErrorIs(t, readErr, context.Canceled)
	case <-time.After(responseTransferTestTimeout):
		require.FailNow(t, "response body read did not stop after cancellation")
	}
	require.NoError(t, response.Body.Close())
	require.NoError(t, response.Body.Close())
}

func TestPluginResponseBodyCancellationClosesPipeBeforeRead(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	reader, writer := io.Pipe()
	responseWriter := NewPluginResponseWriter(writer)
	response := responseWriter.GenerateResponse(ctx, reader, cancel)
	t.Cleanup(func() { _ = response.Body.Close() })

	writeDone := make(chan error, 1)
	go func() {
		_, err := responseWriter.Write([]byte("late"))
		writeDone <- err
	}()
	select {
	case <-responseWriter.ResponseReady:
	case <-time.After(responseTransferTestTimeout):
		require.FailNow(t, "writer did not start")
	}
	cancel()
	select {
	case writeErr := <-writeDone:
		require.Error(t, writeErr)
	case <-time.After(responseTransferTestTimeout):
		require.FailNow(t, "writer did not stop after cancellation")
	}

	buffer := make([]byte, len("late"))
	n, err := response.Body.Read(buffer)
	require.Zero(t, n)
	require.ErrorIs(t, err, context.Canceled)
}

type pluginHTTPTrackingBody struct {
	closed bool
}

func (b *pluginHTTPTrackingBody) Read(p []byte) (int, error) {
	return 0, io.EOF
}

func (b *pluginHTTPTrackingBody) Close() error {
	b.closed = true
	return nil
}

func TestPluginHTTPAlreadyCanceled(t *testing.T) {
	t.Run("nil body", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, "/plugin/path", nil)
		require.NoError(t, err)

		require.Nil(t, (&PluginAPI{}).PluginHTTP(request))
	})

	t.Run("closes body", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		body := &pluginHTTPTrackingBody{}
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, "/plugin/path", body)
		require.NoError(t, err)

		require.Nil(t, (&PluginAPI{}).PluginHTTP(request))
		require.True(t, body.closed)
	})
}
