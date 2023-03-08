// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/utils/testutils"
	"github.com/mattermost/mattermost-server/v6/server/platform/services/httpservice"
)

func makeTestAtmosCamoProxy() *ImageProxy {
	configService := &testutils.StaticConfigService{
		Cfg: &model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL:                             model.NewString("https://mattermost.example.com"),
				AllowedUntrustedInternalConnections: model.NewString("127.0.0.1"),
			},
			ImageProxySettings: model.ImageProxySettings{
				Enable:                  model.NewBool(true),
				ImageProxyType:          model.NewString(model.ImageProxyTypeAtmosCamo),
				RemoteImageProxyURL:     model.NewString("http://images.example.com"),
				RemoteImageProxyOptions: model.NewString("7e5f3fab20b94782b43cdb022a66985ef28ba355df2c5d5da3c9a05e4b697bac"),
			},
		},
	}

	return MakeImageProxy(configService, httpservice.MakeHTTPService(configService), nil)
}

func TestAtmosCamoBackend_GetImage(t *testing.T) {
	imageURL := "https://www.mattermost.com/wp-content/uploads/2022/02/logoHorizontalWhite.png"
	proxiedURL := "http://images.example.com/b569ce17f1be4550cffa8d8dd3a9e80e6d209584/68747470733a2f2f7777772e6d61747465726d6f73742e636f6d2f77702d636f6e74656e742f75706c6f6164732f323032322f30322f6c6f676f486f72697a6f6e74616c57686974652e706e67"

	proxy := makeTestAtmosCamoProxy()

	recorder := httptest.NewRecorder()
	request, _ := http.NewRequest(http.MethodGet, "", nil)
	proxy.GetImage(recorder, request, imageURL)
	resp := recorder.Result()

	assert.Equal(t, http.StatusFound, resp.StatusCode)
	assert.Equal(t, proxiedURL, resp.Header.Get("Location"))
}

func TestAtmosCamoBackend_GetImageDirect(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "max-age=2592000, private")
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Content-Length", "10")

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("1111111111"))
	})

	mock := httptest.NewServer(handler)
	defer mock.Close()

	proxy := makeTestAtmosCamoProxy()
	parsedURL, err := url.Parse(*proxy.ConfigService.Config().ServiceSettings.SiteURL)
	require.NoError(t, err)

	remoteURL, err := url.Parse(mock.URL)
	require.NoError(t, err)

	backend := &AtmosCamoBackend{
		proxy:     proxy,
		siteURL:   parsedURL,
		remoteURL: remoteURL,
		client:    proxy.HTTPService.MakeClient(false),
	}

	body, contentType, err := backend.GetImageDirect("https://example.com/image.png")

	assert.NoError(t, err)
	assert.Equal(t, "image/png", contentType)

	require.NotNil(t, body)
	respBody, _ := io.ReadAll(body)
	assert.Equal(t, []byte("1111111111"), respBody)
}

func TestGetAtmosCamoImageURL(t *testing.T) {
	imageURL := "https://mattermost.com/wp-content/uploads/2022/02/logoHorizontal.png"
	proxiedURL := "http://images.example.com/03b122734ae088d10cb46ea05512ec7dc852299e/68747470733a2f2f6d61747465726d6f73742e636f6d2f77702d636f6e74656e742f75706c6f6164732f323032322f30322f6c6f676f486f72697a6f6e74616c2e706e67"

	defaultSiteURL := "https://mattermost.example.com"
	proxyURL := "http://images.example.com"

	for _, test := range []struct {
		Name     string
		Input    string
		SiteURL  string
		Expected string
	}{
		{
			Name:     "should proxy image",
			Input:    imageURL,
			SiteURL:  defaultSiteURL,
			Expected: proxiedURL,
		},
		{
			Name:     "should proxy image when no site URL is set",
			Input:    imageURL,
			SiteURL:  "",
			Expected: proxiedURL,
		},
		{
			Name:     "should proxy image when a site URL with a subpath is set",
			Input:    imageURL,
			SiteURL:  proxyURL + "/subpath",
			Expected: proxiedURL,
		},
		{
			Name:     "should not proxy a relative image",
			Input:    "/static/logo.png",
			SiteURL:  defaultSiteURL,
			Expected: "https://mattermost.example.com/static/logo.png",
		},
		{
			Name:     "should bypass opaque URLs",
			Input:    "http:xyz123?query",
			SiteURL:  defaultSiteURL,
			Expected: defaultSiteURL,
		},
		{
			Name:     "should not proxy an image on the Mattermost server",
			Input:    "https://mattermost.example.com/static/logo.png",
			SiteURL:  defaultSiteURL,
			Expected: "https://mattermost.example.com/static/logo.png",
		},
		{
			Name:     "should not proxy an image on the Mattermost server when a subpath is set",
			Input:    "https://mattermost.example.com/static/logo.png",
			SiteURL:  defaultSiteURL + "/static",
			Expected: "https://mattermost.example.com/static/logo.png",
		},
		{
			Name:     "should not proxy an image that has already been proxied",
			Input:    proxiedURL,
			SiteURL:  defaultSiteURL,
			Expected: proxiedURL,
		},
		{
			Name:     "should not bypass protocol relative URLs",
			Input:    "https://mattermost.com/wp-content/uploads/2022/02/logoHorizontal.png",
			SiteURL:  "http://mattermost.example.com",
			Expected: proxiedURL,
		},
		{
			Name:     "should not bypass if the host prefix is same",
			Input:    "https://mattermost.com/wp-content/uploads/2022/02/logoHorizontal.png",
			SiteURL:  defaultSiteURL,
			Expected: "http://images.example.com/03b122734ae088d10cb46ea05512ec7dc852299e/68747470733a2f2f6d61747465726d6f73742e636f6d2f77702d636f6e74656e742f75706c6f6164732f323032322f30322f6c6f676f486f72697a6f6e74616c2e706e67",
		},
		{
			Name:     "should not bypass for user auth URLs",
			Input:    "https://mattermost.com/wp-content/uploads/2022/02/logoHorizontal.png",
			SiteURL:  defaultSiteURL,
			Expected: "http://images.example.com/03b122734ae088d10cb46ea05512ec7dc852299e/68747470733a2f2f6d61747465726d6f73742e636f6d2f77702d636f6e74656e742f75706c6f6164732f323032322f30322f6c6f676f486f72697a6f6e74616c2e706e67",
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			parsedURL, err := url.Parse(test.SiteURL)
			require.NoError(t, err)

			remoteURL, err := url.Parse(proxyURL)
			require.NoError(t, err)

			backend := &AtmosCamoBackend{
				proxy:     makeTestAtmosCamoProxy(),
				siteURL:   parsedURL,
				remoteURL: remoteURL,
			}

			assert.Equal(t, test.Expected, backend.getAtmosCamoImageURL(test.Input))
		})
	}

}
