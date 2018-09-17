// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package imageproxy

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils/testutils"
	"github.com/stretchr/testify/assert"
)

func makeTestAtmosCamoProxy() *ImageProxy {
	configService := &testutils.StaticConfigService{
		Cfg: &model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL: model.NewString("https://mattermost.example.com"),
			},
			ImageProxySettings: model.ImageProxySettings{
				Enable:                  model.NewBool(true),
				ImageProxyType:          model.NewString(model.IMAGE_PROXY_TYPE_ATMOS_CAMO),
				RemoteImageProxyURL:     model.NewString("http://images.example.com"),
				RemoteImageProxyOptions: model.NewString("7e5f3fab20b94782b43cdb022a66985ef28ba355df2c5d5da3c9a05e4b697bac"),
			},
		},
	}

	return MakeImageProxy(configService, nil)
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

func TestAtmosCamoBackend_GetProxiedImageURL(t *testing.T) {
	imageURL := "http://www.mattermost.org/wp-content/uploads/2016/03/logoHorizontal.png"
	proxiedURL := "http://images.example.com/5b6f6661516bc837b89b54566eb619d14a5c3eca/687474703a2f2f7777772e6d61747465726d6f73742e6f72672f77702d636f6e74656e742f75706c6f6164732f323031362f30332f6c6f676f486f72697a6f6e74616c2e706e67"

	proxy := makeTestAtmosCamoProxy()

	for _, test := range []struct {
		Name     string
		Input    string
		Expected string
	}{
		{
			Name:     "should proxy image",
			Input:    imageURL,
			Expected: proxiedURL,
		},
		{
			Name:     "should not proxy a relative image",
			Input:    "/static/logo.png",
			Expected: "/static/logo.png",
		},
		{
			Name:     "should not proxy an image on the Mattermost server",
			Input:    "https://mattermost.example.com/static/logo.png",
			Expected: "https://mattermost.example.com/static/logo.png",
		},
		{
			Name:     "should not proxy an image that has already been proxied",
			Input:    proxiedURL,
			Expected: proxiedURL,
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			assert.Equal(t, test.Expected, proxy.GetProxiedImageURL(test.Input))
		})
	}
}

func TestAtmosCamoBackend_GetUnproxiedImageURL(t *testing.T) {
	imageURL := "http://www.mattermost.org/wp-content/uploads/2016/03/logoHorizontal.png"
	proxiedURL := "http://images.example.com/5b6f6661516bc837b89b54566eb619d14a5c3eca/687474703a2f2f7777772e6d61747465726d6f73742e6f72672f77702d636f6e74656e742f75706c6f6164732f323031362f30332f6c6f676f486f72697a6f6e74616c2e706e67"

	proxy := makeTestAtmosCamoProxy()

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
			assert.Equal(t, test.Expected, proxy.GetUnproxiedImageURL(test.Input))
		})
	}
}
