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
	mainHelper.Parallel(t)
	th := Setup(t)

	// Prevent the test client from following a redirect
	th.Client.HTTPClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}

	t.Run("proxy disabled", func(t *testing.T) {
		imageURL := "http://foo.bar/baz.gif"

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ImageProxySettings.Enable = new(false)
		})

		r, err := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(imageURL), nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		// External images should not be allowed through this endpoint when proxy is disabled.
		resp, err := th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("local", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ImageProxySettings.Enable = new(true)
			cfg.ImageProxySettings.ImageProxyType = new("local")

			// Allow requests to the "remote" image
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = new("127.0.0.1")
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
			cfg.ServiceSettings.SiteURL = new("http://foo.com")
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
