// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPager(t *testing.T) {
	tests := []struct {
		name      string
		fetch     func(page int) ([]int, error)
		perPage   int
		expected  []int
		expectErr bool
	}{
		{
			name: "successful fetch",
			fetch: func(page int) ([]int, error) {
				if page > 2 {
					return nil, nil
				}
				return []int{page*10 + 1, page*10 + 2, page*10 + 3}, nil
			},
			perPage:  3,
			expected: []int{1, 2, 3, 11, 12, 13, 21, 22, 23},
		},
		{
			name: "fetch with error",
			fetch: func(page int) ([]int, error) {
				if page == 1 {
					return nil, errors.New("fetch error")
				}
				return []int{page*10 + 1, page*10 + 2, page*10 + 3}, nil
			},
			perPage:   3,
			expected:  []int{1, 2, 3},
			expectErr: true,
		},
		{
			name: "fetch with fewer items than perPage",
			fetch: func(page int) ([]int, error) {
				if page > 0 {
					return []int{11, 12}, nil
				}
				return []int{page*10 + 1, page*10 + 2, page*10 + 3}, nil
			},
			perPage:  3,
			expected: []int{1, 2, 3, 11, 12},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := Pager(tt.fetch, tt.perPage)
			if tt.expectErr {
				assert.Error(t, err)
				assert.Equal(t, tt.expected, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}
