// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// parseAllInlines parses every paragraph's inlines without merging adjacent text, so the
// measured cost is the inline parser's alone.
func parseAllInlines(markdown string) []Inline {
	document, referenceDefinitions := Parse(markdown)
	var inlines []Inline
	InspectBlock(document, func(block Block) bool {
		if paragraph, ok := block.(*Paragraph); ok {
			inlines = append(inlines, paragraph.ParseInlines(referenceDefinitions)...)
		}
		return true
	})
	return inlines
}

// fastestOf returns the shortest of several runs of f, which filters out scheduling noise
// better than an average.
func fastestOf(runs int, f func()) time.Duration {
	fastest := time.Duration(-1)
	for range runs {
		start := time.Now()
		f()
		if elapsed := time.Since(start); fastest < 0 || elapsed < fastest {
			fastest = elapsed
		}
	}
	return fastest
}

// assertLinearGrowth compares the cost of an input against one four times its size. Linear work
// grows about 4x and quadratic work about 16x, so a bound of 8x separates the two with room for
// timing noise.
func assertLinearGrowth(t *testing.T, build func(n int) string, n int, run func(string)) {
	t.Helper()

	small, large := build(n), build(4*n)
	require.LessOrEqual(t, len(large), 4*262144, "input exceeds the parser cap")

	smallTime := fastestOf(5, func() { run(small) })
	largeTime := fastestOf(5, func() { run(large) })

	growth := float64(largeTime) / float64(max(smallTime, time.Microsecond))
	assert.LessOrEqualf(t, growth, 8.0,
		"parse time grew %.1fx for a 4x larger input (%d bytes in %s, %d bytes in %s)",
		growth, len(small), smallTime, len(large), largeTime)
}

func TestInlineParsingScalesLinearly(t *testing.T) {
	if testing.Short() {
		t.Skip("timing test")
	}

	SetMaxPostRunes(262144)
	t.Cleanup(func() { SetMaxPostRunes(defaultMaxPostRunes) })

	parse := func(markdown string) { parseAllInlines(markdown) }

	for name, build := range map[string]func(n int) string{
		// MM-71267: autolink candidates after a completed link above many inactive link openers.
		"autolink candidates above inactive link openers": func(n int) string {
			return strings.Repeat("[", n) + "[a](b)" + strings.Repeat("w", n)
		},
		// MM-71267: image openers are never deactivated, so they must not be walked either.
		"autolink candidates above image openers": func(n int) string {
			return strings.Repeat("![", n) + strings.Repeat("[", n) + "[a](b)" + strings.Repeat("w", n)
		},
		// MM-71267: each completed link deactivates the link openers below it.
		"completed links above many link openers": func(n int) string {
			return strings.Repeat("[`a`", n) + strings.Repeat("[a](b)", n)
		},
		// MM-71268: link destinations without a closing parenthesis.
		"unterminated link destinations": func(n int) string {
			return strings.Repeat("[a](", n) + strings.Repeat("x", 4*n)
		},
		// MM-71268: angle bracket destinations fall back to the same scan.
		"unterminated angle bracket destinations": func(n int) string {
			return strings.Repeat("[a](<", n) + strings.Repeat("x", 4*n)
		},
		// MM-71268: parenthesized titles without a closing parenthesis.
		"unterminated parenthesized titles": func(n int) string {
			return strings.Repeat("[`a`](x (", n)
		},
		// MM-71268: whitespace after a shared destination that never reaches a closing parenthesis.
		"whitespace after a shared destination": func(n int) string {
			return strings.Repeat("[a](", n) + "x" + strings.Repeat(" ", 4*n) + "y"
		},
		// MM-71268: the same, for image openers, which also look for dimensions.
		"whitespace after a shared image destination": func(n int) string {
			return strings.Repeat("![a](", n) + "x" + strings.Repeat(" ", 4*n) + "y"
		},
		// MM-71268: a shared title that is not followed by a closing parenthesis.
		"whitespace after a shared title": func(n int) string {
			return strings.Repeat("[`a`](x (", n) + ")" + strings.Repeat(" ", 4*n) + "y"
		},
		// MM-71322: character references without a nearby semicolon.
		"ampersands before a distant semicolon": func(n int) string {
			return strings.Repeat("&", 4*n) + ";"
		},
	} {
		t.Run(name, func(t *testing.T) {
			assertLinearGrowth(t, build, 8192, parse)
		})
	}

	t.Run("unescaping ampersands before a distant semicolon", func(t *testing.T) {
		assertLinearGrowth(t, func(n int) string {
			return strings.Repeat("&", 4*n) + ";"
		}, 8192, func(s string) { Unescape(s) })
	})
}

func TestMaxCharacterReferenceLength(t *testing.T) {
	for name := range htmlEntities {
		assert.LessOrEqualf(t, len(name), maxCharacterReferenceLength, "entity %q", name)
	}
	assert.GreaterOrEqual(t, maxCharacterReferenceLength, len("#x10FFFF"))
	assert.GreaterOrEqual(t, maxCharacterReferenceLength, len("#1114111"))
}

func TestCharacterReferences(t *testing.T) {
	longest := "CounterClockwiseContourIntegral"
	require.Len(t, longest, maxCharacterReferenceLength)

	for _, tc := range []struct {
		name     string
		markdown string
		expected string
	}{
		{"named", "&amp;", "&"},
		{"longest named", "&" + longest + ";", "∳"},
		{"longest named without semicolon", "&" + longest, "&" + longest},
		{"named with digits", "&frac12;", "½"},
		{"decimal", "&#35;", "#"},
		{"longest decimal", "&#00000035;", "#"},
		{"decimal too long", "&#000000035;", "&#000000035;"},
		{"hexadecimal", "&#x23;", "#"},
		{"longest hexadecimal", "&#x00000023;", "#"},
		{"hexadecimal too long", "&#x000000023;", "&#x000000023;"},
		{"empty", "&;", "&;"},
		{"empty decimal", "&#;", "&#;"},
		{"empty hexadecimal", "&#x;", "&#x;"},
		{"unknown", "&bogus;", "&bogus;"},
		{"no semicolon", "&amp", "&amp"},
		{"ampersands", "&&&;", "&&&;"},
		{"distant semicolon", "&amp" + strings.Repeat("x", maxCharacterReferenceLength) + ";", "&amp" + strings.Repeat("x", maxCharacterReferenceLength) + ";"},
		{"reference after ampersands", "&&amp;", "&&"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var text strings.Builder
			for _, inline := range MergeInlineText(parseAllInlines(tc.markdown)) {
				if v, ok := inline.(*Text); ok {
					text.WriteString(v.Text)
				}
			}
			assert.Equal(t, tc.expected, text.String())
			assert.Equal(t, tc.expected, Unescape(tc.markdown))
		})
	}
}
