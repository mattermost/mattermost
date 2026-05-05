// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/stretchr/testify/assert"
)

func TestSameFileIDs(t *testing.T) {
	tests := []struct {
		name     string
		a        []string
		b        []string
		expected bool
	}{
		{
			name:     "both empty",
			a:        []string{},
			b:        []string{},
			expected: true,
		},
		{
			name:     "both nil",
			a:        nil,
			b:        nil,
			expected: true,
		},
		{
			name:     "same files same order",
			a:        []string{"file1", "file2", "file3"},
			b:        []string{"file1", "file2", "file3"},
			expected: true,
		},
		{
			name:     "same files different order",
			a:        []string{"file3", "file1", "file2"},
			b:        []string{"file1", "file2", "file3"},
			expected: true,
		},
		{
			name:     "one file added",
			a:        []string{"file1", "file2", "file3"},
			b:        []string{"file1", "file2"},
			expected: false,
		},
		{
			name:     "one file removed",
			a:        []string{"file1"},
			b:        []string{"file1", "file2"},
			expected: false,
		},
		{
			name:     "different files same length",
			a:        []string{"file1", "file2"},
			b:        []string{"file1", "file3"},
			expected: false,
		},
		{
			name:     "duplicate IDs in a",
			a:        []string{"file1", "file1"},
			b:        []string{"file1", "file2"},
			expected: false,
		},
		{
			name:     "duplicate IDs same in both",
			a:        []string{"file1", "file1"},
			b:        []string{"file1", "file1"},
			expected: true,
		},
		{
			name:     "empty vs non-empty",
			a:        []string{},
			b:        []string{"file1"},
			expected: false,
		},
		{
			name:     "nil vs non-empty",
			a:        nil,
			b:        []string{"file1"},
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := utils.SliceEqualUnordered(tc.a, tc.b)
			assert.Equal(t, tc.expected, result)
		})
	}
}
