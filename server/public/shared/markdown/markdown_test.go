// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParse(t *testing.T) {
	t.Run("rejects input longer than maxLen bytes without parsing it", func(t *testing.T) {
		markdown := strings.Repeat("a", MaxLen()+1)
		document, referenceDefinitions := Parse(markdown)
		assert.Empty(t, document.Children)
		assert.Empty(t, referenceDefinitions)
	})

	t.Run("SetMaxPostSize raises the cap so a previously rejected input is parsed", func(t *testing.T) {
		defer SetMaxPostRunes(defaultMaxPostRunes)

		SetMaxPostRunes(defaultMaxPostRunes)
		markdown := strings.Repeat("a", MaxLen()+1)

		document, _ := Parse(markdown)
		assert.Empty(t, document.Children)

		SetMaxPostRunes(defaultMaxPostRunes + 1)

		document, _ = Parse(markdown)
		assert.NotEmpty(t, document.Children)
	})

	t.Run("nesting depth is bounded regardless of how deeply a single line nests", func(t *testing.T) {
		// Without the depth cap in blockStart/blockQuoteStart/listStart, this would force parse
		// work that grows with the nesting depth rather than staying bounded.
		n := 20000
		markdown := strings.Repeat("> ", n) + "x"

		document, _ := Parse(markdown)
		require.Len(t, document.Children, 1)

		depth := 0
		block := document.Children[0]
		for {
			blockQuote, ok := block.(*BlockQuote)
			if !ok {
				break
			}
			depth++
			require.NotEmpty(t, blockQuote.Children)
			block = blockQuote.Children[0]
		}
		// ParseBlocks counts the Document itself as the first ancestor, so a full parse tops out
		// one level below the maxNestingDepth threshold used by the block-start functions directly.
		assert.Equal(t, maxNestingDepth-1, depth)
	})
}
