// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
	"github.com/mattermost/mattermost-server/v5/utils/testutils"
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
				ImageProxyType:          model.NewString(model.IMAGE_PROXY_TYPE_ATMOS_CAMO),
				RemoteImageProxyURL:     model.NewString("http://images.example.com"),
				RemoteImageProxyOptions: model.NewString("7e5f3fab20b94782b43cdb022a66985ef28ba355df2c5d5da3c9a05e4b697bac"),
			},
		},
	}

	return MakeImageProxy(configService, httpservice.MakeHTTPService(configService), nil)
}

func TestAtmosCamoBackend_GetImage(t *testing.T) {
	imageURL := "http://www.mattermost.org/wp-content/uploads/2016/03/logoHorizontalWhite.png"
	proxiedURL := "http://images.example.com/62183a1cf0a4927c3b56d249366c2745e34ffe63/687474703a2f2f7777772e6d61747465726d6f73742e6f72672f77702d636f6e74656e742f75706c6f6164732f323031362f30332f6c6f676f486f72697a6f6e74616c57686974652e706e67"

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
	}

	body, contentType, err := backend.GetImageDirect("https://example.com/image.png")

	assert.NoError(t, err)
	assert.Equal(t, "image/png", contentType)

	require.NotNil(t, body)
	respBody, _ := ioutil.ReadAll(body)
	assert.Equal(t, []byte("1111111111"), respBody)
}

func TestGetAtmosCamoImageURL(t *testing.T) {
	imageURL := "http://www.mattermost.org/wp-content/uploads/2016/03/logoHorizontal.png"
	proxiedURL := "http://images.example.com/5b6f6661516bc837b89b54566eb619d14a5c3eca/687474703a2f2f7777772e6d61747465726d6f73742e6f72672f77702d636f6e74656e742f75706c6f6164732f323031362f30332f6c6f676f486f72697a6f6e74616c2e706e67"

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
			Input:    "//www.mattermost.org/wp-content/uploads/2016/03/logoHorizontal.png",
			SiteURL:  "http://mattermost.example.com",
			Expected: proxiedURL,
		},
		{
			Name:     "should not bypass if the host prefix is same",
			Input:    "http://www.mattermost.org.example.com/wp-content/uploads/2016/03/logoHorizontal.png",
			SiteURL:  defaultSiteURL,
			Expected: "http://images.example.com/99dcf38b8e6110d6e3ebcfb7a2db9ce875bc5c03/687474703a2f2f7777772e6d61747465726d6f73742e6f72672e6578616d706c652e636f6d2f77702d636f6e74656e742f75706c6f6164732f323031362f30332f6c6f676f486f72697a6f6e74616c2e706e67",
		},
		{
			Name:     "should not bypass for user auth URLs",
			Input:    "http://www.mattermost.org@example.com/wp-content/uploads/2016/03/logoHorizontal.png",
			SiteURL:  defaultSiteURL,
			Expected: "http://images.example.com/19deedea7c0b75369f8d2162ee4e7ab36e26ca50/687474703a2f2f7777772e6d61747465726d6f73742e6f7267406578616d706c652e636f6d2f77702d636f6e74656e742f75706c6f6164732f323031362f30332f6c6f676f486f72697a6f6e74616c2e706e67",
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
