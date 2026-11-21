// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package textutil

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDiffSummary(t *testing.T) {
	tests := []struct {
		name string
		old  string
		new  string
		want DiffResult
	}{
		{
			name: "both empty",
			old:  "",
			new:  "",
			want: DiffResult{},
		},
		{
			name: "both whitespace only",
			old:  " \t\n ",
			new:  "\n\t \t",
			want: DiffResult{},
		},
		{
			name: "old empty new has words",
			old:  "",
			new:  "hello world",
			want: DiffResult{Added: 2, Removed: 0, Unchanged: 0},
		},
		{
			name: "new empty old has words",
			old:  "hello world",
			new:  "",
			want: DiffResult{Added: 0, Removed: 2, Unchanged: 0},
		},
		{
			name: "identical strings",
			old:  "hello world",
			new:  "hello world",
			want: DiffResult{Added: 0, Removed: 0, Unchanged: 2},
		},
		{
			name: "repeated words counted by occurrence",
			old:  "go go go",
			new:  "go go",
			want: DiffResult{Added: 0, Removed: 1, Unchanged: 2},
		},
		{
			name: "repeated words added by occurrence",
			old:  "go",
			new:  "go go go",
			want: DiffResult{Added: 2, Removed: 0, Unchanged: 1},
		},
		{
			name: "extra spaces tabs and newlines",
			old:  "a  b\t\tc\n\nd",
			new:  "a b c d",
			want: DiffResult{Added: 0, Removed: 0, Unchanged: 4},
		},
		{
			name: "unicode words",
			old:  "café 日本語",
			new:  "café 日本語",
			want: DiffResult{Added: 0, Removed: 0, Unchanged: 2},
		},
		{
			name: "case sensitivity",
			old:  "Hello",
			new:  "hello",
			want: DiffResult{Added: 1, Removed: 1, Unchanged: 0},
		},
		{
			name: "order ignored",
			old:  "red green blue",
			new:  "blue green red",
			want: DiffResult{Added: 0, Removed: 0, Unchanged: 3},
		},
		{
			name: "mixed add remove unchanged",
			old:  "apple banana cherry",
			new:  "banana cherry date fig",
			want: DiffResult{Added: 2, Removed: 1, Unchanged: 2},
		},
		{
			name: "multiset overlap",
			old:  "a a b",
			new:  "a b b",
			want: DiffResult{Added: 1, Removed: 1, Unchanged: 2},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DiffSummary(tt.old, tt.new)
			assert.Equal(t, tt.want, got)
		})
	}
}
