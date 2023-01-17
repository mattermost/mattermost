// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"html"
	"regexp"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	astExt "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/renderer"
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

// MarkdownToHTML takes a string containing Markdown and returns a string with HTML tagged version
func MarkdownToHTML(markdown, siteURL string) (string, error) {
	// Turn relative links into absolute links
	relLinkRe := regexp.MustCompile(`\[(.*)]\((/.*)\)`)
	absLinkMarkdown := relLinkRe.ReplaceAllFunc([]byte(markdown), func(s []byte) []byte {
		out := relLinkRe.ReplaceAllString(string(s), "[$1]("+siteURL+"$2)")
		return []byte(out)
	})

	// Unescape any blockquote text to be parsed by the markdown parser.
	re := regexp.MustCompile(`^|\n(&gt;)`)
	markdownClean := re.ReplaceAllFunc([]byte(absLinkMarkdown), func(s []byte) []byte {
		out := html.UnescapeString(string(s))
		return []byte(out)
	})

	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
	)

	var b strings.Builder

	err := md.Convert(markdownClean, &b)
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
