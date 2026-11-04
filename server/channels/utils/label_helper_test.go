// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTrimLabel(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"no surrounding spaces", "label", "label"},
		{"leading spaces", "  label", "label"},
		{"trailing spaces", "label  ", "label"},
		{"surrounding tabs and newlines", "\t label \n", "label"},
		{"inner spaces are kept", " my label ", "my label"},
		{"only spaces", "   ", ""},
		{"empty", "", ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, TrimLabel(tc.input))
		})
	}
}
