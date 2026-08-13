// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// stripMarkdownTestCase defines a test case for markdown stripping functions.
type stripMarkdownTestCase struct {
	name string
	args string
	want string
}

// getStripMarkdownTestCases returns the shared test cases for StripMarkdown and StripMarkdownAndDecode.
// These test cases do not contain HTML entities that would be decoded differently by the two functions.
func getStripMarkdownTestCases() []stripMarkdownTestCase {
	return []stripMarkdownTestCase{
		{
			name: "emoji: same",
			args: "Hey :smile: :+1: :)",
			want: "Hey :smile: :+1: :)",
		},
		{
			name: "at-mention: same",
			args: "Hey @user and @test",
			want: "Hey @user and @test",
		},
		{
			name: "channel-link: same",
			args: "join ~channelname",
			want: "join ~channelname",
		},
		{
			name: "codespan: single backtick",
			args: "`single backtick`",
			want: "single backtick",
		},
		{
			name: "codespan: double backtick",
			args: "``double backtick``",
			want: "double backtick",
		},
		{
			name: "codespan: triple backtick",
			args: "```triple backtick```",
			want: "triple backtick",
		},
		{
			name: "codespan: inline code",
			args: "Inline `code` has ``double backtick`` and ```triple backtick``` around it.",
			want: "Inline code has double backtick and triple backtick around it.",
		},
		{
			name: "code block: single line code block",
			args: "Code block\n```\nline\n```",
			want: "Code block line",
		},
		{
			name: "code block: multiline code block 2",
			args: "Multiline\n```\nfunction(number) {\n  return number + 1;\n}\n```",
			want: "Multiline function(number) {\n  return number + 1;\n}",
		},
		{
			name: "code block: language highlighting",
			args: "```javascript\nvar s = \"JavaScript syntax highlighting\";\nalert(s);\n```",
			want: "var s = \"JavaScript syntax highlighting\";\nalert(s);",
		},
		{
			name: "blockquote:",
			args: "> Hey quote",
			want: "Hey quote",
		},
		{
			name: "blockquote: multiline",
			args: "> Hey quote.\n> Hello quote.",
			want: "Hey quote.\nHello quote.",
		},
		{
			name: "heading: # H1 header",
			args: "# H1 header",
			want: "H1 header",
		},
		{
			name: "heading: heading with @user",
			args: "# H1 @user",
			want: "H1 @user",
		},
		{
			name: "heading: ## H2 header",
			args: "## H2 header",
			want: "H2 header",
		},
		{
			name: "heading: ### H3 header",
			args: "### H3 header",
			want: "H3 header",
		},
		{
			name: "heading: #### H4 header",
			args: "#### H4 header",
			want: "H4 header",
		},
		{
			name: "heading: ##### H5 header",
			args: "##### H5 header",
			want: "H5 header",
		},
		{
			name: "heading: ###### H6 header",
			args: "###### H6 header",
			want: "H6 header",
		},
		{
			name: "heading: multiline with header and paragraph",
			args: "###### H6 header\nThis is next line.\nAnother line.",
			want: "H6 header This is next line.\nAnother line.",
		},
		{
			name: "heading: multiline with header and list items",
			args: "###### H6 header\n- list item 1\n- list item 2",
			want: "H6 header list item 1 list item 2",
		},
		{
			name: "heading: multiline with header and links",
			args: "###### H6 header\n[link 1](https://mattermost.com) - [link 2](https://mattermost.com)",
			want: "H6 header link 1 - link 2",
		},
		{
			name: "list: 1. First ordered list item",
			args: "1. First ordered list item",
			want: "First ordered list item",
		},
		{
			name: "list: 2. Another item",
			args: "1. 2. Another item",
			want: "Another item",
		},
		{
			name: "list: * Unordered sub-list.",
			args: "* Unordered sub-list.",
			want: "Unordered sub-list.",
		},
		{
			name: "list: - Or minuses",
			args: "- Or minuses",
			want: "Or minuses",
		},
		{
			name: "list: + Or pluses",
			args: "+ Or pluses",
			want: "Or pluses",
		},
		{
			name: "list: multiline",
			args: "1. First ordered list item\n2. Another item",
			want: "First ordered list item Another item",
		},
		{
			name: "tablerow:)",
			args: "Markdown | Less | Pretty\n" +
				"--- | --- | ---\n" +
				"*Still* | `renders` | **nicely**\n" +
				"1 | 2 | 3\n",
			want: "Markdown | Less | Pretty\n" +
				"--- | --- | ---\n" +
				"Still | renders | nicely\n" +
				"1 | 2 | 3",
		},
		{
			name: "table:",
			args: "| Tables        | Are           | Cool  |\n" +
				"| ------------- |:-------------:| -----:|\n" +
				"| col 3 is      | right-aligned | $1600 |\n" +
				"| col 2 is      | centered      |   $12 |\n" +
				"| zebra stripes | are neat      |    $1 |\n",
			want: "| Tables        | Are           | Cool  |\n" +
				"| ------------- |:-------------:| -----:|\n" +
				"| col 3 is      | right-aligned | $1600 |\n" +
				"| col 2 is      | centered      |   $12 |\n" +
				"| zebra stripes | are neat      |    $1 |",
		},
		{
			name: "strong: Bold with **asterisks** or __underscores__.",
			args: "Bold with **asterisks** or __underscores__.",
			want: "Bold with asterisks or underscores.",
		},
		{
			name: "strong & em: Bold and italics with **asterisks and _underscores_**.",
			args: "Bold and italics with **asterisks and _underscores_**.",
			want: "Bold and italics with asterisks and underscores.",
		},
		{
			name: "em: Italics with *asterisks* or _underscores_.",
			args: "Italics with *asterisks* or _underscores_.",
			want: "Italics with asterisks or underscores.",
		},
		{
			name: "del: Strikethrough ~~strike this.~~",
			args: "Strikethrough ~~strike this.~~",
			want: "Strikethrough strike this.",
		},
		{
			name: "links: [inline-style link](http://localhost:8065)",
			args: "[inline-style link](http://localhost:8065)",
			want: "inline-style link",
		},
		{
			name: "image: ![image link](http://localhost:8065/image)",
			args: "![image link](http://localhost:8065/image)",
			want: "image link",
		},
		{
			name: "text: plain",
			args: "This is plain text.",
			want: "This is plain text.",
		},
		{
			name: "text: multiline",
			args: "This is multiline text.\nHere is the next line.\n",
			want: "This is multiline text.\nHere is the next line.",
		},
		{
			name: "text: multiline with blockquote",
			args: "This is multiline text.\n> With quote",
			want: "This is multiline text. With quote",
		},
		{
			name: "text: multiline with list items",
			args: "This is multiline text.\n * List item ",
			want: "This is multiline text. List item",
		},
		{
			name: "text: &amp; entity",
			args: "you & me",
			want: "you & me",
		},
		{
			name: "text: &lt; entity",
			args: "1<2",
			want: "1<2",
		},
		{
			name: "text: &gt; entity",
			args: "2>1",
			want: "2>1",
		},
		{
			name: "text: &#39; entity",
			args: "he's out",
			want: "he's out",
		},
		{
			name: "text: &quot; entity",
			args: `That is "unique"`,
			want: `That is "unique"`,
		},
		{
			name: "text: multiple entities",
			args: "&<>'",
			want: "&<>'",
		},
		{
			name: "text: multiple entities reversed",
			args: "'><&",
			want: "'><&",
		},
		{
			name: "text: empty string",
			args: "",
			want: "",
		},
	}
}

func TestStripMarkdown(t *testing.T) {
	tests := getStripMarkdownTestCases()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := StripMarkdown(tt.args)
			if err != nil {
				t.Fatalf("error: %v", err)
			}
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestStripMarkdownAndDecode(t *testing.T) {
	// First, run the shared test cases - StripMarkdownAndDecode should produce the same
	// results as StripMarkdown for inputs without HTML entities
	t.Run("shared test cases", func(t *testing.T) {
		tests := getStripMarkdownTestCases()
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := StripMarkdownAndDecode(tt.args)
				if err != nil {
					t.Fatalf("error: %v", err)
				}
				assert.Equal(t, tt.want, got)
			})
		}
	})

	// Additional test cases specific to HTML entity decoding
	t.Run("HTML entity decoding", func(t *testing.T) {
		entityTests := []stripMarkdownTestCase{
			// Named HTML entities
			{
				name: "named entity: &lt;",
				args: "1 &lt; 2",
				want: "1 < 2",
			},
			{
				name: "named entity: &gt;",
				args: "2 &gt; 1",
				want: "2 > 1",
			},
			{
				name: "named entity: &amp;",
				args: "you &amp; me",
				want: "you & me",
			},
			{
				name: "named entity: &quot;",
				args: "&quot;quoted&quot;",
				want: `"quoted"`,
			},
			{
				name: "named entity: &apos;",
				args: "it&apos;s fine",
				want: "it's fine",
			},
			// Decimal numeric entities (as used by the plugin)
			{
				name: "numeric entity: &#33; (exclamation)",
				args: "Hello&#33;",
				want: "Hello!",
			},
			{
				name: "numeric entity: &#35; (hash)",
				args: "&#35;channel",
				want: "#channel",
			},
			{
				name: "numeric entity: &#40; and &#41; (parentheses)",
				args: "func&#40;arg&#41;",
				want: "func(arg)",
			},
			{
				name: "numeric entity: &#42; (asterisk)",
				args: "&#42;bold&#42;",
				want: "*bold*",
			},
			{
				name: "numeric entity: &#43; (plus)",
				args: "1 &#43; 1",
				want: "1 + 1",
			},
			{
				name: "numeric entity: &#45; (dash)",
				args: "a &#45; b",
				want: "a - b",
			},
			{
				name: "numeric entity: &#46; (period)",
				args: "end&#46;",
				want: "end.",
			},
			{
				name: "numeric entity: &#47; (forward slash)",
				args: "path&#47;to&#47;file",
				want: "path/to/file",
			},
			{
				name: "numeric entity: &#58; (colon)",
				args: "key&#58; value",
				want: "key: value",
			},
			{
				name: "numeric entity: &#60; and &#62; (angle brackets)",
				args: "&#60;tag&#62;",
				want: "<tag>",
			},
			{
				name: "numeric entity: &#91; and &#93; (square brackets)",
				args: "&#91;link&#93;",
				want: "[link]",
			},
			{
				name: "numeric entity: &#92; (backslash)",
				args: "path&#92;file",
				want: "path\\file",
			},
			{
				name: "numeric entity: &#95; (underscore)",
				args: "snake&#95;case",
				want: "snake_case",
			},
			{
				name: "numeric entity: &#96; (backtick)",
				args: "&#96;code&#96;",
				want: "`code`",
			},
			{
				name: "numeric entity: &#124; (vertical bar)",
				args: "a &#124; b",
				want: "a | b",
			},
			{
				name: "numeric entity: &#126; (tilde)",
				args: "&#126;channel",
				want: "~channel",
			},
			// Mixed content
			{
				name: "mixed: markdown and entities",
				args: "**bold** and &#60;tag&#62;",
				want: "bold and <tag>",
			},
			{
				name: "mixed: multiple numeric entities",
				args: "&#33;&#35;&#40;&#41;&#42;",
				want: "!#()*",
			},
			{
				name: "mixed: sentence with encoded punctuation",
				args: "Hello&#33; How are you&#63;",
				want: "Hello! How are you?",
			},
			// Edge cases
			{
				name: "invalid entity: preserved as-is after decode",
				args: "&invalid;",
				want: "&invalid;",
			},
			{
				name: "partial entity: ampersand alone",
				args: "Tom & Jerry",
				want: "Tom & Jerry",
			},
		}

		for _, tt := range entityTests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := StripMarkdownAndDecode(tt.args)
				if err != nil {
					t.Fatalf("error: %v", err)
				}
				assert.Equal(t, tt.want, got)
			})
		}
	})
}

func TestMarkdownToHTML(t *testing.T) {
	siteURL := "https://example.com"
	tests := []struct {
		name     string
		markdown string
		want     string
	}{
		{
			name:     "absolute url not changed",
			markdown: "[Link](https://example.com)",
			want:     "<p><a href=\"https://example.com\">Link</a></p>\n",
		},
		{
			name:     "relative url changed to absolute url",
			markdown: "[Link](/foo)",
			want:     "<p><a href=\"https://example.com/foo\">Link</a></p>\n",
		},
		{
			name:     "relative url with query params changed to absolute url",
			markdown: "[Link](/foo?bar=true)",
			want:     "<p><a href=\"https://example.com/foo?bar=true\">Link</a></p>\n",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := MarkdownToHTML(tt.markdown, siteURL)
			if err != nil {
				t.Fatalf("error: %v", err)
			}
			assert.Equal(t, tt.want, got)
		})
	}
}
