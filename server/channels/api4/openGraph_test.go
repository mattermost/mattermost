// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/model"
)

func TestGetOpenGraphMetadata(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client

	enableLinkPreviews := *th.App.Config().ServiceSettings.EnableLinkPreviews
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableLinkPreviews = enableLinkPreviews })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableLinkPreviews = true })
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ogDataCacheMissCount := 0

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ogDataCacheMissCount++

		if r.URL.Path == "/og-data/" {
			fmt.Fprintln(w, `
        <html><head><meta property="og:type" content="article" />
          <meta property="og:title" content="Test Title" />
          <meta property="og:url" content="http://example.com/" />
        </head><body></body></html>
      `)
		} else if r.URL.Path == "/no-og-data/" {
			fmt.Fprintln(w, `<html><head></head><body></body></html>`)
		}
	}))

	for _, data := range [](map[string]any){
		{"path": "/og-data/", "title": "Test Title", "cacheMissCount": 1},
		{"path": "/no-og-data/", "title": "", "cacheMissCount": 2},

		// Data should be cached for following
		{"path": "/og-data/", "title": "Test Title", "cacheMissCount": 2},
		{"path": "/no-og-data/", "title": "", "cacheMissCount": 2},
	} {

		openGraph, _, err := client.OpenGraph(ts.URL + data["path"].(string))
		require.NoError(t, err)

		require.Equalf(t, openGraph["title"], data["title"].(string),
			"OG data title mismatch for path \"%s\".")

		require.Equal(t, ogDataCacheMissCount, data["cacheMissCount"].(int),
			"Cache miss count didn't match.")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableLinkPreviews = false })
	_, resp, err := client.OpenGraph(ts.URL + "/og-data/")
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}
