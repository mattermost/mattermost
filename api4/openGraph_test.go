// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"

	"testing"

	"github.com/mattermost/platform/utils"
)

func TestGetOpenGraphMetadata(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.Client

	enableLinkPreviews := *utils.Cfg.ServiceSettings.EnableLinkPreviews
	allowedInternalConnections := *utils.Cfg.ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		*utils.Cfg.ServiceSettings.EnableLinkPreviews = enableLinkPreviews
		utils.Cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
	}()
	*utils.Cfg.ServiceSettings.EnableLinkPreviews = true
	*utils.Cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"

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

	for _, data := range [](map[string]interface{}){
		{"path": "/og-data/", "title": "Test Title", "cacheMissCount": 1},
		{"path": "/no-og-data/", "title": "", "cacheMissCount": 2},

		// Data should be cached for following
		{"path": "/og-data/", "title": "Test Title", "cacheMissCount": 2},
		{"path": "/no-og-data/", "title": "", "cacheMissCount": 2},
	} {

		openGraph, resp := Client.OpenGraph(ts.URL + data["path"].(string))
		CheckNoError(t, resp)
		if strings.Compare(openGraph["title"], data["title"].(string)) != 0 {
			t.Fatal(fmt.Sprintf(
				"OG data title mismatch for path \"%s\". Expected title: \"%s\". Actual title: \"%s\"",
				data["path"].(string), data["title"].(string), openGraph["title"],
			))
		}

		if ogDataCacheMissCount != data["cacheMissCount"].(int) {
			t.Fatal(fmt.Sprintf(
				"Cache miss count didn't match. Expected value %d. Actual value %d.",
				data["cacheMissCount"].(int), ogDataCacheMissCount,
			))
		}
	}

	*utils.Cfg.ServiceSettings.EnableLinkPreviews = false
	_, resp := Client.OpenGraph(ts.URL + "/og-data/")
	CheckNotImplementedStatus(t, resp)
}
