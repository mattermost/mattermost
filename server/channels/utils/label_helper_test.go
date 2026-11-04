// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTrimLabelRemovesSurroundingSpaces(t *testing.T) {
	tests := map[string]struct {
		input    string
		expected string
	}{
		"no spaces":       {"label", "label"},
		"leading spaces":  {"  label", "label"},
		"trailing spaces": {"label  ", "label"},
		"both sides":      {" \t label \n", "label"},
		"inner spaces":    {" my label ", "my label"},
		"empty":           {"", ""},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.expected, TrimLabel(tc.input))
		})
	}
}
