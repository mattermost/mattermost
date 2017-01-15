// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/utils"
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

	siteURL := utils.GetSiteURL()
	defer func() {
		utils.SetSiteURL(siteURL)
	}()

	for _, tc := range testCases {
		utils.SetSiteURL(tc.url)

		if c.GetSiteURL() != tc.want {
			t.Fatalf("expected %s, got %s", tc.want, c.GetSiteURL())
		}
	}

}
