// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseLines(t *testing.T) {
	assert.Equal(t, []Line{
		{Range{0, 4}}, {Range{4, 7}},
	}, ParseLines("foo\nbar"))

	assert.Equal(t, []Line{
		{Range{0, 5}}, {Range{5, 8}},
	}, ParseLines("foo\r\nbar"))

	assert.Equal(t, []Line{
		{Range{0, 4}}, {Range{4, 6}}, {Range{6, 9}},
	}, ParseLines("foo\r\r\nbar"))

	assert.Equal(t, []Line{
		{Range{0, 4}},
	}, ParseLines("foo\n"))

	assert.Equal(t, []Line{
		{Range{0, 4}},
	}, ParseLines("foo\r"))

	assert.Equal(t, []Line{
		{Range{0, 5}},
	}, ParseLines("foo\r\n"))
}
