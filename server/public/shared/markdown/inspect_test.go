// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestInspect(t *testing.T) {
	t.Run("base", func(t *testing.T) {
		markdown := `
[foo]: bar
- a
  > [![]()]()
  > [![foo]][foo]
- d
`

		visited := []string{}
		level := 0
		Inspect(markdown, func(blockOrInline any) bool {
			if blockOrInline == nil {
				level--
			} else {
				visited = append(visited, strings.Repeat(" ", level*4)+strings.TrimPrefix(fmt.Sprintf("%T", blockOrInline), "*markdown."))
				level++
			}
			return true
		})

		assert.Equal(t, []string{
			"Document",
			"    Paragraph",
			"    List",
			"        ListItem",
			"            Paragraph",
			"                Text",
			"            BlockQuote",
			"                Paragraph",
			"                    InlineLink",
			"                        InlineImage",
			"                    SoftLineBreak",
			"                    ReferenceLink",
			"                        ReferenceImage",
			"                            Text",
			"        ListItem",
			"            Paragraph",
			"                Text",
		}, visited)
	})

	t.Run("visit nodes when len is smaller than maxLen", func(t *testing.T) {
		n := MaxLen() / 5
		markdown := strings.Repeat(`![`, n) + strings.Repeat(`]()`, n)

		visited := []string{}
		level := 0
		Inspect(markdown, func(blockOrInline any) bool {
			if blockOrInline == nil {
				level--
			} else {
				visited = append(visited, strings.Repeat(" ", level*4)+strings.TrimPrefix(fmt.Sprintf("%T", blockOrInline), "*markdown."))
				level++
			}
			return true
		})

		assert.NotEmpty(t, visited)
	})

	t.Run("do not visit any nodes when len is greater than maxLen", func(t *testing.T) {
		n := (MaxLen() / 5) + 1
		markdown := strings.Repeat(`![`, n) + strings.Repeat(`]()`, n)

		visited := []string{}
		level := 0
		Inspect(markdown, func(blockOrInline any) bool {
			if blockOrInline == nil {
				level--
			} else {
				visited = append(visited, strings.Repeat(" ", level*4)+strings.TrimPrefix(fmt.Sprintf("%T", blockOrInline), "*markdown."))
				level++
			}
			return true
		})

		assert.Empty(t, visited)
	})

	t.Run("a deeply nested single-line block quote is bounded rather than fully descended", func(t *testing.T) {
		n := 20000
		markdown := strings.Repeat("> ", n) + "x"

		blockQuoteCount := 0
		Inspect(markdown, func(blockOrInline any) bool {
			if _, ok := blockOrInline.(*BlockQuote); ok {
				blockQuoteCount++
			}
			return true
		})

		assert.Equal(t, maxNestingDepth-1, blockQuoteCount)
	})

	t.Run("a deeply nested single-line list is bounded rather than fully descended", func(t *testing.T) {
		n := 20000
		markdown := strings.Repeat("- ", n) + "x"

		listCount := 0
		Inspect(markdown, func(blockOrInline any) bool {
			if _, ok := blockOrInline.(*List); ok {
				listCount++
			}
			return true
		})

		assert.Equal(t, maxNestingDepth-1, listCount)
	})
}

var counterSink int

func BenchmarkInspect(b *testing.B) {
	text := `Some standard piece of text.

Has a link [post](https://github.com) and also has a blockquote.

> This is a famous quote.

Some bold text **Text for markdown?** to go with it.

At the end, some more lines`

	for i := 0; i < b.N; i++ {
		Inspect(text, func(_ any) bool {
			counterSink++
			return true
		})
	}
}

// BenchmarkInspectNestedBlockQuote and BenchmarkInspectNestedList measure the cost of parsing a
// single line made up of repeated block-quote/list markers. These benchmarks should scale roughly
// linearly with input size (i.e. per-op time should stay flat as the marker count grows), since the
// number of nested blocks actually created is capped at maxNestingDepth regardless of input size.
func BenchmarkInspectNestedBlockQuote(b *testing.B) {
	for _, n := range []int{1_000, 10_000, 60_000} {
		markdown := strings.Repeat("> ", n) + "x"
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			for b.Loop() {
				Inspect(markdown, func(_ any) bool {
					counterSink++
					return true
				})
			}
		})
	}
}

func BenchmarkInspectNestedList(b *testing.B) {
	for _, n := range []int{1_000, 10_000, 60_000} {
		markdown := strings.Repeat("- ", n) + "x"
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			for b.Loop() {
				Inspect(markdown, func(_ any) bool {
					counterSink++
					return true
				})
			}
		})
	}
}
