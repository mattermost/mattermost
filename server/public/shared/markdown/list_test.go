// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListStart(t *testing.T) {
	t.Run("depth at the nesting limit is rejected even for a well-formed list item", func(t *testing.T) {
		markdown := "- foo"
		blocks := listStart(markdown, 0, Range{0, len(markdown)}, nil, nil, maxNestingDepth)
		assert.Nil(t, blocks)
	})

	t.Run("nesting from a single line is capped at maxNestingDepth", func(t *testing.T) {
		n := maxNestingDepth + 8
		markdown := strings.Repeat("- ", n) + "x"
		blocks := listStart(markdown, 0, Range{0, len(markdown)}, nil, nil, 0)
		require.NotEmpty(t, blocks)

		counts := countBlocksByType(blocks)
		assert.Equal(t, maxNestingDepth, counts["*markdown.List"])
		assert.Equal(t, maxNestingDepth, counts["*markdown.ListItem"])
		assert.Equal(t, 1, counts["*markdown.Paragraph"])
		assert.IsType(t, &Paragraph{}, blocks[len(blocks)-1])
	})

	t.Run("nesting is capped relative to the depth already accrued by open ancestor blocks", func(t *testing.T) {
		markdown := "- - - x"
		blocks := listStart(markdown, 0, Range{0, len(markdown)}, nil, nil, maxNestingDepth-2)
		require.NotEmpty(t, blocks)

		counts := countBlocksByType(blocks)
		assert.Equal(t, 2, counts["*markdown.List"])
		assert.Equal(t, 2, counts["*markdown.ListItem"])
		assert.Equal(t, 1, counts["*markdown.Paragraph"])
	})
}
