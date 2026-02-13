// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestLooksLikeMarkdown(t *testing.T) {
	tests := []struct {
		name string
		text string
		want bool
	}{
		// Guard conditions
		{
			name: "short text returns false",
			text: "ab",
			want: false,
		},
		{
			name: "HTML prefix returns false",
			text: "<html>content</html>",
			want: false,
		},
		{
			name: "HTML with leading whitespace returns false",
			text: "  <div>content</div>",
			want: false,
		},

		// Pattern matching - true cases
		{
			name: "fenced code block",
			text: "```go\nfmt.Println()\n```",
			want: true,
		},
		{
			name: "heading level 1",
			text: "# Title",
			want: true,
		},
		{
			name: "heading level 2",
			text: "## Subtitle",
			want: true,
		},
		{
			name: "heading level 3",
			text: "### Section",
			want: true,
		},
		{
			name: "bold text",
			text: "This is **bold** text",
			want: true,
		},
		{
			name: "link",
			text: "Check [this link](https://example.com)",
			want: true,
		},
		{
			name: "unordered list with dash",
			text: "- item one\n- item two",
			want: true,
		},
		{
			name: "ordered list",
			text: "1. first\n2. second",
			want: true,
		},
		{
			name: "unordered list with asterisk",
			text: "* item one\n* item two",
			want: true,
		},

		// Plain text - false cases
		{
			name: "plain text",
			text: "This is plain text without markdown",
			want: false,
		},
		{
			name: "hash not followed by space",
			text: "#hashtag is not a heading",
			want: false,
		},
		{
			name: "asterisk in middle of word",
			text: "This is a*test*string",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := LooksLikeMarkdown(tt.text)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestMarkdownToTipTapJSON(t *testing.T) {
	t.Run("heading", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("# Hello")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		assert.Equal(t, "doc", doc["type"])
		content := doc["content"].([]any)
		require.Len(t, content, 1)

		heading := content[0].(map[string]any)
		assert.Equal(t, "heading", heading["type"])
		attrs := heading["attrs"].(map[string]any)
		assert.Equal(t, float64(1), attrs["level"])

		headingContent := heading["content"].([]any)
		require.NotEmpty(t, headingContent)
		textNode := headingContent[0].(map[string]any)
		assert.Equal(t, "text", textNode["type"])
		assert.Equal(t, "Hello", textNode["text"])
	})

	t.Run("paragraph with bold", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("This is **bold** text")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 1)

		para := content[0].(map[string]any)
		assert.Equal(t, "paragraph", para["type"])

		paraContent := para["content"].([]any)
		require.Len(t, paraContent, 3)

		// "This is "
		text1 := paraContent[0].(map[string]any)
		assert.Equal(t, "This is ", text1["text"])

		// "bold" with bold mark
		boldText := paraContent[1].(map[string]any)
		assert.Equal(t, "bold", boldText["text"])
		marks := boldText["marks"].([]any)
		require.Len(t, marks, 1)
		assert.Equal(t, "bold", marks[0].(map[string]any)["type"])

		// " text"
		text2 := paraContent[2].(map[string]any)
		assert.Equal(t, " text", text2["text"])
	})

	t.Run("paragraph with italic", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("This is *italic* text")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		para := content[0].(map[string]any)
		paraContent := para["content"].([]any)

		// Find the italic text
		italicText := paraContent[1].(map[string]any)
		assert.Equal(t, "italic", italicText["text"])
		marks := italicText["marks"].([]any)
		require.Len(t, marks, 1)
		assert.Equal(t, "italic", marks[0].(map[string]any)["type"])
	})

	t.Run("paragraph with inline code", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("Use the `code` function")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		para := content[0].(map[string]any)
		paraContent := para["content"].([]any)

		// Find the code text
		codeText := paraContent[1].(map[string]any)
		assert.Equal(t, "code", codeText["text"])
		marks := codeText["marks"].([]any)
		require.Len(t, marks, 1)
		assert.Equal(t, "code", marks[0].(map[string]any)["type"])
	})

	t.Run("link", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("[click here](https://example.com)")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		para := content[0].(map[string]any)
		paraContent := para["content"].([]any)
		require.Len(t, paraContent, 1)

		linkText := paraContent[0].(map[string]any)
		assert.Equal(t, "click here", linkText["text"])
		marks := linkText["marks"].([]any)
		require.Len(t, marks, 1)
		linkMark := marks[0].(map[string]any)
		assert.Equal(t, "link", linkMark["type"])
		attrs := linkMark["attrs"].(map[string]any)
		assert.Equal(t, "https://example.com", attrs["href"])
	})

	t.Run("fenced code block with language", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("```go\nfmt.Println(\"hello\")\n```")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 1)

		codeBlock := content[0].(map[string]any)
		assert.Equal(t, "codeBlock", codeBlock["type"])
		attrs := codeBlock["attrs"].(map[string]any)
		assert.Equal(t, "go", attrs["language"])

		codeContent := codeBlock["content"].([]any)
		require.Len(t, codeContent, 1)
		textNode := codeContent[0].(map[string]any)
		assert.Equal(t, "fmt.Println(\"hello\")", textNode["text"])
	})

	t.Run("bullet list", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("- one\n- two")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 1)

		list := content[0].(map[string]any)
		assert.Equal(t, "bulletList", list["type"])

		items := list["content"].([]any)
		require.Len(t, items, 2)

		// Check first item: bulletList -> listItem -> paragraph -> text
		item1 := items[0].(map[string]any)
		assert.Equal(t, "listItem", item1["type"])
		item1Content := item1["content"].([]any)
		require.Len(t, item1Content, 1)

		para1 := item1Content[0].(map[string]any)
		assert.Equal(t, "paragraph", para1["type"])
		para1Content := para1["content"].([]any)
		text1 := para1Content[0].(map[string]any)
		assert.Equal(t, "one", text1["text"])
	})

	t.Run("ordered list", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("1. first\n2. second")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 1)

		list := content[0].(map[string]any)
		assert.Equal(t, "orderedList", list["type"])

		items := list["content"].([]any)
		require.Len(t, items, 2)
	})

	t.Run("nested formatting", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("This is **bold and *italic* text**")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		// Just verify it parses without error and produces valid structure
		assert.Equal(t, "doc", doc["type"])
		content := doc["content"].([]any)
		require.NotEmpty(t, content)
	})

	t.Run("multiple paragraphs", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("First paragraph.\n\nSecond paragraph.")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 2)

		para1 := content[0].(map[string]any)
		assert.Equal(t, "paragraph", para1["type"])

		para2 := content[1].(map[string]any)
		assert.Equal(t, "paragraph", para2["type"])
	})

	t.Run("table", func(t *testing.T) {
		markdown := "| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n| Cell 3   | Cell 4   |"
		result, err := MarkdownToTipTapJSON(markdown)
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 1)

		table := content[0].(map[string]any)
		assert.Equal(t, "table", table["type"])

		rows := table["content"].([]any)
		require.Len(t, rows, 3, "should have header row + 2 data rows")

		// Check header row
		headerRow := rows[0].(map[string]any)
		assert.Equal(t, "tableRow", headerRow["type"])
		headerCells := headerRow["content"].([]any)
		require.Len(t, headerCells, 2)
		assert.Equal(t, "tableHeader", headerCells[0].(map[string]any)["type"])

		// Check data row
		dataRow := rows[1].(map[string]any)
		assert.Equal(t, "tableRow", dataRow["type"])
		dataCells := dataRow["content"].([]any)
		require.Len(t, dataCells, 2)
		assert.Equal(t, "tableCell", dataCells[0].(map[string]any)["type"])
	})

	t.Run("blockquote", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("> This is a quote")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 1)

		blockquote := content[0].(map[string]any)
		assert.Equal(t, "blockquote", blockquote["type"])

		// Blockquote should contain a paragraph
		bqContent := blockquote["content"].([]any)
		require.NotEmpty(t, bqContent)
		assert.Equal(t, "paragraph", bqContent[0].(map[string]any)["type"])
	})

	t.Run("horizontal rule", func(t *testing.T) {
		result, err := MarkdownToTipTapJSON("Before\n\n---\n\nAfter")
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 3)

		// Should be: paragraph, horizontalRule, paragraph
		assert.Equal(t, "paragraph", content[0].(map[string]any)["type"])
		assert.Equal(t, "horizontalRule", content[1].(map[string]any)["type"])
		assert.Equal(t, "paragraph", content[2].(map[string]any)["type"])
	})

	t.Run("empty table cells have content", func(t *testing.T) {
		// Empty cells must have at least an empty paragraph for valid TipTap JSON
		markdown := "| A | |\n|---|---|\n| B | |"
		result, err := MarkdownToTipTapJSON(markdown)
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 1)

		table := content[0].(map[string]any)
		assert.Equal(t, "table", table["type"])

		rows := table["content"].([]any)
		require.Len(t, rows, 2)

		// Check header row - second cell is empty
		headerRow := rows[0].(map[string]any)
		headerCells := headerRow["content"].([]any)
		require.Len(t, headerCells, 2)

		emptyHeaderCell := headerCells[1].(map[string]any)
		assert.Equal(t, "tableHeader", emptyHeaderCell["type"])
		// Empty cell must still have content array with paragraph
		cellContent, hasContent := emptyHeaderCell["content"]
		require.True(t, hasContent, "empty cell must have content array")
		cellContentArr := cellContent.([]any)
		require.Len(t, cellContentArr, 1)
		assert.Equal(t, "paragraph", cellContentArr[0].(map[string]any)["type"])
	})

	t.Run("inline image converted to link", func(t *testing.T) {
		// Images are block-level in TipTap, so inline images convert to links
		markdown := "Check this ![screenshot](https://example.com/img.png) out"
		result, err := MarkdownToTipTapJSON(markdown)
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		require.Len(t, content, 1)

		para := content[0].(map[string]any)
		assert.Equal(t, "paragraph", para["type"])

		paraContent := para["content"].([]any)
		require.Len(t, paraContent, 3) // "Check this ", link, " out"

		// Middle element should be the image converted to link
		imgLink := paraContent[1].(map[string]any)
		assert.Equal(t, "text", imgLink["type"])
		assert.Equal(t, "screenshot", imgLink["text"]) // alt text preserved

		marks := imgLink["marks"].([]any)
		require.Len(t, marks, 1)
		linkMark := marks[0].(map[string]any)
		assert.Equal(t, "link", linkMark["type"])
		attrs := linkMark["attrs"].(map[string]any)
		assert.Equal(t, "https://example.com/img.png", attrs["href"])
	})

	t.Run("image without alt text uses URL", func(t *testing.T) {
		markdown := "![](https://example.com/img.png)"
		result, err := MarkdownToTipTapJSON(markdown)
		require.NoError(t, err)

		var doc map[string]any
		err = json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)

		content := doc["content"].([]any)
		para := content[0].(map[string]any)
		paraContent := para["content"].([]any)
		require.Len(t, paraContent, 1)

		imgLink := paraContent[0].(map[string]any)
		assert.Equal(t, "text", imgLink["type"])
		assert.Equal(t, "https://example.com/img.png", imgLink["text"]) // URL as fallback
	})
}
