// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStripMarkdown(t *testing.T) {
	tests := []struct {
		name string
		args string
		want string
	}{
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
			name: "text: multiple entities",
			args: "'><&",
			want: "'><&",
		},
		{
			name: "text: empty string",
			args: "",
			want: "",
		},
	}
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
