// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package httpservice

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type testConfigService struct {
	config *model.Config
}

func (s *testConfigService) Config() *model.Config {
	return s.config
}

// newTestHTTPService returns a service with the given default request timeout that is allowed to
// dial the loopback addresses used by httptest.
func newTestHTTPService(requestTimeout time.Duration) *HTTPServiceImpl {
	config := &model.Config{}
	config.SetDefaults()
	config.ServiceSettings.AllowedUntrustedInternalConnections = new("127.0.0.1")

	return &HTTPServiceImpl{
		configService:  &testConfigService{config: config},
		RequestTimeout: requestTimeout,
	}
}

func newSlowServer(t *testing.T, delay time.Duration) *httptest.Server {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(delay):
			w.WriteHeader(http.StatusOK)
		case <-r.Context().Done():
		}
	}))
	t.Cleanup(server.Close)

	return server
}

func doGet(t *testing.T, client *http.Client, rawURL string, contextTimeout time.Duration) (*http.Response, error) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	require.NoError(t, err)

	return client.Do(req)
}

func TestMakeClientTimeout(t *testing.T) {
	config := &model.Config{}
	config.SetDefaults()
	assert.Equal(t, RequestTimeout, MakeHTTPService(&testConfigService{config: config}).MakeClient(false).Timeout,
		"the production constructor applies the package default")

	service := newTestHTTPService(RequestTimeout)

	assert.Equal(t, RequestTimeout, service.MakeClient(false).Timeout)
	assert.Equal(t, 5*time.Second, service.MakeClientWithTimeout(false, 5*time.Second).Timeout)
	assert.Zero(t, service.MakeClientWithTimeout(false, 0).Timeout)

	// Whatever the timeout, requests still go through the transport applying the Mattermost user
	// agent and the AllowedUntrustedInternalConnections checks.
	for _, trustURLs := range []bool{true, false} {
		assert.IsType(t, &MattermostTransport{}, service.MakeClientWithTimeout(trustURLs, 0).Transport)
	}
}

// MM-68319 in miniature: a caller whose deadline is longer than the default request timeout only
// reaches a slow endpoint if its client was built without a timeout of its own.
func TestMakeClientWithTimeoutOutlivesDefaultTimeout(t *testing.T) {
	const defaultTimeout = 100 * time.Millisecond
	const handlerDelay = 5 * defaultTimeout

	server := newSlowServer(t, handlerDelay)
	service := newTestHTTPService(defaultTimeout)

	t.Run("the default request timeout caps a longer context deadline", func(t *testing.T) {
		_, err := doGet(t, service.MakeClient(false), server.URL, 100*defaultTimeout)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})

	t.Run("a client built without a timeout runs to the context deadline", func(t *testing.T) {
		resp, err := doGet(t, service.MakeClientWithTimeout(false, 0), server.URL, 100*defaultTimeout)
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("a client built without a timeout still honours a shorter context deadline", func(t *testing.T) {
		_, err := doGet(t, service.MakeClientWithTimeout(false, 0), server.URL, defaultTimeout)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})
}
