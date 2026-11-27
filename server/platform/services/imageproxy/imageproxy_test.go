// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetProxiedImageURL(t *testing.T) {
	siteURL := "https://mattermost.example.com"
	parsedURL, err := url.Parse(siteURL)
	require.NoError(t, err)

	imageURL := "https://mattermost.com/wp-content/uploads/2022/02/logoHorizontal.png"
	proxiedURL := "https://mattermost.example.com/api/v4/image?url=https%3A%2F%2Fmattermost.com%2Fwp-content%2Fuploads%2F2022%2F02%2FlogoHorizontal.png"

	proxy := ImageProxy{siteURL: parsedURL}

	for _, test := range []struct {
		Name     string
		Input    string
		Expected string
	}{
		{
			Name:     "should proxy an image",
			Input:    imageURL,
			Expected: proxiedURL,
		},
		{
			Name:     "should not proxy a relative image",
			Input:    "/static/logo.png",
			Expected: "https://mattermost.example.com/static/logo.png",
		},
		{
			Name:     "should bypass opaque URLs",
			Input:    "http:xyz123?query",
			Expected: siteURL,
		},
		{
			Name:     "should not proxy an image on the Mattermost server",
			Input:    "https://mattermost.example.com/static/logo.png",
			Expected: "https://mattermost.example.com/static/logo.png",
		},
		{
			Name:     "should not proxy an image on the Mattermost server with different host casing",
			Input:    "https://MATTERMOST.EXAMPLE.COM/static/logo.png",
			Expected: "https://MATTERMOST.EXAMPLE.COM/static/logo.png",
		},
		{
			Name:     "should not proxy an image on the Mattermost server with default port",
			Input:    "https://mattermost.example.com:443/static/logo.png",
			Expected: "https://mattermost.example.com:443/static/logo.png",
		},
		{
			Name:     "should proxy an image on the Mattermost server with different port",
			Input:    "https://mattermost.example.com:8443/static/logo.png",
			Expected: "https://mattermost.example.com/api/v4/image?url=https%3A%2F%2Fmattermost.example.com%3A8443%2Fstatic%2Flogo.png",
		},
		{
			Name:     "should proxy an image on the Mattermost server with different scheme",
			Input:    "http://mattermost.example.com/static/logo.png",
			Expected: "https://mattermost.example.com/api/v4/image?url=http%3A%2F%2Fmattermost.example.com%2Fstatic%2Flogo.png",
		},
		{
			Name:     "should not proxy an image that has already been proxied",
			Input:    proxiedURL,
			Expected: proxiedURL,
		},
		{
			Name:     "should not bypass protocol relative URLs",
			Input:    "//mattermost.com/static/logo.png",
			Expected: "https://mattermost.example.com/api/v4/image?url=https%3A%2F%2Fmattermost.com%2Fstatic%2Flogo.png",
		},
		{
			Name:     "should not bypass if the host prefix is same",
			Input:    "https://mattermost.example.com.anothersite.com/static/logo.png",
			Expected: "https://mattermost.example.com/api/v4/image?url=https%3A%2F%2Fmattermost.example.com.anothersite.com%2Fstatic%2Flogo.png",
		},
		{
			Name:     "should not bypass for user auth URLs",
			Input:    "https://mattermost.example.com@anothersite.com/static/logo.png",
			Expected: "https://mattermost.example.com/api/v4/image?url=https%3A%2F%2Fmattermost.example.com%40anothersite.com%2Fstatic%2Flogo.png",
		},
		{
			Name:     "should not proxy embedded image",
			Input:    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==",
			Expected: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==",
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			assert.Equal(t, test.Expected, proxy.GetProxiedImageURL(test.Input))
		})
	}
}

func TestGetUnproxiedImageURL(t *testing.T) {
	siteURL := "https://mattermost.example.com"

	imageURL := "https://mattermost.com/wp-content/uploads/2022/02/logoHorizontal.png"
	proxiedURL := "https://mattermost.example.com/api/v4/image?url=https%3A%2F%2Fmattermost.com%2Fwp-content%2Fuploads%2F2022%2F02%2FlogoHorizontal.png"

	for _, test := range []struct {
		Name     string
		Input    string
		Expected string
	}{
		{
			Name:     "should remove proxy",
			Input:    proxiedURL,
			Expected: imageURL,
		},
		{
			Name:     "should not remove proxy from a relative image",
			Input:    "/static/logo.png",
			Expected: "/static/logo.png",
		},
		{
			Name:     "should not remove proxy from an image on the Mattermost server",
			Input:    "https://mattermost.example.com/static/logo.png",
			Expected: "https://mattermost.example.com/static/logo.png",
		},
		{
			Name:     "should not remove proxy from a non-proxied image",
			Input:    imageURL,
			Expected: imageURL,
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			assert.Equal(t, test.Expected, getUnproxiedImageURL(test.Input, siteURL))
		})
	}
}

func TestOnConfigChange(t *testing.T) {
	t.Run("for local proxy, should update site URL when that changes", func(t *testing.T) {
		proxy := makeTestLocalProxy()

		require.Equal(t, "https://mattermost.example.com", proxy.siteURL.String())
		require.Equal(t, "https://mattermost.example.com", proxy.backend.(*LocalBackend).baseURL.String())

		newConfig := proxy.ConfigService.Config().Clone()
		newConfig.ServiceSettings.SiteURL = new("https://new.example.com")

		proxy.ConfigService.(*testutils.StaticConfigService).UpdateConfig(newConfig)

		require.Equal(t, "https://new.example.com", proxy.siteURL.String())
		require.Equal(t, "https://new.example.com", proxy.backend.(*LocalBackend).baseURL.String())
	})

	t.Run("switches between local and block backends", func(t *testing.T) {
		var hits atomic.Int32
		imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			hits.Add(1)
			w.Header().Set("Content-Type", "image/png")
			if _, writeErr := w.Write([]byte("ok")); writeErr != nil {
				t.Errorf("write response: %v", writeErr)
			}
		}))
		defer imageServer.Close()

		proxy := makeTestLocalProxy()
		cs, ok := proxy.ConfigService.(*testutils.StaticConfigService)
		require.True(t, ok)
		targetURL := imageServer.URL + "/a.png"

		body, contentType, err := proxy.GetImageDirect(targetURL)
		require.NoError(t, err)
		require.Equal(t, "image/png", contentType)
		data, readErr := io.ReadAll(body)
		require.NoError(t, readErr)
		require.NoError(t, body.Close())
		require.Equal(t, "ok", string(data))
		require.Equal(t, int32(1), hits.Load())

		newConfig := proxy.ConfigService.Config().Clone()
		newConfig.ImageProxySettings.ImageProxyType = model.NewPointer(model.ImageProxyTypeBlock)
		cs.UpdateConfig(newConfig)

		_, _, err = proxy.GetImageDirect(targetURL)
		require.ErrorIs(t, err, ErrExternalImageBlocked)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/image?url="+url.QueryEscape(targetURL), nil)
		proxy.GetImage(rec, req, targetURL)
		require.Equal(t, http.StatusForbidden, rec.Code)
		require.Equal(t, int32(1), hits.Load())

		backToLocal := proxy.ConfigService.Config().Clone()
		backToLocal.ImageProxySettings.ImageProxyType = model.NewPointer(model.ImageProxyTypeLocal)
		cs.UpdateConfig(backToLocal)

		recLocal := httptest.NewRecorder()
		reqLocal := httptest.NewRequest(http.MethodGet, "/api/v4/image?url="+url.QueryEscape(targetURL), nil)
		proxy.GetImage(recLocal, reqLocal, targetURL)
		require.Equal(t, http.StatusOK, recLocal.Code)
		require.Equal(t, "ok", recLocal.Body.String())
		require.Equal(t, int32(2), hits.Load())
	})
}
