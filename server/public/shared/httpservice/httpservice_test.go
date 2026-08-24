// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package httpservice

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type testConfigService struct {
	config *model.Config
}

func (s *testConfigService) Config() *model.Config {
	return s.config
}

func newTestHTTPService() HTTPService {
	config := &model.Config{}
	config.SetDefaults()

	return MakeHTTPService(&testConfigService{config: config})
}

func TestMakeClientTimeout(t *testing.T) {
	service := newTestHTTPService()

	for _, trustURLs := range []bool{true, false} {
		require.Equal(t, RequestTimeout, service.MakeClient(trustURLs).Timeout)
		require.Equal(t, 5*time.Second, service.MakeClientWithTimeout(trustURLs, 5*time.Second).Timeout)
		require.Zero(t, service.MakeClientWithTimeout(trustURLs, 0).Timeout)
	}
}

// A client timeout shorter than the request context deadline cuts the request short, no matter how
// much time the context still allows. Callers whose deadline comes from configuration (such as
// ServiceSettings.OutgoingIntegrationRequestsTimeout) therefore need a client built without one.
func TestMakeClientWithTimeoutRequestDeadline(t *testing.T) {
	const handlerDelay = 500 * time.Millisecond

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(handlerDelay):
			w.WriteHeader(http.StatusOK)
		case <-r.Context().Done():
		}
	}))
	defer ts.Close()

	service := newTestHTTPService()

	get := func(t *testing.T, client *http.Client, contextTimeout time.Duration) (*http.Response, error) {
		t.Helper()

		ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
		defer cancel()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL, nil)
		require.NoError(t, err)

		return client.Do(req)
	}

	t.Run("a client timeout shorter than the context deadline cuts the request short", func(t *testing.T) {
		client := service.MakeClientWithTimeout(true, handlerDelay/5)

		start := time.Now()
		_, err := get(t, client, 10*handlerDelay)
		require.Error(t, err)

		var netErr net.Error
		require.ErrorAs(t, err, &netErr)
		require.True(t, netErr.Timeout())
		require.Less(t, time.Since(start), handlerDelay, "the client timeout ended the request before the handler responded")
	})

	t.Run("without a client timeout the context deadline governs", func(t *testing.T) {
		client := service.MakeClientWithTimeout(true, 0)

		resp, err := get(t, client, 10*handlerDelay)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("without a client timeout a shorter context deadline still applies", func(t *testing.T) {
		client := service.MakeClientWithTimeout(true, 0)

		_, err := get(t, client, handlerDelay/5)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})
}
