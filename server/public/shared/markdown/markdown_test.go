// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

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
		SetMaxPostRunes(defaultMaxPostRunes)
		defer SetMaxPostRunes(defaultMaxPostRunes)

		markdown := strings.Repeat("a", MaxLen()+1)

		document, _ := Parse(markdown)
		assert.Empty(t, document.Children)

		SetMaxPostRunes(defaultMaxPostRunes + 1)

		document, _ = Parse(markdown)
		assert.NotEmpty(t, document.Children)

		SetMaxPostRunes(defaultMaxPostRunes)
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

	t.Run("a short list of reference definitions is kept", func(t *testing.T) {
		// CommonMark cases 0.28-gfm-159 through 0.28-gfm-181 already cover reference-definition
		// rendering. This checks that Parse itself keeps Destination, Label, and Title for a
		// short list of definitions, including CRLF line endings and a final line with no newline.
		for _, tc := range []struct {
			name     string
			markdown string
		}{
			{
				name:     "LF line endings",
				markdown: "[foo]: /url \"title\"\n[bar]: /dest 'other'\n[baz]: /path\n",
			},
			{
				name:     "CRLF line endings",
				markdown: "[foo]: /url \"title\"\r\n[bar]: /dest 'other'\r\n[baz]: /path\r\n",
			},
			{
				name:     "last line without a newline",
				markdown: "[foo]: /url \"title\"\n[bar]: /dest 'other'\n[baz]: /path",
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				_, defs := Parse(tc.markdown)
				require.Len(t, defs, 3)

				assert.Equal(t, "foo", defs[0].Label())
				assert.Equal(t, "/url", defs[0].Destination())
				assert.Equal(t, "title", defs[0].Title())

				assert.Equal(t, "bar", defs[1].Label())
				assert.Equal(t, "/dest", defs[1].Destination())
				assert.Equal(t, "other", defs[1].Title())

				assert.Equal(t, "baz", defs[2].Label())
				assert.Equal(t, "/path", defs[2].Destination())
				assert.Equal(t, "", defs[2].Title())
			})
		}
	})

	t.Run("reference definition parse cost stays linear as the paragraph grows", func(t *testing.T) {
		// A document of N reference definitions and one of 2N keep TotalAlloc within a 3x ratio,
		// and both parses still return one definition per source line.
		const n = 1000
		defsN, allocN := parseAlloc(strings.Repeat("[a]: b\n", n))
		defs2N, alloc2N := parseAlloc(strings.Repeat("[a]: b\n", 2*n))
		require.Equal(t, n, defsN)
		require.Equal(t, 2*n, defs2N)
		require.NotZero(t, allocN)

		ratio := float64(alloc2N) / float64(allocN)
		assert.LessOrEqual(t, ratio, 3.0, "TotalAlloc %d -> %d (ratio %.2f)", allocN, alloc2N, ratio)
	})

	t.Run("reference definition parse finishes promptly for a long list", func(t *testing.T) {
		t.Run("a single parse", func(t *testing.T) {
			// A single Parse of a long list of reference definitions finishes within a bounded time
			// and still returns one definition per source line.
			const n = 2000
			markdown := strings.Repeat("[a]: b\n", n)

			start := time.Now()
			_, defs := Parse(markdown)
			elapsed := time.Since(start)

			require.Len(t, defs, n)
			assert.Less(t, elapsed, 15*time.Millisecond, "Parse(%d definitions) took %s", n, elapsed)
		})

		t.Run("concurrent parses", func(t *testing.T) {
			// Concurrent Parse calls of the same reference-definition document keep a bounded
			// allocation total and each call still returns one definition per source line.
			const n = 1000
			nCalls := 20
			if p := 4 * runtime.GOMAXPROCS(0); p > nCalls {
				nCalls = p
			}
			markdown := strings.Repeat("[a]: b\n", n)

			runtime.GC()
			var before, after runtime.MemStats
			runtime.ReadMemStats(&before)

			var wg sync.WaitGroup
			counts := make([]int, nCalls)
			wg.Add(nCalls)
			for i := 0; i < nCalls; i++ {
				go func(i int) {
					defer wg.Done()
					_, defs := Parse(markdown)
					counts[i] = len(defs)
				}(i)
			}
			wg.Wait()

			runtime.ReadMemStats(&after)
			alloc := after.TotalAlloc - before.TotalAlloc

			for i, got := range counts {
				require.Equal(t, n, got, "call %d", i)
			}
			const maxAllocPerCall = 16 * 1024 * 1024
			assert.LessOrEqual(t, alloc, uint64(nCalls)*maxAllocPerCall, "TotalAlloc %d over %d calls", alloc, nCalls)
		})
	})
}

func parseAlloc(markdown string) (nDefs int, totalAlloc uint64) {
	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	_, defs := Parse(markdown)
	runtime.ReadMemStats(&after)
	return len(defs), after.TotalAlloc - before.TotalAlloc
}
