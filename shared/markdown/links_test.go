// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseImageDimensions(t *testing.T) {
	for name, tc := range map[string]struct {
		Input         string
		Position      int
		ExpectedRange Range
		ExpectedNext  int
		ExpectedOk    bool
	}{
		"no dimensions, no title": {
			Input:         `![alt](https://example.com)`,
			Position:      26,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"no dimensions, title": {
			Input:         `![alt](https://example.com "title")`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"only width, no title": {
			Input:         `![alt](https://example.com =100)`,
			Position:      27,
			ExpectedRange: Range{27, 30},
			ExpectedNext:  31,
			ExpectedOk:    true,
		},
		"only width, title": {
			Input:         `![alt](https://example.com =100 "title")`,
			Position:      27,
			ExpectedRange: Range{27, 30},
			ExpectedNext:  31,
			ExpectedOk:    true,
		},
		"only height, no title": {
			Input:         `![alt](https://example.com =x100)`,
			Position:      27,
			ExpectedRange: Range{27, 31},
			ExpectedNext:  32,
			ExpectedOk:    true,
		},
		"only height, title": {
			Input:         `![alt](https://example.com =x100 "title")`,
			Position:      27,
			ExpectedRange: Range{27, 31},
			ExpectedNext:  32,
			ExpectedOk:    true,
		},
		"dimensions, no title": {
			Input:         `![alt](https://example.com =100x200)`,
			Position:      27,
			ExpectedRange: Range{27, 34},
			ExpectedNext:  35,
			ExpectedOk:    true,
		},
		"dimensions, title": {
			Input:         `![alt](https://example.com =100x200 "title")`,
			Position:      27,
			ExpectedRange: Range{27, 34},
			ExpectedNext:  35,
			ExpectedOk:    true,
		},
		"no dimensions, no title, trailing whitespace": {
			Input:         `![alt](https://example.com )`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"only width, no title, trailing whitespace": {
			Input:         `![alt](https://example.com  =100  )`,
			Position:      28,
			ExpectedRange: Range{28, 31},
			ExpectedNext:  32,
			ExpectedOk:    true,
		},
		"only height, no title, trailing whitespace": {
			Input:         `![alt](https://example.com   =x100   )`,
			Position:      29,
			ExpectedRange: Range{29, 33},
			ExpectedNext:  34,
			ExpectedOk:    true,
		},
		"dimensions, no title, trailing whitespace": {
			Input:         `![alt](https://example.com    =100x200   )`,
			Position:      30,
			ExpectedRange: Range{30, 37},
			ExpectedNext:  38,
			ExpectedOk:    true,
		},
		"no width or height": {
			Input:         `![alt](https://example.com =x)`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"garbage 1": {
			Input:         `![alt](https://example.com =aaa)`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"garbage 2": {
			Input:         `![alt](https://example.com ====)`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"garbage 3": {
			Input:         `![alt](https://example.com =100xx200)`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"garbage 4": {
			Input:         `![alt](https://example.com =100x200x300x400)`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"garbage 5": {
			Input:         `![alt](https://example.com =100x200`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"garbage 6": {
			Input:         `![alt](https://example.com =100x`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
		"garbage 7": {
			Input:         `![alt](https://example.com =x200`,
			Position:      27,
			ExpectedRange: Range{0, 0},
			ExpectedNext:  0,
			ExpectedOk:    false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			raw, next, ok := parseImageDimensions(tc.Input, tc.Position)
			assert.Equal(t, tc.ExpectedOk, ok)
			assert.Equal(t, tc.ExpectedNext, next)
			assert.Equal(t, tc.ExpectedRange, raw)
		})
	}
}

func TestImageLinksWithDimensions(t *testing.T) {
	for name, tc := range map[string]struct {
		Markdown     string
		ExpectedHTML string
	}{
		"regular link": {
			Markdown:     `[link](https://example.com)`,
			ExpectedHTML: `<p><a href="https://example.com">link</a></p>`,
		},
		"image link": {
			Markdown:     `![image](https://example.com/image.png)`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" /></p>`,
		},
		"image link with title": {
			Markdown:     `![image](https://example.com/image.png "title")`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" title="title" /></p>`,
		},
		"image link with bracketed title": {
			Markdown:     `![image](https://example.com/image.png (title))`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" title="title" /></p>`,
		},
		"image link with width": {
			Markdown:     `![image](https://example.com/image.png =500)`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" /></p>`,
		},
		"image link with width and title": {
			Markdown:     `![image](https://example.com/image.png =500 "title")`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" title="title" /></p>`,
		},
		"image link with width and bracketed title": {
			Markdown:     `![image](https://example.com/image.png =500 (title))`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" title="title" /></p>`,
		},
		"image link with height": {
			Markdown:     `![image](https://example.com/image.png =x500)`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" /></p>`,
		},
		"image link with height and title": {
			Markdown:     `![image](https://example.com/image.png =x500 "title")`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" title="title" /></p>`,
		},
		"image link with height and bracketed title": {
			Markdown:     `![image](https://example.com/image.png =x500 (title))`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" title="title" /></p>`,
		},
		"image link with dimensions": {
			Markdown:     `![image](https://example.com/image.png =500x400)`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" /></p>`,
		},
		"image link with dimensions and title": {
			Markdown:     `![image](https://example.com/image.png =500x400 "title")`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" title="title" /></p>`,
		},
		"image link with dimensions and bracketed title": {
			Markdown:     `![image](https://example.com/image.png =500x400 (title))`,
			ExpectedHTML: `<p><img src="https://example.com/image.png" alt="image" title="title" /></p>`,
		},
		"no image link 1": {
			Markdown:     `![image]()`,
			ExpectedHTML: `<p><img src="" alt="image" /></p>`,
		},
		"no image link 2": {
			Markdown:     `![image]( )`,
			ExpectedHTML: `<p><img src="" alt="image" /></p>`,
		},
		"no image link with dimensions": {
			Markdown:     `![image]( =500x400)`,
			ExpectedHTML: `<p><img src="=500x400" alt="image" /></p>`,
		},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.ExpectedHTML, RenderHTML(tc.Markdown))
		})
	}
}
