// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
)

func TestSiteURLHeader(t *testing.T) {
	c := &Context{}

	testCases := []struct {
		url  string
		want string
	}{
		{"http://mattermost.com/", "http://mattermost.com"},
		{"http://mattermost.com", "http://mattermost.com"},
	}

	for _, tc := range testCases {
		c.SetSiteURLHeader(tc.url)

		if c.siteURLHeader != tc.want {
			t.Fatalf("expected %s, got %s", tc.want, c.siteURLHeader)
		}
	}

}
