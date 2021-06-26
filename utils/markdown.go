// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	astExt "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/util"

	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

func StripMarkdown(markdown string) string {
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithRenderer(
			renderer.NewRenderer(renderer.WithNodeRenderers(
				util.Prioritized(newNotificationRenderer(), 500),
			)),
		),
	)

	var buf strings.Builder
	if err := md.Convert([]byte(markdown), &buf); err != nil {
		mlog.Warn("failed parse to markdown")
		return markdown
	}

	return strings.TrimSpace(buf.String())
}

type notificationRenderer struct {
}

func newNotificationRenderer() *notificationRenderer {
	return &notificationRenderer{}
}

func (r *notificationRenderer) RegisterFuncs(reg renderer.NodeRendererFuncRegisterer) {
	// block
	reg.Register(ast.KindDocument, r.renderDefault)
	reg.Register(ast.KindHeading, r.renderHeading)
	reg.Register(ast.KindBlockquote, r.renderDefault)
	reg.Register(ast.KindCodeBlock, r.renderCodeBlock)
	reg.Register(ast.KindFencedCodeBlock, r.renderFencedCodeBlock)
	reg.Register(ast.KindHTMLBlock, r.renderDefault)
	reg.Register(ast.KindList, r.renderDefault)
	reg.Register(ast.KindListItem, r.renderListItem)
	reg.Register(ast.KindParagraph, r.renderParagraph)
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

	// table
	reg.Register(astExt.KindTable, r.renderTable)

	// strikethrough
	reg.Register(astExt.KindStrikethrough, r.renderDefault)
}

// renderDefault renderer function to renderDefault without changes
func (r *notificationRenderer) renderDefault(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderHeading(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		if node.NextSibling() != nil {
			_ = w.WriteByte(' ')
		}
	}
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderListItem(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if entering {
		fc := node.FirstChild()
		if fc != nil {
			if _, ok := fc.(*ast.TextBlock); !ok {
				_ = w.WriteByte(' ')
			}
		}
	} else {
		if node.NextSibling() != nil {
			_ = w.WriteByte(' ')
		}
	}
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderParagraph(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
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

func (r *notificationRenderer) renderTextBlock(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		if _, ok := node.NextSibling().(ast.Node); ok && node.FirstChild() != nil {
			_ = w.WriteByte(' ')
		}
	}
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderString(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}
	n := node.(*ast.String)
	_, _ = w.Write(n.Value)
	return ast.WalkContinue, nil
}

func (r *notificationRenderer) renderTable(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	return ast.WalkSkipChildren, nil
}

func (r *notificationRenderer) writeLines(w util.BufWriter, source []byte, n ast.Node) {
	for i := 0; i < n.Lines().Len(); i++ {
		line := n.Lines().At(i)
		value := line.Value(source)
		_, _ = w.Write(value)
	}
}
