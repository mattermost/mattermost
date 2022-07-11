// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTextRanges(t *testing.T) {
	for name, tc := range map[string]struct {
		Markdown       string
		ExpectedRanges []Range
		ExpectedValues []string
	}{
		"simple": {
			Markdown:       "hello",
			ExpectedRanges: []Range{{0, 5}},
			ExpectedValues: []string{"hello"},
		},
		"simple2": {
			Markdown:       "hello!",
			ExpectedRanges: []Range{{0, 6}},
			ExpectedValues: []string{"hello!"},
		},
		"multiline": {
			Markdown:       "hello world\nfoobar",
			ExpectedRanges: []Range{{0, 11}, {12, 18}},
			ExpectedValues: []string{"hello world", "foobar"},
		},
		"code": {
			Markdown:       "hello `code` world",
			ExpectedRanges: []Range{{0, 6}, {12, 18}},
			ExpectedValues: []string{"hello ", " world"},
		},
		"notcode": {
			Markdown:       "hello ` world",
			ExpectedRanges: []Range{{0, 13}},
			ExpectedValues: []string{"hello ` world"},
		},
		"escape": {
			Markdown:       "\\*hello\\*",
			ExpectedRanges: []Range{{1, 7}, {8, 9}},
			ExpectedValues: []string{"*hello", "*"},
		},
		"escapeescape": {
			Markdown:       "\\\\",
			ExpectedRanges: []Range{{1, 2}},
			ExpectedValues: []string{"\\"},
		},
		"notescape": {
			Markdown:       "foo\\x",
			ExpectedRanges: []Range{{0, 5}},
			ExpectedValues: []string{"foo\\x"},
		},
		"notlink": {
			Markdown:       "[foo",
			ExpectedRanges: []Range{{0, 4}},
			ExpectedValues: []string{"[foo"},
		},
		"notlinkend": {
			Markdown:       "[foo]",
			ExpectedRanges: []Range{{0, 5}},
			ExpectedValues: []string{"[foo]"},
		},
		"notimage": {
			Markdown:       "![foo",
			ExpectedRanges: []Range{{0, 5}},
			ExpectedValues: []string{"![foo"},
		},
		"notimage2": {
			Markdown:       "!foo",
			ExpectedRanges: []Range{{0, 4}},
			ExpectedValues: []string{"!foo"},
		},
		"charref": {
			Markdown:       "&quot;test",
			ExpectedRanges: []Range{{0, 1}, {6, 10}},
			ExpectedValues: []string{"\"", "test"},
		},
		"notcharref": {
			Markdown:       "&amp test",
			ExpectedRanges: []Range{{0, 9}},
			ExpectedValues: []string{"&amp test"},
		},
		"notcharref2": {
			Markdown:       "this is &mattermost;",
			ExpectedRanges: []Range{{0, 20}},
			ExpectedValues: []string{"this is &mattermost;"},
		},
		"standalone-ampersand": {
			Markdown:       "Hello & World",
			ExpectedRanges: []Range{{0, 13}},
			ExpectedValues: []string{"Hello & World"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			var ranges []Range
			var values []string
			Inspect(tc.Markdown, func(node any) bool {
				if textNode, ok := node.(*Text); ok {
					ranges = append(ranges, textNode.Range)
					values = append(values, textNode.Text)
				}
				return true
			})
			assert.Equal(t, tc.ExpectedRanges, ranges)
			assert.Equal(t, tc.ExpectedValues, values)

		})
	}

}
