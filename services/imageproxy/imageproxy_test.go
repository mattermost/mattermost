// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"net/url"
	"testing"

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
