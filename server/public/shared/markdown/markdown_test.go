// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"runtime"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// referenceUses returns n reference links of the form "[x][<labelPrefix><i>]", each followed by
// separator. A separator of " " puts every use on one line, "\n" keeps them in a single paragraph
// spread over one line each, and "\n\n" gives each use a paragraph of its own.
func referenceUses(n int, labelPrefix, separator string) string {
	var sb strings.Builder
	for i := range n {
		sb.WriteString("[x][" + labelPrefix + strconv.Itoa(i) + "]" + separator)
	}
	return sb.String()
}

// referenceDefinitions returns n reference definitions of the form
// "<linePrefix>[<i>]:<afterLabel>http://a/<i>", each followed by separator. A separator of "\n"
// stacks every definition into a single paragraph, while "\n\n" gives each definition a paragraph
// of its own. A linePrefix of "> " puts them inside a block quote, and an afterLabel of "\n> "
// continues each definition onto a second line of that block quote.
func referenceDefinitions(n int, linePrefix, afterLabel, separator string) string {
	var sb strings.Builder
	for i := range n {
		s := strconv.Itoa(i)
		sb.WriteString(linePrefix + "[" + s + "]:" + afterLabel + "http://a/" + s + separator)
	}
	return sb.String()
}

// parseAllocations reports how many allocations a single parse of markdown makes and how many
// bytes those allocations total. Both runtime.MemStats fields are cumulative, so the deltas do
// not depend on when the garbage collector happens to run, which makes them far steadier than
// wall clock as a measure of how much work a parse does.
func parseAllocations(markdown string) (count, bytes uint64) {
	runtime.GC()

	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	Inspect(markdown, func(any) bool { return true })
	runtime.ReadMemStats(&after)

	return after.Mallocs - before.Mallocs, after.TotalAlloc - before.TotalAlloc
}

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

	t.Run("parse cost stays proportional to document size as reference definitions and uses grow", func(t *testing.T) {
		// Doubling the number of reference uses and definitions doubles the document, so parse
		// work that is proportional to the document roughly doubles with it. Work that pairs
		// every use with every definition, or that rebuilds the remainder of a paragraph once
		// per definition it holds, roughly quadruples instead. The bound below sits between the
		// two, so it says "cost follows the document" without pinning an exact constant.
		const maxGrowth = 3.0

		for _, tc := range []struct {
			name     string
			document func(n int) string
			n        int
			// cost picks the runtime.MemStats delta that tracks this shape. Resolving a label
			// allocates once per definition scanned, so it shows up in the allocation count;
			// re-reading a paragraph allocates a copy of the remaining text, so it shows up in
			// the bytes allocated rather than in the count. A paragraph's inline buffer and its
			// merged runs of adjacent text both grow with the lines in that paragraph, so shapes
			// that spread uses over many lines are measured by count, where those two do not
			// appear, and shapes that keep them on one line by bytes, where both parts of
			// resolving a reference do.
			cost     func(count, bytes uint64) uint64
			costName string
		}{
			{
				name: "uses in one paragraph, matching no definition",
				document: func(n int) string {
					return referenceUses(n, "no", "\n") + "\n" + referenceDefinitions(n, "", " ", "\n")
				},
				n:        1000,
				cost:     func(count, _ uint64) uint64 { return count },
				costName: "allocation count",
			},
			{
				name: "uses in one paragraph, each matching a definition",
				document: func(n int) string {
					return referenceUses(n, "", "\n") + "\n" + referenceDefinitions(n, "", " ", "\n")
				},
				n:        1000,
				cost:     func(count, _ uint64) uint64 { return count },
				costName: "allocation count",
			},
			{
				name: "uses spread one per paragraph, matching no definition",
				document: func(n int) string {
					return referenceUses(n, "no", "\n\n") + referenceDefinitions(n, "", " ", "\n")
				},
				n:        1000,
				cost:     func(count, _ uint64) uint64 { return count },
				costName: "allocation count",
			},
			{
				name: "uses on one line, each matching a definition",
				document: func(n int) string {
					return referenceUses(n, "", " ") + "\n\n" + referenceDefinitions(n, "", " ", "\n")
				},
				n:        1000,
				cost:     func(_, bytes uint64) uint64 { return bytes },
				costName: "bytes allocated",
			},
			{
				name: "definitions stacked in one paragraph, with no uses",
				document: func(n int) string {
					return referenceDefinitions(n, "", " ", "\n")
				},
				n:        2000,
				cost:     func(_, bytes uint64) uint64 { return bytes },
				costName: "bytes allocated",
			},
			{
				// Definitions a container block holds reach the document the same way top level
				// ones do, and a definition continued on a second line covers two of a
				// paragraph's line ranges rather than one.
				name: "definitions continued on a second line inside a block quote, uses on one line",
				document: func(n int) string {
					return referenceDefinitions(n, "> ", "\n> ", "\n") + "\n" + referenceUses(n, "", " ")
				},
				n:        700,
				cost:     func(_, bytes uint64) uint64 { return bytes },
				costName: "bytes allocated",
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				small := tc.document(tc.n)
				large := tc.document(2 * tc.n)
				// Parse and Inspect skip anything longer than MaxLen without looking at it, which
				// would make both measurements trivially equal.
				require.LessOrEqual(t, len(large), MaxLen())

				smallCost := tc.cost(parseAllocations(small))
				largeCost := tc.cost(parseAllocations(large))
				growth := float64(largeCost) / float64(smallCost)

				assert.LessOrEqualf(t, growth, maxGrowth,
					"%s grew %.2fx (%d to %d) while the document grew %.2fx (%d to %d bytes)",
					tc.costName, growth, smallCost, largeCost,
					float64(len(large))/float64(len(small)), len(small), len(large))
			})
		}
	})

	t.Run("parsing one document many times over completes in bounded time", func(t *testing.T) {
		if testing.Short() {
			t.Skip("wall-clock bound is not meaningful in short mode")
		}

		n := 3000
		markdown := referenceUses(n, "no", "\n\n") + referenceDefinitions(n, "", " ", "\n\n")
		require.LessOrEqual(t, len(markdown), MaxLen())

		// Parses are independent, so the time for the whole batch follows the total work rather
		// than the cost of any single parse. Running several parses per available thread keeps
		// that total the same whatever the machine's parallelism is.
		parses := max(20, 4*runtime.GOMAXPROCS(0))

		start := time.Now()

		var wg sync.WaitGroup
		for range parses {
			wg.Go(func() {
				Inspect(markdown, func(any) bool { return true })
			})
		}
		wg.Wait()

		// The race detector and loaded shared runners can push linear work past one second even
		// when the allocation-growth tests already show the cost follows document size.
		if raceDetector {
			return
		}

		elapsed := time.Since(start)
		assert.Lessf(t, elapsed, time.Second,
			"%d concurrent parses of a %d byte document took %v", parses, len(markdown), elapsed)
	})

	t.Run("reference links resolve against the definition their label names", func(t *testing.T) {
		for _, tc := range []struct {
			name         string
			markdown     string
			expectedHTML string
		}{
			{
				name:         "a label matches a definition regardless of ASCII case",
				markdown:     "[text][FoO]\n\n[fOo]: http://a/1",
				expectedHTML: `<p><a href="http://a/1">text</a></p>`,
			},
			{
				name:         "runs of spaces inside a label collapse to one",
				markdown:     "[text][a  b]\n\n[a b]: http://a/1",
				expectedHTML: `<p><a href="http://a/1">text</a></p>`,
			},
			{
				name:         "a line break inside a label counts as a space",
				markdown:     "[text][a\nb]\n\n[a b]: http://a/1",
				expectedHTML: `<p><a href="http://a/1">text</a></p>`,
			},
			{
				// A label of only whitespace and an empty label collapse to the same thing.
				name:         "a label of only whitespace matches a definition whose label is empty",
				markdown:     "[text][ ]\n\n[]: http://a/1",
				expectedHTML: `<p><a href="http://a/1">text</a></p>`,
			},
			{
				// U+0131 and "i" are not case equivalent under Unicode simple case folding,
				// even though upper casing the first and lower casing the result gives "i".
				name:         "a label that differs by more than a case fold stays plain text",
				markdown:     "[text][\u0131]\n\n[i]: http://a/1",
				expectedHTML: "<p>[text][\u0131]</p>",
			},
			{
				name:         "a label holding bytes that are not valid UTF-8 matches regardless of ASCII case",
				markdown:     "[text][a\xffb]\n\n[A\xffB]: http://a/1",
				expectedHTML: `<p><a href="http://a/1">text</a></p>`,
			},
			{
				name:         "a label no definition names stays plain text",
				markdown:     "[text][missing]\n\n[other]: http://a/1",
				expectedHTML: "<p>[text][missing]</p>",
			},
			{
				name:         "the first of two definitions sharing a label wins",
				markdown:     "[text][foo]\n\n[foo]: http://a/1\n[foo]: http://a/2",
				expectedHTML: `<p><a href="http://a/1">text</a></p>`,
			},
			{
				name:         "a definition a block quote holds names a use outside it",
				markdown:     "> [foo]: http://a/1\n\n[text][foo]",
				expectedHTML: `<blockquote></blockquote><p><a href="http://a/1">text</a></p>`,
			},
			{
				// A definition continued on a second line covers two of a paragraph's line
				// ranges, so how much of the paragraph it leaves behind decides where reading
				// the next definition starts.
				name:         "a definition continued on a second line does not shift the one after it",
				markdown:     "[a]:\nhttp://a/1\n[b]: http://a/2\n\n[text][a] [text][b]",
				expectedHTML: `<p><a href="http://a/1">text</a> <a href="http://a/2">text</a></p>`,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				assert.Equal(t, tc.expectedHTML, RenderHTML(tc.markdown))
			})
		}
	})

	t.Run("reference links resolve against exactly the definitions they are given", func(t *testing.T) {
		_, first := Parse("x\n\n[one]: http://a/1\n[two]: http://a/2")
		_, second := Parse("x\n\n[three]: http://b/3\n[four]: http://b/4")
		require.Len(t, first, 2)
		require.Len(t, second, 2)

		// A slice a caller assembles this way shares both its length and its first element with
		// the definitions of the first document, and holds neither of that document's others.
		assembled := []*ReferenceDefinition{first[0], second[1]}

		document, _ := Parse("[text][one] [text][two] [text][four]")
		assert.Equal(t,
			`<p><a href="http://a/1">text</a> [text][two] <a href="http://b/4">text</a></p>`,
			RenderBlockHTML(document, assembled))
	})

	t.Run("definitions from one parse resolve the same way from many goroutines", func(t *testing.T) {
		n := 200
		markdown := referenceUses(n, "", " ") + "\n\n" + referenceDefinitions(n, "", " ", "\n")

		// The expectation comes from its own parse, so that the renders below are the first
		// thing to resolve a label against the definitions they are given.
		expectedDocument, expectedDefinitions := Parse(markdown)
		expected := RenderBlockHTML(expectedDocument, expectedDefinitions)
		require.Equal(t, n, strings.Count(expected, "<a href="))

		document, definitions := Parse(markdown)
		require.Len(t, definitions, n)

		results := make([]string, max(8, runtime.GOMAXPROCS(0)))
		var wg sync.WaitGroup
		for i := range results {
			wg.Go(func() {
				results[i] = RenderBlockHTML(document, definitions)
			})
		}
		wg.Wait()

		for _, result := range results {
			assert.Equal(t, expected, result)
		}
	})
}
