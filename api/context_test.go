// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
)

func TestSiteURL(t *testing.T) {
	c := &Context{}

	testCases := []struct {
		url  string
		want string
	}{
		{"http://mattermost.com/", "http://mattermost.com"},
		{"http://mattermost.com", "http://mattermost.com"},
	}

	for _, tc := range testCases {
		c.SetSiteURL(tc.url)

		if c.siteURL != tc.want {
			t.Fatalf("expected %s, got %s", tc.want, c.siteURL)
		}
	}

}
