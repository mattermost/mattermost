// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"html"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	astExt "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

// StripMarkdown removes markdown syntax from text and returns plain text.
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

// StripMarkdownAndDecode removes markdown syntax and decodes HTML entities
// (both named like &lt; and numeric like &#60;) to their character equivalents.
// This is useful for plain text contexts like mobile push notifications where
// HTML will not be rendered.
//
// SECURITY NOTE: The output is intended for plain text contexts only.
// Do NOT use in contexts where HTML could be rendered without proper escaping.
func StripMarkdownAndDecode(markdown string) (string, error) {
	stripped, err := StripMarkdown(markdown)
	if err != nil {
		return "", err
	}
	return html.UnescapeString(stripped), nil
}

var relLinkReg = regexp.MustCompile(`\[(.*)]\((/.*)\)`)
var blockquoteReg = regexp.MustCompile(`^|\n(&gt;)`)

// MarkdownToHTML takes a string containing Markdown and returns a string with HTML tagged version
func MarkdownToHTML(markdown, siteURL string) (string, error) {
	return MarkdownToHTMLWithBlockedImages(markdown, siteURL, false)
}

// MarkdownToHTMLWithBlockedImages converts Markdown to HTML and, when blockExternalImages is true,
// replaces external or /api/v4/image Markdown images with links (or plain text if inside a link or unsafe).
func MarkdownToHTMLWithBlockedImages(markdown, siteURL string, blockExternalImages bool) (string, error) {
	// Turn relative links into absolute links
	absLinkMarkdown := relLinkReg.ReplaceAllStringFunc(markdown, func(s string) string {
		return relLinkReg.ReplaceAllString(s, "[$1]("+siteURL+"$2)")
	})

	// Unescape any blockquote text to be parsed by the markdown parser.
	markdownClean := blockquoteReg.ReplaceAllStringFunc(absLinkMarkdown, func(s string) string {
		return html.UnescapeString(s)
	})

	opts := []goldmark.Option{
		goldmark.WithExtensions(extension.GFM),
	}
	if blockExternalImages {
		opts = append(opts, goldmark.WithParserOptions(
			parser.WithASTTransformers(util.Prioritized(&externalImageBlockTransformer{siteURL: siteURL}, 500)),
		))
	}

	md := goldmark.New(opts...)

	var b strings.Builder

	err := md.Convert([]byte(markdownClean), &b)
	if err != nil {
		return "", err
	}
	return b.String(), nil
}

type externalImageBlockTransformer struct {
	siteURL string
}

func (t *externalImageBlockTransformer) Transform(doc *ast.Document, _ text.Reader, _ parser.Context) {
	var images []*ast.Image
	if err := ast.Walk(doc, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if entering && n.Kind() == ast.KindImage {
			if img, ok := n.(*ast.Image); ok {
				images = append(images, img)
			}
		}
		return ast.WalkContinue, nil
	}); err != nil {
		return
	}

	for _, img := range images {
		// The destination keeps its Markdown source spelling, so entity references such as the
		// &amp; that email escaping produces must be decoded before the URL's query is read.
		dest := string(util.ResolveNumericReferences(util.ResolveEntityNames(util.UnescapePunctuations(img.Destination))))
		if !model.IsExternalImageURL(dest, t.siteURL) {
			continue
		}

		parent := img.Parent()
		if parent == nil {
			continue
		}

		hasLinkAncestor := false
		for p := parent; p != nil; p = p.Parent() {
			if p.Kind() == ast.KindLink {
				hasLinkAncestor = true
				break
			}
		}

		targetURL, linkable := model.BlockedImageLinkTarget(dest, t.siteURL)
		if !hasLinkAncestor && linkable {
			link := ast.NewLink()
			link.Destination = []byte(targetURL)
			link.Title = img.Title
			if img.FirstChild() != nil {
				for c := img.FirstChild(); c != nil; {
					next := c.NextSibling()
					link.AppendChild(link, c)
					c = next
				}
			} else {
				link.AppendChild(link, ast.NewString([]byte(targetURL)))
			}
			parent.ReplaceChild(parent, img, link)
			continue
		}

		if img.FirstChild() != nil {
			for c := img.FirstChild(); c != nil; {
				next := c.NextSibling()
				parent.InsertBefore(parent, img, c)
				c = next
			}
			parent.RemoveChild(parent, img)
		} else {
			parent.ReplaceChild(parent, img, ast.NewString([]byte(targetURL)))
		}
	}
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
	for i := range n.Lines().Len() {
		line := n.Lines().At(i)
		value := line.Value(source)
		_, _ = w.Write(value)
	}
}
