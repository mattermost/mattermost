// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Prevent the test client from following a redirect
	th.Client.HTTPClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}

	t.Run("proxy disabled", func(t *testing.T) {
		imageURL := "http://foo.bar/baz.gif"

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ImageProxySettings.Enable = model.NewPointer(false)
		})

		r, err := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(imageURL), nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		// External images should not be allowed through this endpoint when proxy is disabled.
		resp, err := th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("atmos/camo", func(t *testing.T) {
		imageURL := "http://foo.bar/baz.gif"
		proxiedURL := "https://proxy.foo.bar/004afe2ef382eb5f30c4490f793f8a8c5b33d8a2/687474703a2f2f666f6f2e6261722f62617a2e676966"

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ImageProxySettings.Enable = model.NewPointer(true)
			cfg.ImageProxySettings.ImageProxyType = model.NewPointer("atmos/camo")
			cfg.ImageProxySettings.RemoteImageProxyOptions = model.NewPointer("foo")
			cfg.ImageProxySettings.RemoteImageProxyURL = model.NewPointer("https://proxy.foo.bar")
		})

		r, err := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(imageURL), nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		resp, err := th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		assert.Equal(t, http.StatusFound, resp.StatusCode)
		assert.Equal(t, proxiedURL, resp.Header.Get("Location"))
	})

	t.Run("local", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ImageProxySettings.Enable = model.NewPointer(true)
			cfg.ImageProxySettings.ImageProxyType = model.NewPointer("local")

			// Allow requests to the "remote" image
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = model.NewPointer("127.0.0.1")
		})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "image/png")
			_, err := w.Write([]byte("success"))
			require.NoError(t, err)
		})

		imageServer := httptest.NewServer(handler)
		defer imageServer.Close()

		r, err := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(imageServer.URL+"/image.png"), nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		resp, err := th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		respBody, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, "success", string(respBody))

		// local images should not be proxied, but forwarded
		r, err = http.NewRequest("GET", th.Client.APIURL+"/image?url=/plugins/test/image.png", nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		resp, err = th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		assert.Equal(t, http.StatusFound, resp.StatusCode)

		// protocol relative URLs should be handled by proxy
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.SiteURL = model.NewPointer("http://foo.com")
		})
		r, err = http.NewRequest("GET", th.Client.APIURL+"/image?url="+strings.TrimPrefix(imageServer.URL, "http:")+"/image.png", nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		resp, err = th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// opaque URLs are not supported, should return an error
		r, err = http.NewRequest("GET", th.Client.APIURL+"/image?url=mailto:test@example.com", nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		resp, err = th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}
