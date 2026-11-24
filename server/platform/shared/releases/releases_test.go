// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package releases

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestFetchLatest(t *testing.T) {
	serve := func(t *testing.T, status int, body string) string {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(status)
			_, _ = w.Write([]byte(body))
		}))
		t.Cleanup(server.Close)
		return server.URL
	}

	t.Run("returns a valid release", func(t *testing.T) {
		release, err := FetchLatest(context.Background(), serve(t, http.StatusOK, `{"id": 7, "tag_name": "v12.1.0", "html_url": "https://example.com/v12.1.0"}`))
		require.NoError(t, err)
		assert.Equal(t, &model.GithubReleaseInfo{Id: 7, TagName: "v12.1.0", Url: "https://example.com/v12.1.0"}, release)
	})

	t.Run("rejects a non-200 response even with a release body", func(t *testing.T) {
		_, err := FetchLatest(context.Background(), serve(t, http.StatusBadGateway, `{"id": 7, "tag_name": "v12.1.0"}`))
		require.EqualError(t, err, "unexpected status code 502")
	})

	t.Run("rejects a body that is not JSON", func(t *testing.T) {
		_, err := FetchLatest(context.Background(), serve(t, http.StatusOK, `<html>`))
		require.Error(t, err)
	})

	t.Run("rejects a release without an ID", func(t *testing.T) {
		for _, body := range []string{`{"tag_name": "v12.1.0"}`, `null`} {
			_, err := FetchLatest(context.Background(), serve(t, http.StatusOK, body))
			require.ErrorContains(t, err, "empty ID", body)
		}
	})

	t.Run("stops when the context is cancelled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		_, err := FetchLatest(ctx, serve(t, http.StatusOK, `{"id": 7}`))
		require.ErrorIs(t, err, context.Canceled)
	})
}

func TestVersion(t *testing.T) {
	assert.Equal(t, "12.1.0", Version(&model.GithubReleaseInfo{TagName: "v12.1.0"}))
	assert.Equal(t, "12.1.0", Version(&model.GithubReleaseInfo{TagName: "12.1.0"}))
}
