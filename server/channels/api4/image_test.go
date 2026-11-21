// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
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

	t.Run("block external images with local proxy enabled", func(t *testing.T) {
		var hits atomic.Int32
		imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			hits.Add(1)
			w.Header().Set("Content-Type", "image/png")
			_, err := w.Write([]byte("success"))
			require.NoError(t, err)
		}))
		defer imageServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ImageProxySettings.Enable = new(true)
			cfg.ImageProxySettings.ImageProxyType = new("local")
			cfg.ServiceSettings.BlockExternalImages = new(true)
			cfg.ServiceSettings.SiteURL = new("http://site.example.com")
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = new("127.0.0.1")
		})

		r, err := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(imageServer.URL+"/a.png"), nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		resp, err := th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		var appErr model.AppError
		err = json.NewDecoder(resp.Body).Decode(&appErr)
		require.NoError(t, err)
		assert.Equal(t, "api.image.get.blocked.app_error", appErr.Id)
		assert.Zero(t, hits.Load())

		// Same-host image URL should still redirect.
		r, err = http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape("http://site.example.com/plugins/test/image.png"), nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		respSameHost, err := th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		defer respSameHost.Body.Close()
		assert.Equal(t, http.StatusFound, respSameHost.StatusCode)
		assert.Equal(t, "http://site.example.com/plugins/test/image.png", respSameHost.Header.Get("Location"))

		// Relative image URL should still redirect.
		r, err = http.NewRequest("GET", th.Client.APIURL+"/image?url=/plugins/test/image.png", nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		respRel, err := th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		defer respRel.Body.Close()
		assert.Equal(t, http.StatusFound, respRel.StatusCode)
		assert.Equal(t, "http://site.example.com/plugins/test/image.png", respRel.Header.Get("Location"))

		// Uppercase host or explicit default port matching SiteURL should redirect, not hit LocalBackend.
		for _, sameOriginURL := range []string{
			"http://SITE.EXAMPLE.COM/plugins/test/image.png",
			"http://site.example.com:80/plugins/test/image.png",
		} {
			reqNorm, reqErr := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(sameOriginURL), nil)
			require.NoError(t, reqErr)
			reqNorm.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

			respNorm, normErr := th.Client.HTTPClient.Do(reqNorm)
			require.NoError(t, normErr)
			respNorm.Body.Close()
			assert.Equal(t, http.StatusFound, respNorm.StatusCode)
			assert.Equal(t, sameOriginURL, respNorm.Header.Get("Location"))
		}

		// Protocol-relative and nested /api/v4/image proxy URLs should be refused with 403.
		for _, blockedURL := range []string{
			strings.TrimPrefix(imageServer.URL, "http:") + "/a.png",
			"http://site.example.com/api/v4/image?url=" + url.QueryEscape(imageServer.URL+"/a.png"),
		} {
			reqBlocked, reqErr := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(blockedURL), nil)
			require.NoError(t, reqErr)
			reqBlocked.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

			respBlocked, blockedErr := th.Client.HTTPClient.Do(reqBlocked)
			require.NoError(t, blockedErr)
			respBlocked.Body.Close()
			assert.Equal(t, http.StatusForbidden, respBlocked.StatusCode)
		}

		// Subpath-outside URL should be refused with 403.
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.SiteURL = new("http://site.example.com/mm")
		})
		reqSubpath, err := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape("http://site.example.com/other/a.png"), nil)
		require.NoError(t, err)
		reqSubpath.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		respSubpath, err := th.Client.HTTPClient.Do(reqSubpath)
		require.NoError(t, err)
		defer respSubpath.Body.Close()
		assert.Equal(t, http.StatusForbidden, respSubpath.StatusCode)

		// Empty SiteURL with BlockExternalImages enabled: external URL returns 403, relative URL redirects.
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.SiteURL = new("")
		})
		reqEmptySiteExt, err := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(imageServer.URL+"/a.png"), nil)
		require.NoError(t, err)
		reqEmptySiteExt.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		respEmptySiteExt, err := th.Client.HTTPClient.Do(reqEmptySiteExt)
		require.NoError(t, err)
		defer respEmptySiteExt.Body.Close()
		assert.Equal(t, http.StatusForbidden, respEmptySiteExt.StatusCode)

		reqEmptySiteRel, err := http.NewRequest("GET", th.Client.APIURL+"/image?url=/plugins/test/image.png", nil)
		require.NoError(t, err)
		reqEmptySiteRel.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		respEmptySiteRel, err := th.Client.HTTPClient.Do(reqEmptySiteRel)
		require.NoError(t, err)
		defer respEmptySiteRel.Body.Close()
		assert.Equal(t, http.StatusFound, respEmptySiteRel.StatusCode)
		assert.Equal(t, "/plugins/test/image.png", respEmptySiteRel.Header.Get("Location"))

		assert.Zero(t, hits.Load())
	})

	t.Run("block external images with proxy disabled", func(t *testing.T) {
		var hits atomic.Int32
		imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			hits.Add(1)
			w.Header().Set("Content-Type", "image/png")
			_, err := w.Write([]byte("success"))
			require.NoError(t, err)
		}))
		defer imageServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ImageProxySettings.Enable = new(false)
			cfg.ServiceSettings.BlockExternalImages = new(true)
			cfg.ServiceSettings.SiteURL = new("http://site.example.com")
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = new("127.0.0.1")
		})

		r, err := http.NewRequest("GET", th.Client.APIURL+"/image?url="+url.QueryEscape(imageServer.URL+"/a.png"), nil)
		require.NoError(t, err)
		r.Header.Set(model.HeaderAuth, th.Client.AuthType+" "+th.Client.AuthToken)

		resp, err := th.Client.HTTPClient.Do(r)
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Zero(t, hits.Load())
	})
}
