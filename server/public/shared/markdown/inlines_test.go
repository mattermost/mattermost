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

// parseAllInlines parses every paragraph's inlines.
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

// BenchmarkInlineParsing measures inputs that once took time quadratic in their length. MB/s stays
// about the same across sizes when parsing is linear, and falls in proportion to n when it is not.
func BenchmarkInlineParsing(b *testing.B) {
	SetMaxPostRunes(262144)
	b.Cleanup(func() { SetMaxPostRunes(defaultMaxPostRunes) })

	for _, shape := range []struct {
		name  string
		build func(n int) string
	}{
		// MM-71267: autolink candidates after a completed link above many inactive link openers.
		{"autolink candidates above inactive link openers", func(n int) string {
			return strings.Repeat("[", n) + "[a](b)" + strings.Repeat("w", n)
		}},
		// MM-71267: image openers are never deactivated, so they must not be walked either.
		{"autolink candidates above image openers", func(n int) string {
			return strings.Repeat("![", n) + strings.Repeat("[", n) + "[a](b)" + strings.Repeat("w", n)
		}},
		// MM-71267: each completed link deactivates the link openers below it.
		{"completed links above many link openers", func(n int) string {
			return strings.Repeat("[`a`", n) + strings.Repeat("[a](b)", n)
		}},
		// MM-71267: image openers sit between the link openers a completed link deactivates.
		{"completed links above many image openers", func(n int) string {
			return strings.Repeat("![`a`", n) + strings.Repeat("[a](b)", n)
		}},
		// MM-71268: link destinations without a closing parenthesis.
		{"unterminated link destinations", func(n int) string {
			return strings.Repeat("[a](", n) + strings.Repeat("x", 4*n)
		}},
		// MM-71268: angle bracket destinations fall back to the same scan.
		{"unterminated angle bracket destinations", func(n int) string {
			return strings.Repeat("[a](<", n) + strings.Repeat("x", 4*n)
		}},
		// MM-71268: parenthesized titles without a closing parenthesis.
		{"unterminated parenthesized titles", func(n int) string {
			return strings.Repeat("[`a`](x (", n)
		}},
		// MM-71268: whitespace after a shared destination that never reaches a closing parenthesis.
		{"whitespace after a shared destination", func(n int) string {
			return strings.Repeat("[a](", n) + "x" + strings.Repeat(" ", 4*n) + "y"
		}},
		// MM-71268: the same, for image openers, which also look for dimensions.
		{"whitespace after a shared image destination", func(n int) string {
			return strings.Repeat("![a](", n) + "x" + strings.Repeat(" ", 4*n) + "y"
		}},
		// MM-71268: a shared title that is not followed by a closing parenthesis.
		{"whitespace after a shared title", func(n int) string {
			return strings.Repeat("[`a`](x (", n) + ")" + strings.Repeat(" ", 4*n) + "y"
		}},
		// MM-71322: character references without a nearby semicolon.
		{"ampersands before a distant semicolon", func(n int) string {
			return strings.Repeat("&", 4*n) + ";"
		}},
	} {
		for _, n := range []int{1_000, 4_000, 16_000} {
			markdown := shape.build(n)
			b.Run(fmt.Sprintf("%s/n=%d", shape.name, n), func(b *testing.B) {
				b.SetBytes(int64(len(markdown)))
				for b.Loop() {
					Inspect(markdown, func(_ any) bool {
						counterSink++
						return true
					})
				}
			})
		}
	}
}

// BenchmarkUnescape measures character references without a nearby semicolon (MM-71322).
func BenchmarkUnescape(b *testing.B) {
	for _, n := range []int{1_000, 4_000, 16_000} {
		markdown := strings.Repeat("&", 4*n) + ";"
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			b.SetBytes(int64(len(markdown)))
			for b.Loop() {
				Unescape(markdown)
			}
		})
	}
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

func TestLinkDestinationNesting(t *testing.T) {
	nested := func(depth int) string {
		return "[a](" + strings.Repeat("(", depth) + "b" + strings.Repeat(")", depth) + ")"
	}

	for _, tc := range []struct {
		name     string
		markdown string
		expected string
	}{
		{"deepest allowed", nested(maxLinkDestinationNesting), `<p><a href="` + nested(maxLinkDestinationNesting)[4:len(nested(maxLinkDestinationNesting))-1] + `">a</a></p>`},
		{"too deep", nested(maxLinkDestinationNesting + 1), "<p>" + nested(maxLinkDestinationNesting+1) + "</p>"},
		{"escaped parentheses do not nest", "[a](" + strings.Repeat(`\(`, maxLinkDestinationNesting+1) + ")", `<p><a href="` + strings.Repeat("(", maxLinkDestinationNesting+1) + `">a</a></p>`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, RenderHTML(tc.markdown))
		})
	}
}

func TestParenthesizedLinkTitles(t *testing.T) {
	for _, tc := range []struct {
		name     string
		markdown string
		expected string
	}{
		{"title", "[a](x (b))", `<p><a href="x" title="b">a</a></p>`},
		{"escaped parentheses", `[a](x (b\(c\)))`, `<p><a href="x" title="b(c)">a</a></p>`},
		{"unescaped opening parenthesis", "[a](x (b(c)))", "<p>[a](x (b(c)))</p>"},
		{"quoted title with parentheses", `[a](x "b(c")`, `<p><a href="x" title="b(c">a</a></p>`},
		{"reference definition with unescaped opening parenthesis", "[a]: x (b(c)\n\n[a]", "<p>[a]: x (b(c)</p><p>[a]</p>"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, RenderHTML(tc.markdown))
		})
	}
}
