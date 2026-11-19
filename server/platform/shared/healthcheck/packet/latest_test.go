// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package packet

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestFillLatestVersion(t *testing.T) {
	serve := func(t *testing.T, handler http.HandlerFunc) (string, *atomic.Int32) {
		var requests atomic.Int32
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requests.Add(1)
			handler(w, r)
		}))
		t.Cleanup(server.Close)
		return server.URL, &requests
	}
	release := func(tag string) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) {
			_, _ = fmt.Fprintf(w, `{"id": 1, "tag_name": %q}`, tag)
		}
	}

	t.Run("fills the latest release without its tag prefix", func(t *testing.T) {
		url, _ := serve(t, release("v12.4.0"))
		snapshot := &healthcheck.Snapshot{}

		require.NoError(t, FillLatestVersion(context.Background(), snapshot, url))
		assert.Equal(t, "12.4.0", snapshot.Version.Latest)
	})

	t.Run("a failed fetch returns its error and leaves it empty", func(t *testing.T) {
		url, _ := serve(t, func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusBadGateway) })
		snapshot := &healthcheck.Snapshot{}

		assert.EqualError(t, FillLatestVersion(context.Background(), snapshot, url), "unexpected status code 502")
		assert.Empty(t, snapshot.Version.Latest)
	})

	t.Run("a canceled context stops the fetch", func(t *testing.T) {
		url, requests := serve(t, release("v12.4.0"))
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		snapshot := &healthcheck.Snapshot{}

		assert.ErrorIs(t, FillLatestVersion(ctx, snapshot, url), context.Canceled)
		assert.Empty(t, snapshot.Version.Latest)
		assert.Zero(t, requests.Load())
	})

	t.Run("a latest release the snapshot already records is not fetched", func(t *testing.T) {
		url, requests := serve(t, release("v99.0.0"))
		snapshot := &healthcheck.Snapshot{}
		snapshot.Version.Latest = "12.1.0"

		assert.NoError(t, FillLatestVersion(context.Background(), snapshot, url))
		assert.Equal(t, "12.1.0", snapshot.Version.Latest)
		assert.Zero(t, requests.Load())
	})
}
