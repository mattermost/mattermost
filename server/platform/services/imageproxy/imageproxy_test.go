// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"net/url"
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
	t.Run("should switch between backends", func(t *testing.T) {
		proxy := makeTestAtmosCamoProxy()

		require.Equal(t, "https://mattermost.example.com", proxy.backend.(*AtmosCamoBackend).siteURL.String())

		newConfig := proxy.ConfigService.Config().Clone()
		newConfig.ImageProxySettings.ImageProxyType = model.NewPointer(model.ImageProxyTypeLocal)

		proxy.ConfigService.(*testutils.StaticConfigService).UpdateConfig(newConfig)

		require.Equal(t, "https://mattermost.example.com", proxy.backend.(*LocalBackend).baseURL.String())

		newConfig = proxy.ConfigService.Config().Clone()
		newConfig.ImageProxySettings.ImageProxyType = model.NewPointer(model.ImageProxyTypeAtmosCamo)

		proxy.ConfigService.(*testutils.StaticConfigService).UpdateConfig(newConfig)

		require.Equal(t, "https://mattermost.example.com", proxy.backend.(*AtmosCamoBackend).siteURL.String())
	})

	t.Run("for local proxy, should update site URL when that changes", func(t *testing.T) {
		proxy := makeTestLocalProxy()

		require.Equal(t, "https://mattermost.example.com", proxy.siteURL.String())
		require.Equal(t, "https://mattermost.example.com", proxy.backend.(*LocalBackend).baseURL.String())

		newConfig := proxy.ConfigService.Config().Clone()
		newConfig.ServiceSettings.SiteURL = model.NewPointer("https://new.example.com")

		proxy.ConfigService.(*testutils.StaticConfigService).UpdateConfig(newConfig)

		require.Equal(t, "https://new.example.com", proxy.siteURL.String())
		require.Equal(t, "https://new.example.com", proxy.backend.(*LocalBackend).baseURL.String())
	})

	t.Run("for atmos/camo proxy, should update site URL when that changes", func(t *testing.T) {
		proxy := makeTestAtmosCamoProxy()

		require.Equal(t, "https://mattermost.example.com", proxy.siteURL.String())
		require.Equal(t, "https://mattermost.example.com", proxy.backend.(*AtmosCamoBackend).siteURL.String())

		newConfig := proxy.ConfigService.Config().Clone()
		newConfig.ServiceSettings.SiteURL = model.NewPointer("https://new.example.com")

		proxy.ConfigService.(*testutils.StaticConfigService).UpdateConfig(newConfig)

		require.Equal(t, "https://new.example.com", proxy.siteURL.String())
		require.Equal(t, "https://new.example.com", proxy.backend.(*AtmosCamoBackend).siteURL.String())
	})

	t.Run("for atmos/camo proxy, should update additional options when those change", func(t *testing.T) {
		proxy := makeTestAtmosCamoProxy()

		require.Equal(t, "http://images.example.com", proxy.backend.(*AtmosCamoBackend).remoteURL.String())
		// require.Equal(t, "7e5f3fab20b94782b43cdb022a66985ef28ba355df2c5d5da3c9a05e4b697bac", proxy.backend.(*AtmosCamoBackend).remoteOptions)

		newConfig := proxy.ConfigService.Config().Clone()
		newConfig.ImageProxySettings.RemoteImageProxyURL = model.NewPointer("https://new.example.com")
		newConfig.ImageProxySettings.RemoteImageProxyOptions = model.NewPointer("some other random hash")

		proxy.ConfigService.(*testutils.StaticConfigService).UpdateConfig(newConfig)

		require.Equal(t, "https://new.example.com", proxy.backend.(*AtmosCamoBackend).remoteURL.String())
		// require.Equal(t, "some other random hash", proxy.backend.(*AtmosCamoBackend).remoteOptions)
	})
}
