// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// countBlocksByType tallies the concrete type of each block in a flat block chain, such as the one
// returned by blockQuoteStart/listStart/blockStart, which append each nesting level's block(s)
// directly onto the same slice as its descendants.
func countBlocksByType(blocks []Block) map[string]int {
	counts := map[string]int{}
	for _, block := range blocks {
		counts[fmt.Sprintf("%T", block)]++
	}
	return counts
}

func TestBlockStart(t *testing.T) {
	t.Run("block quote nesting is capped at maxNestingDepth", func(t *testing.T) {
		markdown := "> foo"
		blocks := blockStart(markdown, 0, Range{0, len(markdown)}, nil, nil, maxNestingDepth)
		assert.Nil(t, blocks)
	})

	t.Run("list nesting is capped at maxNestingDepth", func(t *testing.T) {
		markdown := "- foo"
		blocks := blockStart(markdown, 0, Range{0, len(markdown)}, nil, nil, maxNestingDepth)
		assert.Nil(t, blocks)
	})

	t.Run("a single line cannot recurse past maxNestingDepth nested block quotes", func(t *testing.T) {
		n := maxNestingDepth + 8
		markdown := strings.Repeat("> ", n) + "x"
		blocks := blockStart(markdown, 0, Range{0, len(markdown)}, nil, nil, 0)
		require.NotEmpty(t, blocks)

		counts := countBlocksByType(blocks)
		assert.Equal(t, maxNestingDepth, counts["*markdown.BlockQuote"])
		assert.Equal(t, 1, counts["*markdown.Paragraph"])
	})

	t.Run("a single line cannot recurse past maxNestingDepth nested list items", func(t *testing.T) {
		n := maxNestingDepth + 8
		markdown := strings.Repeat("- ", n) + "x"
		blocks := blockStart(markdown, 0, Range{0, len(markdown)}, nil, nil, 0)
		require.NotEmpty(t, blocks)

		counts := countBlocksByType(blocks)
		assert.Equal(t, maxNestingDepth, counts["*markdown.List"])
		assert.Equal(t, maxNestingDepth, counts["*markdown.ListItem"])
		assert.Equal(t, 1, counts["*markdown.Paragraph"])
	})

	t.Run("nesting already accrued by open ancestor blocks counts toward the cap", func(t *testing.T) {
		markdown := "> > > x"
		blocks := blockStart(markdown, 0, Range{0, len(markdown)}, nil, nil, maxNestingDepth-2)
		require.NotEmpty(t, blocks)

		counts := countBlocksByType(blocks)
		assert.Equal(t, 2, counts["*markdown.BlockQuote"])
		assert.Equal(t, 1, counts["*markdown.Paragraph"])
	})
}

func TestBlockStartOrParagraph(t *testing.T) {
	t.Run("falls back to a paragraph once the nesting depth is exhausted", func(t *testing.T) {
		markdown := "> foo"
		blocks := blockStartOrParagraph(markdown, 0, Range{0, len(markdown)}, nil, nil, maxNestingDepth)
		require.Len(t, blocks, 1)
		assert.IsType(t, &Paragraph{}, blocks[0])
	})
}
