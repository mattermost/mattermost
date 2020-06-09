// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetProxiedImageURL(t *testing.T) {
	siteURL := "https://mattermost.example.com"

	imageURL := "http://www.mattermost.org/wp-content/uploads/2016/03/logoHorizontal.png"
	proxiedURL := "https://mattermost.example.com/api/v4/image?url=http%3A%2F%2Fwww.mattermost.org%2Fwp-content%2Fuploads%2F2016%2F03%2FlogoHorizontal.png"

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
			assert.Equal(t, test.Expected, getProxiedImageURL(test.Input, siteURL))
		})
	}
}

func TestGetUnproxiedImageURL(t *testing.T) {
	siteURL := "https://mattermost.example.com"

	imageURL := "http://www.mattermost.org/wp-content/uploads/2016/03/logoHorizontal.png"
	proxiedURL := "https://mattermost.example.com/api/v4/image?url=http%3A%2F%2Fwww.mattermost.org%2Fwp-content%2Fuploads%2F2016%2F03%2FlogoHorizontal.png"

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
