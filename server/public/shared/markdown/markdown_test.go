// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"runtime"
	"strconv"
	"strings"
	"testing"

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

	// Doubling the number of reference uses and definitions doubles the document, so parse work
	// proportional to the document roughly doubles with it, while work that pairs every use with
	// every definition, or rebuilds the rest of a paragraph once per definition, roughly
	// quadruples. The bound sits between the two.
	const maxGrowth = 3.0

	t.Run("resolving reference labels costs allocations proportional to the document", func(t *testing.T) {
		// Scanning every definition for each use allocates per definition scanned, which shows up
		// in the allocation count. The bytes allocated are not measured here: a paragraph's inline
		// buffer grows with its lines, which lets them outgrow the document on its own.
		for _, tc := range []struct {
			name     string
			document func(n int) string
		}{
			{
				name: "uses in one paragraph, matching no definition",
				document: func(n int) string {
					return referenceUses(n, "no", "\n") + "\n" + referenceDefinitions(n, "", " ", "\n")
				},
			},
			{
				name: "uses in one paragraph, each matching a definition",
				document: func(n int) string {
					return referenceUses(n, "", "\n") + "\n" + referenceDefinitions(n, "", " ", "\n")
				},
			},
			{
				name: "uses spread one per paragraph, matching no definition",
				document: func(n int) string {
					return referenceUses(n, "no", "\n\n") + referenceDefinitions(n, "", " ", "\n")
				},
			},
			{
				name: "uses on one line, each matching a definition",
				document: func(n int) string {
					return referenceUses(n, "", " ") + "\n\n" + referenceDefinitions(n, "", " ", "\n")
				},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				small, large := tc.document(1000), tc.document(2000)
				require.LessOrEqual(t, len(large), MaxLen())

				smallCount, _ := parseAllocations(small)
				largeCount, _ := parseAllocations(large)
				growth := float64(largeCount) / float64(smallCount)
				assert.LessOrEqualf(t, growth, maxGrowth, "allocation count grew %.2fx (%d to %d)", growth, smallCount, largeCount)
			})
		}
	})

	t.Run("reading reference definitions allocates bytes proportional to the document", func(t *testing.T) {
		// Rebuilding the rest of a paragraph for each definition allocates one copy per
		// definition, so it shows up in the bytes allocated rather than in the allocation count.
		for _, tc := range []struct {
			name     string
			document func(n int) string
			n        int
		}{
			{
				name: "definitions stacked in one paragraph, with no uses",
				document: func(n int) string {
					return referenceDefinitions(n, "", " ", "\n")
				},
				n: 2000,
			},
			{
				name: "one definition repeated in one paragraph, with no uses",
				document: func(n int) string {
					return strings.Repeat("[a]: b\n", n)
				},
				n: 2000,
			},
			{
				// Definitions a container block holds reach the document the same way top level
				// ones do, and a definition continued on a second line covers two of a
				// paragraph's line ranges rather than one.
				name: "definitions continued on a second line inside a block quote, uses on one line",
				document: func(n int) string {
					return referenceDefinitions(n, "> ", "\n> ", "\n") + "\n" + referenceUses(n, "", " ")
				},
				n: 700,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				small, large := tc.document(tc.n), tc.document(2*tc.n)
				require.LessOrEqual(t, len(large), MaxLen())

				_, smallBytes := parseAllocations(small)
				_, largeBytes := parseAllocations(large)
				growth := float64(largeBytes) / float64(smallBytes)
				assert.LessOrEqualf(t, growth, maxGrowth, "bytes allocated grew %.2fx (%d to %d)", growth, smallBytes, largeBytes)
			})
		}
	})

	t.Run("a short list of reference definitions keeps each label, destination and title", func(t *testing.T) {
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
				_, definitions := Parse(tc.markdown)
				require.Len(t, definitions, 3)

				assert.Equal(t, "foo", definitions[0].Label())
				assert.Equal(t, "/url", definitions[0].Destination())
				assert.Equal(t, "title", definitions[0].Title())

				assert.Equal(t, "bar", definitions[1].Label())
				assert.Equal(t, "/dest", definitions[1].Destination())
				assert.Equal(t, "other", definitions[1].Title())

				assert.Equal(t, "baz", definitions[2].Label())
				assert.Equal(t, "/path", definitions[2].Destination())
				assert.Empty(t, definitions[2].Title())
			})
		}
	})

	t.Run("text after a run of reference definitions keeps its ranges", func(t *testing.T) {
		document, definitions := Parse("[foo]: /foo\n[bar]: /bar\nremaining text")
		require.Len(t, definitions, 2)
		assert.Equal(t, "/foo", definitions[0].Destination())
		assert.Equal(t, "/bar", definitions[1].Destination())

		require.Len(t, document.Children, 1)
		paragraph, ok := document.Children[0].(*Paragraph)
		require.True(t, ok)
		require.Equal(t, []Range{{Position: 24, End: 38}}, paragraph.Text)
		assert.Equal(t, "remaining text", paragraph.markdown[paragraph.Text[0].Position:paragraph.Text[0].End])
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
}
