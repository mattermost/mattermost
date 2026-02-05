// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"encoding/json"
	"html"
	"regexp"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	astExt "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

// StripMarkdown remove some markdown syntax
func StripMarkdown(markdown string) (string, error) {
	md := goldmark.New(
		goldmark.WithExtensions(extension.Strikethrough),
		goldmark.WithRenderer(
			renderer.NewRenderer(renderer.WithNodeRenderers(
				util.Prioritized(newNotificationRenderer(), 500),
			)),
		),
	)

	var buf strings.Builder
	if err := md.Convert([]byte(markdown), &buf); err != nil {
		return "", err
	}

	return strings.TrimSpace(buf.String()), nil
}

var relLinkReg = regexp.MustCompile(`\[(.*)]\((/.*)\)`)
var blockquoteReg = regexp.MustCompile(`^|\n(&gt;)`)

// MarkdownToHTML takes a string containing Markdown and returns a string with HTML tagged version
func MarkdownToHTML(markdown, siteURL string) (string, error) {
	// Turn relative links into absolute links
	absLinkMarkdown := relLinkReg.ReplaceAllStringFunc(markdown, func(s string) string {
		return relLinkReg.ReplaceAllString(s, "[$1]("+siteURL+"$2)")
	})

	// Unescape any blockquote text to be parsed by the markdown parser.
	markdownClean := blockquoteReg.ReplaceAllStringFunc(absLinkMarkdown, func(s string) string {
		return html.UnescapeString(s)
	})

	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
	)

	var b strings.Builder

	err := md.Convert([]byte(markdownClean), &b)
	if err != nil {
		return "", err
	}
	return b.String(), nil
}

type notificationRenderer struct {
}

func newNotificationRenderer() *notificationRenderer {
	return &notificationRenderer{}
}

func (r *notificationRenderer) RegisterFuncs(reg renderer.NodeRendererFuncRegisterer) {
	// block
	reg.Register(ast.KindDocument, r.renderDefault)
	reg.Register(ast.KindHeading, r.renderItem)
	reg.Register(ast.KindBlockquote, r.renderDefault)
	reg.Register(ast.KindCodeBlock, r.renderCodeBlock)
	reg.Register(ast.KindFencedCodeBlock, r.renderFencedCodeBlock)
	reg.Register(ast.KindHTMLBlock, r.renderDefault)
	reg.Register(ast.KindList, r.renderDefault)
	reg.Register(ast.KindListItem, r.renderItem)
	reg.Register(ast.KindParagraph, r.renderItem)
	reg.Register(ast.KindTextBlock, r.renderTextBlock)
	reg.Register(ast.KindThematicBreak, r.renderDefault)

	// inlines
	reg.Register(ast.KindAutoLink, r.renderDefault)
	reg.Register(ast.KindCodeSpan, r.renderDefault)
	reg.Register(ast.KindEmphasis, r.renderDefault)
	reg.Register(ast.KindImage, r.renderDefault)
	reg.Register(ast.KindLink, r.renderDefault)
	reg.Register(ast.KindRawHTML, r.renderDefault)
	reg.Register(ast.KindText, r.renderText)
	reg.Register(ast.KindString, r.renderString)

	// strikethrough
	reg.Register(astExt.KindStrikethrough, r.renderDefault)
}

// renderDefault renderer function to renderDefault without changes
func (r *notificationRenderer) renderDefault(_ util.BufWriter, _ []byte, _ ast.Node, _ bool) (ast.WalkStatus, error) {
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderItem(w util.BufWriter, _ []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		if node.NextSibling() != nil {
			_ = w.WriteByte(' ')
		}
	}
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderCodeBlock(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	n := node.(*ast.CodeBlock)
	if entering {
		r.writeLines(w, source, n)
	}

	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderFencedCodeBlock(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	n := node.(*ast.FencedCodeBlock)
	if entering {
		r.writeLines(w, source, n)
	}

	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderText(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}
	n := node.(*ast.Text)
	segment := n.Segment
	_, _ = w.Write(segment.Value(source))
	if !n.IsRaw() {
		if n.HardLineBreak() || n.SoftLineBreak() {
			_ = w.WriteByte('\n')
		}
	}
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderTextBlock(w util.BufWriter, _ []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		if node.NextSibling() != nil && node.FirstChild() != nil {
			_ = w.WriteByte(' ')
		}
	}
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderString(w util.BufWriter, _ []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}
	n := node.(*ast.String)
	_, _ = w.Write(n.Value)
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) writeLines(w util.BufWriter, source []byte, n ast.Node) {
	for i := 0; i < n.Lines().Len(); i++ {
		line := n.Lines().At(i)
		value := line.Value(source)
		_, _ = w.Write(value)
	}
}

// LooksLikeMarkdown detects if text contains markdown syntax.
// Used to determine whether to convert plain text to TipTap via markdown parsing.
func LooksLikeMarkdown(text string) bool {
	if len(text) < 5 {
		return false
	}
	trimmed := strings.TrimSpace(text)
	if strings.HasPrefix(trimmed, "<") {
		return false
	}
	patterns := []string{"```", "# ", "## ", "### ", "**", "](", "- ", "1. ", "* "}
	for _, p := range patterns {
		if strings.Contains(text, p) {
			return true
		}
	}
	return false
}

// MarkdownToTipTapJSON converts markdown text to TipTap JSON format.
// Returns the JSON string or an error if conversion fails.
func MarkdownToTipTapJSON(markdown string) (string, error) {
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

	source := []byte(markdown)
	reader := text.NewReader(source)
	doc := md.Parser().Parse(reader)

	content := convertASTToTipTap(doc, source)

	result := map[string]any{
		"type":    "doc",
		"content": content,
	}

	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", err
	}

	return string(jsonBytes), nil
}

// convertASTToTipTap recursively converts goldmark AST nodes to TipTap JSON nodes
func convertASTToTipTap(node ast.Node, source []byte) []map[string]any {
	var content []map[string]any

	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		if tipTapNode := astNodeToTipTap(child, source); tipTapNode != nil {
			content = append(content, tipTapNode)
		}
	}

	return content
}

// astNodeToTipTap converts a single AST node to a TipTap node
func astNodeToTipTap(node ast.Node, source []byte) map[string]any {
	switch n := node.(type) {
	case *ast.Heading:
		return convertHeading(n, source)
	case *ast.Paragraph:
		return convertParagraph(n, source)
	case *ast.FencedCodeBlock:
		return convertFencedCodeBlock(n, source)
	case *ast.CodeBlock:
		return convertCodeBlock(n, source)
	case *ast.List:
		return convertList(n, source)
	case *ast.Blockquote:
		return convertBlockquote(n, source)
	case *ast.ThematicBreak:
		return convertThematicBreak()
	case *astExt.Table:
		return convertTable(n, source)
	default:
		// Unsupported node types - skip
		return nil
	}
}

func convertHeading(node *ast.Heading, source []byte) map[string]any {
	result := map[string]any{
		"type": "heading",
		"attrs": map[string]any{
			"level": node.Level,
		},
	}

	content := convertInlineContent(node, source)
	if len(content) > 0 {
		result["content"] = content
	}

	return result
}

func convertParagraph(node *ast.Paragraph, source []byte) map[string]any {
	result := map[string]any{
		"type": "paragraph",
	}

	content := convertInlineContent(node, source)
	if len(content) > 0 {
		result["content"] = content
	}

	return result
}

func convertFencedCodeBlock(node *ast.FencedCodeBlock, source []byte) map[string]any {
	var codeText strings.Builder
	for i := 0; i < node.Lines().Len(); i++ {
		line := node.Lines().At(i)
		codeText.Write(line.Value(source))
	}

	// Remove trailing newline if present
	code := strings.TrimSuffix(codeText.String(), "\n")

	result := map[string]any{
		"type": "codeBlock",
	}

	// Extract language if specified
	lang := string(node.Language(source))
	if lang != "" {
		result["attrs"] = map[string]any{
			"language": lang,
		}
	}

	if code != "" {
		result["content"] = []map[string]any{
			{
				"type": "text",
				"text": code,
			},
		}
	}

	return result
}

func convertCodeBlock(node *ast.CodeBlock, source []byte) map[string]any {
	var codeText strings.Builder
	for i := 0; i < node.Lines().Len(); i++ {
		line := node.Lines().At(i)
		codeText.Write(line.Value(source))
	}

	code := strings.TrimSuffix(codeText.String(), "\n")

	result := map[string]any{
		"type": "codeBlock",
	}

	if code != "" {
		result["content"] = []map[string]any{
			{
				"type": "text",
				"text": code,
			},
		}
	}

	return result
}

func convertList(node *ast.List, source []byte) map[string]any {
	listType := "bulletList"
	if node.IsOrdered() {
		listType = "orderedList"
	}

	var items []map[string]any
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		if listItem, ok := child.(*ast.ListItem); ok {
			items = append(items, convertListItem(listItem, source))
		}
	}

	return map[string]any{
		"type":    listType,
		"content": items,
	}
}

func convertBlockquote(node *ast.Blockquote, source []byte) map[string]any {
	var content []map[string]any

	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		if tipTapNode := astNodeToTipTap(child, source); tipTapNode != nil {
			content = append(content, tipTapNode)
		}
	}

	return map[string]any{
		"type":    "blockquote",
		"content": content,
	}
}

func convertThematicBreak() map[string]any {
	return map[string]any{
		"type": "horizontalRule",
	}
}

func convertTable(node *astExt.Table, source []byte) map[string]any {
	var rows []map[string]any

	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		switch row := child.(type) {
		case *astExt.TableHeader:
			rows = append(rows, convertTableRow(row, source, true))
		case *astExt.TableRow:
			rows = append(rows, convertTableRow(row, source, false))
		}
	}

	return map[string]any{
		"type":    "table",
		"content": rows,
	}
}

func convertTableRow(node ast.Node, source []byte, isHeader bool) map[string]any {
	var cells []map[string]any

	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		if cell, ok := child.(*astExt.TableCell); ok {
			cells = append(cells, convertTableCell(cell, source, isHeader))
		}
	}

	return map[string]any{
		"type":    "tableRow",
		"content": cells,
	}
}

func convertTableCell(node *astExt.TableCell, source []byte, isHeader bool) map[string]any {
	cellType := "tableCell"
	if isHeader {
		cellType = "tableHeader"
	}

	// Convert cell content - cells typically contain paragraphs
	var content []map[string]any

	// If the cell has inline content directly, wrap in paragraph
	inlineContent := convertInlineContent(node, source)
	if len(inlineContent) > 0 {
		content = append(content, map[string]any{
			"type":    "paragraph",
			"content": inlineContent,
		})
	} else {
		// TipTap requires table cells to have at least one block node
		// Add empty paragraph for empty cells to satisfy schema
		content = append(content, map[string]any{
			"type": "paragraph",
		})
	}

	return map[string]any{
		"type":    cellType,
		"content": content,
	}
}

func convertListItem(node *ast.ListItem, source []byte) map[string]any {
	var content []map[string]any

	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		switch c := child.(type) {
		case *ast.TextBlock:
			// TextBlock in list item - convert to paragraph
			para := map[string]any{
				"type": "paragraph",
			}
			inlineContent := convertInlineContent(c, source)
			if len(inlineContent) > 0 {
				para["content"] = inlineContent
			}
			content = append(content, para)
		case *ast.Paragraph:
			content = append(content, convertParagraph(c, source))
		case *ast.List:
			// Nested list
			content = append(content, convertList(c, source))
		}
	}

	return map[string]any{
		"type":    "listItem",
		"content": content,
	}
}

// convertInlineContent converts inline children of a block node to TipTap text nodes with marks
func convertInlineContent(node ast.Node, source []byte) []map[string]any {
	var content []map[string]any

	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		inlineNodes := convertInlineNode(child, source, nil)
		content = append(content, inlineNodes...)
	}

	return content
}

// convertInlineNode converts an inline AST node to TipTap text nodes
// marks parameter accumulates marks from parent emphasis/link nodes
func convertInlineNode(node ast.Node, source []byte, marks []map[string]any) []map[string]any {
	switch n := node.(type) {
	case *ast.Text:
		text := string(n.Segment.Value(source))
		if text == "" {
			return nil
		}
		result := map[string]any{
			"type": "text",
			"text": text,
		}
		if len(marks) > 0 {
			result["marks"] = marks
		}
		return []map[string]any{result}

	case *ast.String:
		text := string(n.Value)
		if text == "" {
			return nil
		}
		result := map[string]any{
			"type": "text",
			"text": text,
		}
		if len(marks) > 0 {
			result["marks"] = marks
		}
		return []map[string]any{result}

	case *ast.Emphasis:
		// Single asterisk = italic, double = bold
		markType := "italic"
		if n.Level == 2 {
			markType = "bold"
		}
		newMarks := append(copyMarks(marks), map[string]any{"type": markType})

		var content []map[string]any
		for child := n.FirstChild(); child != nil; child = child.NextSibling() {
			content = append(content, convertInlineNode(child, source, newMarks)...)
		}
		return content

	case *ast.CodeSpan:
		text := extractCodeSpanText(n, source)
		if text == "" {
			return nil
		}
		newMarks := append(copyMarks(marks), map[string]any{"type": "code"})
		return []map[string]any{
			{
				"type":  "text",
				"text":  text,
				"marks": newMarks,
			},
		}

	case *ast.Link:
		newMarks := append(copyMarks(marks), map[string]any{
			"type": "link",
			"attrs": map[string]any{
				"href": string(n.Destination),
			},
		})

		var content []map[string]any
		for child := n.FirstChild(); child != nil; child = child.NextSibling() {
			content = append(content, convertInlineNode(child, source, newMarks)...)
		}
		return content

	case *ast.AutoLink:
		url := string(n.URL(source))
		newMarks := append(copyMarks(marks), map[string]any{
			"type": "link",
			"attrs": map[string]any{
				"href": url,
			},
		})
		return []map[string]any{
			{
				"type":  "text",
				"text":  url,
				"marks": newMarks,
			},
		}

	case *ast.Image:
		// Images in TipTap are block-level nodes, but markdown allows inline images.
		// Convert to a link with alt text to preserve the information without breaking
		// TipTap's inline content schema. Users can see the link and re-add as block image.
		src := string(n.Destination)
		alt := string(n.Text(source))
		if alt == "" {
			alt = src // Use URL as display text if no alt text
		}
		newMarks := append(copyMarks(marks), map[string]any{
			"type": "link",
			"attrs": map[string]any{
				"href": src,
			},
		})
		return []map[string]any{
			{
				"type":  "text",
				"text":  alt,
				"marks": newMarks,
			},
		}

	default:
		// For other inline nodes, try to get text content
		var content []map[string]any
		for child := node.FirstChild(); child != nil; child = child.NextSibling() {
			content = append(content, convertInlineNode(child, source, marks)...)
		}
		return content
	}
}

func extractCodeSpanText(node *ast.CodeSpan, source []byte) string {
	var text strings.Builder
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		if t, ok := child.(*ast.Text); ok {
			text.Write(t.Segment.Value(source))
		}
	}
	return text.String()
}

func copyMarks(marks []map[string]any) []map[string]any {
	if marks == nil {
		return nil
	}
	result := make([]map[string]any, len(marks))
	copy(result, marks)
	return result
}
