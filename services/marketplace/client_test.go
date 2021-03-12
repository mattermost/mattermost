// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package marketplace

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBuildURL(t *testing.T) {
	config := &Client{}

	testCases := map[string]struct {
		base     string
		path     string
		expected string
	}{
		"Base url with trailing slash and path with leading slash": {
			base:     "https://api.integrations.mattermost.com/",
			path:     "/api/v1/plugins",
			expected: "https://api.integrations.mattermost.com/api/v1/plugins",
		},
		"Base url without trailing slash and path with leading slash": {
			base:     "https://api.integrations.mattermost.com",
			path:     "/api/v1/plugins",
			expected: "https://api.integrations.mattermost.com/api/v1/plugins",
		},
		"Base url without trailing slash and path without leading slash": {
			base:     "https://api.integrations.mattermost.com",
			path:     "api/v1/plugins",
			expected: "https://api.integrations.mattermost.com/api/v1/plugins",
		},
	}

	for name, tt := range testCases {
		t.Run(name, func(t *testing.T) {
			config.address = tt.base
			actual := config.buildURL(tt.path)
			assert.Equal(t, tt.expected, actual)
		})
	}
}
