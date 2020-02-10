// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExtractVersionFromComment(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{
			input:    "This is a comment.\n\nMinimum server version: 1.2.3-rc1\n",
			expected: "1.2.3-rc1",
		},
		{
			input:    "This is a comment.\n\nMinimum server version: 1.2.3\n",
			expected: "1.2.3",
		},
		{
			input:    "This is a comment.\n\nMinimum server version: 1.2\n",
			expected: "1.2",
		},
		{
			input:    "This is a comment.\n\nMinimum server version: 1\n",
			expected: "",
		},
		{
			input:    "This is a comment.\n",
			expected: "",
		},
		{
			input:    "",
			expected: "",
		},
	}

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("%+v", tc), func(t *testing.T) {
			assert.Equal(t, tc.expected, ExtractMinimumVersionFromComment(tc.input))
		})
	}
}
