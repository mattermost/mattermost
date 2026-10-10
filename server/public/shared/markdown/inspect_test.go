// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"fmt"
	"runtime"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

	t.Run("a short message containing w inspects as the original text", func(t *testing.T) {
		markdown := "hello world"
		var texts []string
		Inspect(markdown, func(blockOrInline any) bool {
			if text, ok := blockOrInline.(*Text); ok {
				texts = append(texts, text.Text)
			}
			return true
		})
		assert.Equal(t, []string{"hello world"}, texts)
	})

	t.Run("merge work stays proportional to combined text length as the number of adjacent text nodes grows", func(t *testing.T) {
		const nodeSize = 16
		measure := func(n int) uint64 {
			inlines := adjacentTextInlines(n, nodeSize)
			runtime.GC()
			var before, after runtime.MemStats
			runtime.ReadMemStats(&before)
			merged := MergeInlineText(inlines)
			runtime.ReadMemStats(&after)
			require.Len(t, merged, 1)
			text, ok := merged[0].(*Text)
			require.True(t, ok)
			require.Equal(t, n*nodeSize, len(text.Text))
			require.Equal(t, Range{Position: 0, End: n * nodeSize}, text.Range)
			return after.TotalAlloc - before.TotalAlloc
		}

		n := 1000
		costN := measure(n)
		cost2N := measure(2 * n)
		require.NotZero(t, costN)
		ratio := float64(cost2N) / float64(costN)
		assert.LessOrEqual(t, ratio, 3.0,
			"allocation growth from %d to %d adjacent text nodes: %d then %d (ratio %.2f)",
			n, 2*n, costN, cost2N, ratio)
	})

	t.Run("concurrent merges of adjacent text stay bounded relative to combined text length", func(t *testing.T) {
		const goroutines = 20
		const nodes = 1000
		const nodeSize = 16
		combinedLen := nodes * nodeSize

		inputs := make([][]Inline, goroutines)
		results := make([][]Inline, goroutines)
		for i := range inputs {
			inputs[i] = adjacentTextInlines(nodes, nodeSize)
		}

		startGoroutines := runtime.NumGoroutine()
		runtime.GC()
		var before, after runtime.MemStats
		runtime.ReadMemStats(&before)

		var wg sync.WaitGroup
		wg.Add(goroutines)
		for i := range goroutines {
			go func(i int) {
				defer wg.Done()
				results[i] = MergeInlineText(inputs[i])
			}(i)
		}
		wg.Wait()
		runtime.ReadMemStats(&after)

		// Each merge should allocate in proportion to the combined text, plus a
		// fixed allowance for per-node bookkeeping.
		perCall := (after.TotalAlloc - before.TotalAlloc) / goroutines
		limit := uint64(4*combinedLen + nodes*64)
		assert.LessOrEqual(t, perCall, limit,
			"per-call allocation %d exceeds bound %d for combined text length %d",
			perCall, limit, combinedLen)

		for range 100 {
			if runtime.NumGoroutine() <= startGoroutines+2 {
				break
			}
			runtime.Gosched()
		}
		assert.LessOrEqual(t, runtime.NumGoroutine(), startGoroutines+5)

		require.Len(t, results[0], 1)
		text, ok := results[0][0].(*Text)
		require.True(t, ok)
		assert.Equal(t, combinedLen, len(text.Text))
		assert.Equal(t, Range{Position: 0, End: combinedLen}, text.Range)
	})

	t.Run("constructed inline slices keep adjacent text together", func(t *testing.T) {
		snapshot := func(inlines []Inline) []string {
			out := make([]string, 0, len(inlines))
			for _, v := range inlines {
				switch n := v.(type) {
				case *Text:
					out = append(out, fmt.Sprintf("Text %q [%d %d]", n.Text, n.Range.Position, n.Range.End))
				case *SoftLineBreak:
					out = append(out, "SoftLineBreak")
				case *HardLineBreak:
					out = append(out, "HardLineBreak")
				default:
					out = append(out, fmt.Sprintf("%T", v))
				}
			}
			return out
		}

		for _, tc := range []struct {
			name        string
			in          []Inline
			want        []string
			sameAsInput bool
		}{
			{
				name:        "empty_input",
				in:          nil,
				want:        []string{},
				sameAsInput: true,
			},
			{
				name:        "empty_slice",
				in:          []Inline{},
				want:        []string{},
				sameAsInput: true,
			},
			{
				name:        "a_single_text_node_is_the_original_node",
				in:          []Inline{&Text{Text: "hello", Range: Range{Position: 0, End: 5}}},
				want:        []string{`Text "hello" [0 5]`},
				sameAsInput: true,
			},
			{
				name:        "an_empty_text_node_is_the_original_node",
				in:          []Inline{&Text{Text: "", Range: Range{Position: 4, End: 4}}},
				want:        []string{`Text "" [4 4]`},
				sameAsInput: true,
			},
			{
				name:        "a_slice_with_no_text_nodes_is_unchanged",
				in:          []Inline{&SoftLineBreak{}, &HardLineBreak{}},
				want:        []string{"SoftLineBreak", "HardLineBreak"},
				sameAsInput: true,
			},
			{
				name: "text_nodes_separated_by_a_range_gap_stay_separate",
				in: []Inline{
					&Text{Text: "hello", Range: Range{Position: 0, End: 5}},
					&Text{Text: "world", Range: Range{Position: 8, End: 13}},
				},
				want:        []string{`Text "hello" [0 5]`, `Text "world" [8 13]`},
				sameAsInput: true,
			},
			{
				name: "text_nodes_with_overlapping_ranges_stay_separate",
				in: []Inline{
					&Text{Text: "hello", Range: Range{Position: 0, End: 5}},
					&Text{Text: "llow", Range: Range{Position: 3, End: 7}},
				},
				want:        []string{`Text "hello" [0 5]`, `Text "llow" [3 7]`},
				sameAsInput: true,
			},
			{
				name: "a_non_text_node_ends_an_adjacent_run",
				in: []Inline{
					&Text{Text: "hello", Range: Range{Position: 0, End: 5}},
					&SoftLineBreak{},
					&Text{Text: "world", Range: Range{Position: 5, End: 10}},
				},
				want:        []string{`Text "hello" [0 5]`, "SoftLineBreak", `Text "world" [5 10]`},
				sameAsInput: true,
			},
			{
				name: "a_merged_node_range_ends_at_the_last_text_node",
				in: []Inline{
					&Text{Text: "ab", Range: Range{Position: 2, End: 4}},
					&Text{Text: "cde", Range: Range{Position: 4, End: 7}},
					&Text{Text: "fg", Range: Range{Position: 7, End: 9}},
				},
				want: []string{`Text "abcdefg" [2 9]`},
			},
			{
				name: "zero_length_text_nodes_join_an_adjacent_run",
				in: []Inline{
					&Text{Text: "hello", Range: Range{Position: 0, End: 5}},
					&Text{Text: "", Range: Range{Position: 5, End: 5}},
					&Text{Text: "world", Range: Range{Position: 5, End: 10}},
				},
				want: []string{`Text "helloworld" [0 10]`},
			},
			{
				name: "unicode_text_nodes_join_on_matching_ranges",
				in: []Inline{
					&Text{Text: "héllo", Range: Range{Position: 0, End: 6}},
					&Text{Text: "wørld", Range: Range{Position: 6, End: 12}},
				},
				want: []string{`Text "héllowørld" [0 12]`},
			},
			{
				name: "adjacent_runs_on_both_sides_of_a_non_text_node",
				in: []Inline{
					&Text{Text: "aa", Range: Range{Position: 0, End: 2}},
					&Text{Text: "bb", Range: Range{Position: 2, End: 4}},
					&SoftLineBreak{},
					&Text{Text: "cc", Range: Range{Position: 4, End: 6}},
					&Text{Text: "dd", Range: Range{Position: 6, End: 8}},
				},
				want: []string{`Text "aabb" [0 4]`, "SoftLineBreak", `Text "ccdd" [4 8]`},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				originals := make([]Inline, len(tc.in))
				copy(originals, tc.in)

				got := MergeInlineText(tc.in)
				assert.Equal(t, tc.want, snapshot(got))

				if tc.sameAsInput {
					require.Len(t, got, len(originals))
					for i := range got {
						assert.Same(t, originals[i], got[i])
					}
				}
			})
		}
	})
}

func adjacentTextInlines(count, size int) []Inline {
	chunk := strings.Repeat("a", size)
	inlines := make([]Inline, count)
	pos := 0
	for i := range count {
		inlines[i] = &Text{
			Text:  chunk,
			Range: Range{Position: pos, End: pos + size},
		}
		pos += size
	}
	return inlines
}

var counterSink int

func BenchmarkInspect(b *testing.B) {
	text := `Some standard piece of text.

Has a link [post](https://github.com) and also has a blockquote.

> This is a famous quote.

Some bold text **Text for markdown?** to go with it.

At the end, some more lines`

	for b.Loop() {
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
